import { Injectable, Logger } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaService } from "../common/prisma.service";
import { SourcingService } from "../sourcing/sourcing.service";
import { ValidationService } from "./validation.service";
import { WhatsappService } from "../whatsapp/whatsapp.service";

export interface ExtractedItem {
  itemName: string;
  quantity?: number;
  unit?: string;
  notes?: string;
}

const EXTRACT_SYSTEM = `You are a procurement assistant. Extract the list of items a customer is requesting from their message.
Return ONLY a JSON array. Each element: { "itemName": string, "quantity": number|null, "unit": string|null, "notes": string|null }.
Be precise with item names. Preserve units (kg, pcs, litre, box, etc.). If quantity is unclear, set null.
Do not include greetings or conversation — only the items array.`;

@Injectable()
export class InboundService {
  private readonly logger = new Logger(InboundService.name);
  private readonly anthropic: Anthropic;
  private readonly apiToken = process.env["WHATSAPP_API_TOKEN"] ?? "";
  private readonly graphBase = "https://graph.facebook.com/v19.0";

  constructor(
    private readonly prisma: PrismaService,
    private readonly sourcingService: SourcingService,
    private readonly validationService: ValidationService,
    private readonly whatsappService: WhatsappService,
  ) {
    this.anthropic = new Anthropic({ apiKey: process.env["ANTHROPIC_API_KEY"] });
  }

  private static readonly ACCEPTANCE_REGEX = /^\s*(yes|confirm(?:ed)?|ok(?:ay)?|proceed|accepted?|haan|done)\s*[!.]?\s*$/i;

  /** Called by the webhook handler for every inbound message */
  async processMessage(waMessageId: string, fromNumber: string, type: "text" | "image", text?: string, imageMediaId?: string): Promise<void> {
    // Idempotent: skip if already processed
    const existing = await this.prisma.inboundMessage.findUnique({ where: { waMessageId } });
    if (existing) return;

    // Check for quote acceptance reply before running extraction
    if (type === "text" && text && InboundService.ACCEPTANCE_REGEX.test(text)) {
      const handled = await this.tryAcceptQuote(fromNumber, waMessageId);
      if (handled) return;
    }

    // Identify customer by phone (normalize: strip spaces, dashes)
    const normalized = fromNumber.replace(/[\s\-().]/g, "");
    const customer = await this.prisma.customer.findFirst({
      where: {
        OR: [
          { phone: { contains: normalized.slice(-10) } },
          { phone: fromNumber },
        ],
      },
    });

    // Create inbound record
    const msg = await this.prisma.inboundMessage.create({
      data: {
        waMessageId,
        fromNumber,
        messageType: type,
        rawText: text,
        imageMediaId,
        status: "PROCESSING",
        customerId: customer?.id ?? null,
      },
    });

    // Acknowledge immediately
    const ackText = customer
      ? `Hi ${customer.name.split(" ")[0]}, received your request! We're preparing a quote and will share it shortly.`
      : `Hi, we received your message. Our team will prepare a quote and get back to you shortly.`;
    await this.whatsappService.sendMessage(fromNumber, ackText).catch(err => {
      this.logger.warn(`[inbound] ack send failed: ${String(err)}`);
    });

    try {
      // Extract items
      let items: ExtractedItem[] = [];
      if (type === "text" && text) {
        items = await this.extractFromText(text);
      } else if (type === "image" && imageMediaId) {
        items = await this.extractFromImage(imageMediaId);
      }

      if (!items.length) {
        await this.prisma.inboundMessage.update({
          where: { id: msg.id },
          data: { status: "FAILED", errorMessage: "No items could be extracted from the message", extractedItems: [] },
        });
        return;
      }

      // Auto-price each item from vendor data
      const itemNames = items.map(i => i.itemName);
      const priceMap = await this.sourcingService.lookup(itemNames);

      // Build quote items with best available price
      const unmatched: string[] = [];
      const quoteItems = items.map(item => {
        const suggestions = priceMap[item.itemName] ?? [];
        const best = suggestions[0]; // already sorted lowest first
        if (!best) unmatched.push(item.itemName);
        return {
          itemName: item.itemName,
          quantity: item.quantity ?? undefined,
          unit: item.unit ?? best?.unit ?? undefined,
          costPrice: best?.price ?? undefined,
          sourceName: best?.vendorName ?? undefined,
          sourceType: best?.source ?? "manual",
          notes: item.notes ?? undefined,
        };
      });

      // Create the sourcing quote as DRAFT
      const customerName = customer?.name;
      const customerPhone = customer?.phone ?? fromNumber;
      const title = customerName
        ? `Inbound Request — ${customerName} — ${new Date().toLocaleDateString("en-IN")}`
        : `Inbound Request — ${fromNumber} — ${new Date().toLocaleDateString("en-IN")}`;

      const quote = await this.sourcingService.create({
        title,
        customerId: customer?.id ?? undefined,
        customerName: customerName ?? undefined,
        customerPhone,
        customerEmail: customer?.email ?? undefined,
        customerAddress: customer?.address ?? undefined,
        customerGst: customer?.gstNumber ?? undefined,
        globalMarkupPct: 15,
        status: "DRAFT",
        items: quoteItems,
      });

      // Link message → quote
      await this.prisma.inboundMessage.update({
        where: { id: msg.id },
        data: {
          status: "QUOTED",
          extractedItems: items as object[],
          unmatchedItems: unmatched as unknown as object[],
          quoteId: quote.id,
        },
      });

      // Send clarification for items we couldn't price
      if (unmatched.length > 0) {
        const itemList = unmatched.map(name => `• ${name}`).join("\n");
        const clarificationMsg =
          `We received your request but couldn't find prices for the following items:\n\n${itemList}\n\n` +
          `Could you please provide more details (brand, grade, quantity) or confirm if any alternate products would work?`;
        await this.whatsappService.sendMessage(fromNumber, clarificationMsg).catch(err => {
          this.logger.warn(`[inbound] clarification send failed: ${String(err)}`);
        });
        this.logger.log(`[inbound] sent clarification for ${unmatched.length} unmatched item(s) to ${fromNumber}`);
      }

      // Run validation
      await this.validationService.validate(quote.id);

      this.logger.log(`[inbound] quote created quoteId=${quote.id} from=${fromNumber} items=${items.length}`);
    } catch (err) {
      this.logger.error(`[inbound] processing failed: ${String(err)}`);
      await this.prisma.inboundMessage.update({
        where: { id: msg.id },
        data: { status: "FAILED", errorMessage: String(err) },
      });
    }
  }

  private async extractFromText(text: string): Promise<ExtractedItem[]> {
    const response = await this.anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: EXTRACT_SYSTEM,
      messages: [{ role: "user", content: text }],
    });
    const raw = response.content[0].type === "text" ? response.content[0].text : "[]";
    return this.parseItems(raw);
  }

  private async extractFromImage(mediaId: string): Promise<ExtractedItem[]> {
    // Step 1: get media URL from Meta
    const metaRes = await fetch(`${this.graphBase}/${mediaId}`, {
      headers: { Authorization: `Bearer ${this.apiToken}` },
    });
    if (!metaRes.ok) throw new Error(`Meta media info failed: ${metaRes.status}`);
    const meta = await metaRes.json() as { url?: string; mime_type?: string };
    if (!meta.url) throw new Error("No URL in media info response");

    // Step 2: download image bytes
    const imgRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${this.apiToken}` },
    });
    if (!imgRes.ok) throw new Error(`Media download failed: ${imgRes.status}`);
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mediaType = (meta.mime_type ?? "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

    // Step 3: Claude Vision extraction
    const response = await this.anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: EXTRACT_SYSTEM,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: "Extract all items from this image. Return only the JSON array." },
        ],
      }],
    });
    const raw = response.content[0].type === "text" ? response.content[0].text : "[]";
    return this.parseItems(raw);
  }

  private parseItems(raw: string): ExtractedItem[] {
    try {
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) return [];
      const parsed = JSON.parse(match[0]) as unknown;
      if (!Array.isArray(parsed)) return [];
      return (parsed as unknown[]).filter((i): i is ExtractedItem =>
        typeof i === "object" && i !== null && "itemName" in i && typeof (i as { itemName: unknown }).itemName === "string",
      );
    } catch {
      this.logger.warn(`[inbound] parseItems failed on: ${raw.substring(0, 200)}`);
      return [];
    }
  }

  async getPendingInbox(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.inboundMessage.findMany({
        where: { status: { in: ["QUOTED", "FAILED"] } },
        skip, take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          customer: { select: { id: true, name: true, companyName: true, phone: true } },
          quote: {
            select: {
              id: true,
              referenceNumber: true,
              title: true,
              status: true,
              validation: { select: { score: true, status: true, flags: true } },
              _count: { select: { items: true } },
            },
          },
        },
      }),
      this.prisma.inboundMessage.count({ where: { status: { in: ["QUOTED", "FAILED"] } } }),
    ]);
    return { data, total, page, limit };
  }

  async reviewQuote(quoteId: string, action: "APPROVED" | "REJECTED", reviewedBy: string, reviewNotes?: string) {
    const validation = await this.prisma.quoteValidation.update({
      where: { quoteId },
      data: { status: action, reviewedBy, reviewNotes, updatedAt: new Date() },
    });

    if (action === "APPROVED") {
      await this.sendApprovedQuote(quoteId, reviewedBy).catch(err => {
        this.logger.error(`[inbound] auto-send failed for quoteId=${quoteId}: ${String(err)}`);
      });
    }

    return validation;
  }

  private async tryAcceptQuote(fromNumber: string, waMessageId: string): Promise<boolean> {
    const normalized = fromNumber.replace(/[\s\-().]/g, "");
    const quote = await this.prisma.sourcingQuote.findFirst({
      where: {
        status: "SENT",
        OR: [
          { customerPhone: { contains: normalized.slice(-10) } },
          { customerPhone: fromNumber },
        ],
      },
      orderBy: { sentAt: "desc" },
    });

    if (!quote) return false;

    await this.prisma.sourcingQuote.update({
      where: { id: quote.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });

    // Record this message idempotently
    await this.prisma.inboundMessage.create({
      data: {
        waMessageId,
        fromNumber,
        messageType: "text",
        rawText: "Acceptance reply",
        status: "QUOTED",
        quoteId: quote.id,
      },
    }).catch(() => {});

    const name = quote.customerName ?? "there";
    await this.whatsappService.sendMessage(fromNumber,
      `Thank you ${name}! Your order *${quote.referenceNumber}* has been confirmed. Our team will be in touch shortly for delivery details.`,
    ).catch(err => {
      this.logger.warn(`[inbound] acceptance ack failed: ${String(err)}`);
    });

    this.logger.log(`[inbound] quote ${quote.id} auto-accepted via WhatsApp from ${fromNumber}`);
    return true;
  }

  private async sendApprovedQuote(quoteId: string, sentBy: string): Promise<void> {
    const quote = await this.prisma.sourcingQuote.findUnique({
      where: { id: quoteId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });
    if (!quote) throw new Error(`Quote ${quoteId} not found`);

    const phone = quote.customerPhone;
    if (!phone) {
      this.logger.warn(`[inbound] quoteId=${quoteId} has no customerPhone — skipping auto-send`);
      return;
    }

    const globalMarkup = quote.globalMarkupPct ?? 15;
    const lines = quote.items.map(item => {
      const cost = item.costPrice ?? 0;
      const sell = item.sellingPrice ?? (cost > 0 ? cost * (1 + globalMarkup / 100) : 0);
      const qty = item.quantity != null ? `${item.quantity}${item.unit ? " " + item.unit : ""}` : "";
      const priceStr = sell > 0 ? ` — ₹${sell.toFixed(0)}${qty ? "/" + (item.unit ?? "unit") : ""}` : "";
      return `• ${item.itemName}${qty ? " (" + qty + ")" : ""}${priceStr}`;
    });

    const total = quote.items.reduce((sum, item) => {
      const cost = item.costPrice ?? 0;
      const sell = item.sellingPrice ?? (cost > 0 ? cost * (1 + globalMarkup / 100) : 0);
      const qty = item.quantity ?? 1;
      return sum + sell * qty;
    }, 0);

    const name = quote.customerName ?? "there";
    const ref = quote.referenceNumber;
    const message = [
      `Hi ${name}! Your quote *${ref}* is ready:`,
      "",
      ...lines,
      ...(total > 0 ? ["", `*Total: ₹${total.toFixed(0)}*`] : []),
      "",
      "Reply to confirm or ask any questions.",
    ].join("\n");

    await this.whatsappService.sendMessage(phone, message);

    await this.prisma.sourcingQuoteSend.create({
      data: { quoteId, method: "WHATSAPP", sentBy, notes: "Auto-sent on inbox approval" },
    });

    await this.prisma.sourcingQuote.update({
      where: { id: quoteId },
      data: { status: "SENT", sentAt: new Date() },
    });

    this.logger.log(`[inbound] auto-sent quoteId=${quoteId} to ${phone}`);
  }
}
