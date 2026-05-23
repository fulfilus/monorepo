import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { QuotationStatus, QuotationType, AiSuggestedItem } from "@fulfilus/shared";
import { PrismaService } from "../common/prisma.service";
import { PdfService } from "./pdf.service";
import type { CreateQuotationDto } from "./dto/create-quotation.dto";
import type { UpdateQuotationDto } from "./dto/update-quotation.dto";

const MODEL_ID = "claude-sonnet-4-6";
const SUGGEST_SYSTEM = `You are a procurement assistant for Fulfilus, an industrial supply platform.
Given a vendor's category profile and a quotation type, suggest relevant line items.
Return ONLY a valid JSON array (no markdown fences):
[{ "itemName": "...", "description": "...", "quantity": 1, "unit": "..." }]
Suggest 6-8 items. Items must be realistic for industrial procurement.`;

@Injectable()
export class QuotationService {
  private readonly logger = new Logger(QuotationService.name);
  private readonly anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
  ) {}

  async create(dto: CreateQuotationDto) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: dto.vendorId } });
    if (!vendor) throw new NotFoundException(`Vendor ${dto.vendorId} not found`);

    const referenceNumber = `QT-${Date.now().toString(36).toUpperCase()}`;

    return this.prisma.quotation.create({
      data: {
        vendorId: dto.vendorId,
        type: dto.type,
        title: dto.title,
        notes: dto.notes,
        referenceNumber,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        totalAmount: this.computeTotal(dto.lineItems ?? []),
        lineItems: {
          create: (dto.lineItems ?? []).map((item, idx) => ({
            itemName: item.itemName,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            totalPrice: this.itemTotal(item),
            aiSuggested: item.aiSuggested ?? false,
            sortOrder: item.sortOrder ?? idx,
          })),
        },
      },
      include: { lineItems: { orderBy: { sortOrder: "asc" } }, vendor: true },
    });
  }

  async findAll(vendorId: string, opts: { page?: number; limit?: number; search?: string; status?: string } = {}) {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = {
      vendorId,
      ...(opts.status ? { status: opts.status as QuotationStatus } : {}),
      ...(opts.search ? { title: { contains: opts.search, mode: "insensitive" as const } } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.quotation.findMany({
        where,
        include: { lineItems: { orderBy: { sortOrder: "asc" } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.quotation.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const q = await this.prisma.quotation.findUnique({
      where: { id },
      include: { lineItems: { orderBy: { sortOrder: "asc" } }, vendor: true },
    });
    if (!q) throw new NotFoundException(`Quotation ${id} not found`);
    return q;
  }

  async update(id: string, dto: UpdateQuotationDto) {
    await this.findOne(id);

    const sentAt = dto.status === QuotationStatus.SENT ? new Date() : undefined;

    return this.prisma.$transaction(async (tx) => {
      if (dto.lineItems !== undefined) {
        await tx.quotationLineItem.deleteMany({ where: { quotationId: id } });
      }

      return tx.quotation.update({
        where: { id },
        data: {
          ...(dto.type && { type: dto.type }),
          ...(dto.status && { status: dto.status }),
          ...(dto.title && { title: dto.title }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.validUntil !== undefined && { validUntil: dto.validUntil ? new Date(dto.validUntil) : null }),
          ...(sentAt && { sentAt }),
          ...(dto.lineItems !== undefined && {
            totalAmount: this.computeTotal(dto.lineItems),
            lineItems: {
              create: dto.lineItems.map((item, idx) => ({
                itemName: item.itemName,
                description: item.description,
                quantity: item.quantity,
                unit: item.unit,
                unitPrice: item.unitPrice,
                totalPrice: this.itemTotal(item),
                aiSuggested: item.aiSuggested ?? false,
                sortOrder: item.sortOrder ?? idx,
              })),
            },
          }),
        },
        include: { lineItems: { orderBy: { sortOrder: "asc" } }, vendor: true },
      });
    });
  }

  async remove(id: string) {
    const q = await this.findOne(id);
    if (q.status !== QuotationStatus.DRAFT) {
      throw new ConflictException("Only DRAFT quotations can be deleted");
    }
    await this.prisma.quotation.delete({ where: { id } });
  }

  async suggestItems(vendorId: string, quotationType: QuotationType): Promise<AiSuggestedItem[]> {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundException(`Vendor ${vendorId} not found`);

    const userMessage = `Vendor categories: ${vendor.categories.join(", ")}
Quotation type: ${quotationType}

Suggest 6-8 relevant items for this quotation.`;

    const msg = await this.anthropic.messages.create({
      model: MODEL_ID,
      max_tokens: 1024,
      system: [{ type: "text", text: SUGGEST_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = msg.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return [];

    try {
      const json = textBlock.text.replace(/^```(?:json)?\s*|```\s*$/g, "").trim();
      return JSON.parse(json) as AiSuggestedItem[];
    } catch (err) {
      this.logger.error(`[suggest] invalid JSON from AI: ${String(err)}`);
      return [];
    }
  }

  async generatePdf(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const quotation = await this.findOne(id);
    const buffer = await this.pdfService.generate(quotation);
    return { buffer, filename: `${quotation.referenceNumber}.pdf` };
  }

  private itemTotal(item: { quantity?: number | null; unitPrice?: number | null; totalPrice?: number | null }): number | null {
    if (item.totalPrice != null) return item.totalPrice;
    if (item.quantity != null && item.unitPrice != null) return item.quantity * item.unitPrice;
    return null;
  }

  private computeTotal(items: { quantity?: number | null; unitPrice?: number | null; totalPrice?: number | null }[]): number | null {
    const totals = items.map((i) => this.itemTotal(i));
    if (totals.every((t) => t == null)) return null;
    return totals.reduce<number>((sum, t) => sum + (t ?? 0), 0);
  }
}
