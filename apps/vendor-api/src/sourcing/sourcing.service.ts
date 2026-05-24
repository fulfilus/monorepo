import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import PDFDocument from "pdfkit";
import { PrismaService } from "../common/prisma.service";
import { CreateSourcingQuoteDto, UpdateSourcingQuoteDto, UpdateSourcingStatusDto } from "./sourcing.dto";

export interface PriceSuggestion {
  vendorId: string;
  vendorName: string;
  price: number;
  unit: string | null;
  source: "PRICE_LIST" | "PROCUREMENT_BID" | "AGREED_RATE";
  date: string;
}

const QUOTE_INCLUDE = {
  items: { orderBy: { sortOrder: "asc" as const } },
  customer: true,
  sends: { orderBy: { createdAt: "desc" as const } },
  revisions: { orderBy: { revisionNumber: "desc" as const }, take: 20 },
};

const LIST_INCLUDE = {
  items: { orderBy: { sortOrder: "asc" as const }, select: { id: true } },
  customer: { select: { id: true, name: true, companyName: true } },
  _count: { select: { sends: true } },
};

@Injectable()
export class SourcingService {
  constructor(private readonly prisma: PrismaService) {}

  private async nextReferenceNumber(): Promise<string> {
    const ym = new Date().toISOString().substring(0, 7).replace("-", "");
    const prefix = `SQ-${ym}-`;
    const last = await this.prisma.sourcingQuote.findFirst({
      where: { referenceNumber: { startsWith: prefix } },
      orderBy: { referenceNumber: "desc" },
      select: { referenceNumber: true },
    });
    const seq = last ? parseInt(last.referenceNumber.split("-")[2]) + 1 : 1;
    return `${prefix}${String(seq).padStart(4, "0")}`;
  }

  async create(dto: CreateSourcingQuoteDto) {
    const { items, validUntil, customerId, ...meta } = dto;
    const referenceNumber = await this.nextReferenceNumber();
    return this.prisma.sourcingQuote.create({
      data: {
        ...meta,
        referenceNumber,
        globalMarkupPct: meta.globalMarkupPct ?? 15,
        validUntil: validUntil ? new Date(validUntil) : null,
        ...(customerId && { customer: { connect: { id: customerId } } }),
        items: {
          create: items.map((item, i) => ({
            ...item,
            sortOrder: item.sortOrder ?? i,
            sellingPrice: item.sellingPrice ?? this.calcSelling(item.costPrice, item.markupPct ?? meta.globalMarkupPct ?? 15),
          })),
        },
      },
      include: QUOTE_INCLUDE,
    });
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.sourcingQuote.findMany({
        skip, take: limit,
        orderBy: { createdAt: "desc" },
        include: LIST_INCLUDE,
      }),
      this.prisma.sourcingQuote.count(),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const q = await this.prisma.sourcingQuote.findUnique({
      where: { id },
      include: QUOTE_INCLUDE,
    });
    if (!q) throw new NotFoundException(`Sourcing quote ${id} not found`);
    return q;
  }

  async update(id: string, dto: UpdateSourcingQuoteDto) {
    const existing = await this.findOne(id);
    if (existing.status === "ACCEPTED") throw new BadRequestException("Cannot edit an accepted quote. Duplicate it instead.");

    // Save revision snapshot before overwriting
    await this.prisma.sourcingQuoteRevision.create({
      data: {
        quoteId: id,
        revisionNumber: existing.revisionNumber,
        snapshot: { ...existing, revisions: undefined } as object,
      },
    });

    const { items, validUntil, customerId, ...meta } = dto;
    await this.prisma.sourcingQuoteItem.deleteMany({ where: { quoteId: id } });
    return this.prisma.sourcingQuote.update({
      where: { id },
      data: {
        ...meta,
        validUntil: validUntil ? new Date(validUntil) : null,
        revisionNumber: { increment: 1 },
        ...(customerId !== undefined && {
          customer: customerId ? { connect: { id: customerId } } : { disconnect: true },
        }),
        items: {
          create: items.map((item, i) => ({
            ...item,
            sortOrder: item.sortOrder ?? i,
            sellingPrice: item.sellingPrice ?? this.calcSelling(item.costPrice, item.markupPct ?? meta.globalMarkupPct ?? 15),
          })),
        },
      },
      include: QUOTE_INCLUDE,
    });
  }

  async updateStatus(id: string, dto: UpdateSourcingStatusDto) {
    const existing = await this.findOne(id);
    const now = new Date();
    const timestamps: Record<string, Date | null> = {};

    if (dto.status === "SENT" && existing.status === "DRAFT") {
      timestamps["sentAt"] = now;
    } else if (dto.status === "ACCEPTED" && existing.status === "SENT") {
      timestamps["acceptedAt"] = now;
    } else if (dto.status === "REJECTED" && existing.status === "SENT") {
      timestamps["rejectedAt"] = now;
    } else if (dto.status === "EXPIRED") {
      // allowed from DRAFT or SENT
    } else if (dto.status === "DRAFT" && existing.status === "REJECTED") {
      // reopen
    } else {
      throw new BadRequestException(`Cannot transition from ${existing.status} to ${dto.status}`);
    }

    // Log send event when marking as SENT
    if (dto.status === "SENT" && dto.method && dto.sentBy) {
      await this.prisma.sourcingQuoteSend.create({
        data: {
          quoteId: id,
          method: dto.method,
          sentBy: dto.sentBy,
          notes: dto.sendNotes,
        },
      });
    }

    return this.prisma.sourcingQuote.update({
      where: { id },
      data: { status: dto.status, ...timestamps },
      include: QUOTE_INCLUDE,
    });
  }

  async duplicate(id: string) {
    const original = await this.findOne(id);
    const referenceNumber = await this.nextReferenceNumber();
    return this.prisma.sourcingQuote.create({
      data: {
        referenceNumber,
        title: `${original.title} (Copy)`,
        ...(original.customerId && { customer: { connect: { id: original.customerId } } }),
        customerName: original.customerName,
        customerAddress: original.customerAddress,
        customerPhone: original.customerPhone,
        customerEmail: original.customerEmail,
        customerGst: original.customerGst,
        notes: original.notes,
        globalMarkupPct: original.globalMarkupPct,
        status: "DRAFT",
        items: {
          create: original.items.map(item => ({
            itemName: item.itemName,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            costPrice: item.costPrice,
            sourceType: item.sourceType,
            sourceName: item.sourceName,
            markupPct: item.markupPct,
            sellingPrice: item.sellingPrice,
            sortOrder: item.sortOrder,
          })),
        },
      },
      include: QUOTE_INCLUDE,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.sourcingQuote.delete({ where: { id } });
  }

  async getRevisions(id: string) {
    await this.findOne(id);
    return this.prisma.sourcingQuoteRevision.findMany({
      where: { quoteId: id },
      orderBy: { revisionNumber: "desc" },
    });
  }

  @Cron(CronExpression.EVERY_HOUR)
  async expireQuotes() {
    await this.prisma.sourcingQuote.updateMany({
      where: {
        status: { in: ["DRAFT", "SENT"] },
        validUntil: { lt: new Date() },
      },
      data: { status: "EXPIRED" },
    });
  }

  async lookup(itemNames: string[]): Promise<Record<string, PriceSuggestion[]>> {
    const results: Record<string, PriceSuggestion[]> = {};

    for (const name of itemNames) {
      const suggestions: PriceSuggestion[] = [];

      // Price lists
      const lineItems = await this.prisma.quotationLineItem.findMany({
        where: {
          itemName: { contains: name, mode: "insensitive" },
          unitPrice: { not: null },
          quotation: { type: "PRICE_LIST" },
        },
        include: {
          quotation: {
            select: {
              updatedAt: true,
              vendorId: true,
              vendor: { select: { id: true, shopName: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      for (const li of lineItems) {
        suggestions.push({
          vendorId: li.quotation.vendor.id,
          vendorName: li.quotation.vendor.shopName,
          price: li.unitPrice!,
          unit: li.unit ?? null,
          source: "PRICE_LIST",
          date: li.quotation.updatedAt.toISOString(),
        });
      }

      // Historical procurement bids
      const procItems = await this.prisma.procurementItem.findMany({
        where: { itemName: { contains: name, mode: "insensitive" } },
        select: { id: true, unit: true },
        take: 10,
      });

      if (procItems.length > 0) {
        const itemIds = procItems.map((p: { id: string; unit: string | null }) => p.id);
        const unitMap = Object.fromEntries(procItems.map((p: { id: string; unit: string | null }) => [p.id, p.unit]));

        const bids = await this.prisma.vendorBid.findMany({
          where: { status: "RECEIVED" },
          include: { vendor: { select: { id: true, shopName: true } } },
          orderBy: { updatedAt: "desc" },
          take: 50,
        });

        for (const bid of bids) {
          if (bid.lineItemPrices == null) continue;
          const prices = bid.lineItemPrices as Record<string, number>;
          for (const itemId of itemIds) {
            if (prices[itemId] != null) {
              suggestions.push({
                vendorId: bid.vendor.id,
                vendorName: bid.vendor.shopName,
                price: prices[itemId],
                unit: unitMap[itemId] ?? null,
                source: "PROCUREMENT_BID",
                date: bid.updatedAt.toISOString(),
              });
              break;
            }
          }
        }
      }

      // Agreed rate contracts (ACTIVE, not expired)
      const now = new Date();
      const contracts = await this.prisma.agreedRateContract.findMany({
        where: {
          itemName: { contains: name, mode: "insensitive" },
          status: "ACTIVE",
          validFrom: { lte: now },
          OR: [{ validUntil: null }, { validUntil: { gte: now } }],
        },
        include: { vendor: { select: { id: true, shopName: true } } },
        orderBy: { unitPrice: "asc" },
      });

      for (const c of contracts) {
        suggestions.push({
          vendorId: c.vendor.id,
          vendorName: c.vendor.shopName,
          price: c.unitPrice,
          unit: c.unit ?? null,
          source: "AGREED_RATE",
          date: c.validFrom.toISOString(),
        });
      }

      // Deduplicate: prefer AGREED_RATE, then lowest price per vendor
      const best: Record<string, PriceSuggestion> = {};
      for (const s of suggestions) {
        const existing = best[s.vendorId];
        if (!existing) { best[s.vendorId] = s; continue; }
        const contractWins = s.source === "AGREED_RATE" && existing.source !== "AGREED_RATE";
        const cheaperNonContract = s.source !== "AGREED_RATE" && existing.source !== "AGREED_RATE" && s.price < existing.price;
        const cheaperContract = s.source === "AGREED_RATE" && existing.source === "AGREED_RATE" && s.price < existing.price;
        if (contractWins || cheaperNonContract || cheaperContract) best[s.vendorId] = s;
      }
      results[name] = Object.values(best).sort((a, b) => a.price - b.price);
    }

    return results;
  }

  async generatePdf(id: string, type: "customer" | "internal"): Promise<Buffer> {
    const quote = await this.findOne(id);
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      type === "customer" ? this.buildCustomerPdf(doc, quote) : this.buildInternalPdf(doc, quote);
      doc.end();
    });
  }

  private calcSelling(cost?: number | null, markup?: number | null): number | null {
    if (cost == null || cost === 0) return null;
    return Math.round(cost * (1 + (markup ?? 15) / 100) * 100) / 100;
  }

  private buildCustomerPdf(doc: PDFKit.PDFDocument, q: Awaited<ReturnType<SourcingService["findOne"]>>) {
    const blue = "#1d4ed8"; const grey = "#6b7280"; const black = "#111827";

    doc.fontSize(22).fillColor(blue).text("FULFILUS", 50, 50);
    doc.fontSize(9).fillColor(grey).text("Vendor Intelligence Platform", 50, 76);
    doc.fontSize(9).fillColor(black)
      .text(`Ref: ${q.referenceNumber}`, 400, 50, { align: "right" });
    doc.fontSize(9).fillColor(black)
      .text(`Date: ${new Date().toLocaleDateString("en-IN")}`, 400, 64, { align: "right" });
    if (q.validUntil) doc.text(`Valid until: ${new Date(q.validUntil).toLocaleDateString("en-IN")}`, 400, 78, { align: "right" });
    doc.moveTo(50, 95).lineTo(545, 95).strokeColor("#d1d5db").stroke();

    doc.y = 110;
    doc.fontSize(14).fillColor(blue).text("QUOTATION", { align: "center" });
    doc.y = 135; doc.fontSize(12).fillColor(black).text(q.title, { align: "center" });

    doc.y = 165;
    if (q.customerName) { doc.fontSize(10).fillColor(grey).text("TO"); doc.fontSize(11).fillColor(black).text(q.customerName); }
    if (q.customer?.companyName) doc.fontSize(10).fillColor(black).text(q.customer.companyName);
    if (q.customerAddress) doc.fontSize(9).fillColor(grey).text(q.customerAddress);
    if (q.customerPhone) doc.fontSize(9).text(`Phone: ${q.customerPhone}`);
    if (q.customerEmail) doc.fontSize(9).text(`Email: ${q.customerEmail}`);
    if (q.customerGst) doc.fontSize(9).text(`GST: ${q.customerGst}`);

    doc.y = Math.max(doc.y + 10, 240);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#d1d5db").stroke();
    doc.y += 8;

    const cols = { no: 50, item: 70, qty: 330, unit: 380, price: 420, total: 480 };
    doc.fontSize(9).fillColor(grey);
    doc.text("#", cols.no, doc.y); doc.text("Item", cols.item, doc.y);
    doc.text("Qty", cols.qty, doc.y); doc.text("Unit", cols.unit, doc.y);
    doc.text("Price", cols.price, doc.y); doc.text("Total", cols.total, doc.y);
    doc.y += 4; doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#e5e7eb").stroke(); doc.y += 6;

    let grandTotal = 0;
    q.items.forEach((item, i) => {
      const price = item.sellingPrice ?? 0;
      const qty = item.quantity ?? 1;
      const total = price * qty;
      grandTotal += total;
      doc.fontSize(9).fillColor(black);
      doc.text(String(i + 1), cols.no, doc.y);
      doc.text(item.itemName + (item.description ? `\n${item.description}` : ""), cols.item, doc.y, { width: 255 });
      const rowH = item.description ? 24 : 14;
      doc.text(qty % 1 === 0 ? String(qty) : qty.toFixed(2), cols.qty, doc.y);
      doc.text(item.unit ?? "", cols.unit, doc.y);
      doc.text(price > 0 ? `₹${price.toFixed(2)}` : "—", cols.price, doc.y);
      doc.text(total > 0 ? `₹${total.toFixed(2)}` : "—", cols.total, doc.y);
      doc.y += rowH;
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#f3f4f6").stroke(); doc.y += 4;
    });

    doc.y += 6;
    doc.fontSize(11).fillColor(blue).text(`Grand Total: ₹${grandTotal.toFixed(2)}`, { align: "right" });
    if (q.notes) { doc.y += 16; doc.fontSize(9).fillColor(grey).text(`Notes: ${q.notes}`); }
  }

  private buildInternalPdf(doc: PDFKit.PDFDocument, q: Awaited<ReturnType<SourcingService["findOne"]>>) {
    const blue = "#1d4ed8"; const grey = "#6b7280"; const black = "#111827"; const green = "#15803d"; const orange = "#c2410c";

    doc.fontSize(22).fillColor(blue).text("FULFILUS", 50, 50);
    doc.fontSize(9).fillColor(grey).text("Internal Cost Sheet — Confidential", 50, 76);
    doc.fontSize(9).fillColor(black).text(`Ref: ${q.referenceNumber} | Rev: ${q.revisionNumber}`, 400, 50, { align: "right" });
    doc.fontSize(9).fillColor(black).text(`Date: ${new Date().toLocaleDateString("en-IN")}`, 400, 64, { align: "right" });
    doc.moveTo(50, 95).lineTo(545, 95).strokeColor("#d1d5db").stroke();

    doc.y = 110;
    doc.fontSize(14).fillColor(orange).text("INTERNAL COST SHEET", { align: "center" });
    doc.y = 132; doc.fontSize(11).fillColor(black).text(q.title, { align: "center" });
    const custLine = [q.customerName, q.customer?.companyName].filter(Boolean).join(" / ");
    if (custLine) { doc.y += 6; doc.fontSize(9).fillColor(grey).text(`Customer: ${custLine}`, { align: "center" }); }
    if (q.customerGst) { doc.fontSize(8).fillColor(grey).text(`GST: ${q.customerGst}`, { align: "center" }); }

    doc.y = Math.max(doc.y + 14, 175);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#d1d5db").stroke(); doc.y += 8;

    const c = { no: 50, item: 68, src: 225, cost: 300, mkp: 360, sell: 405, total: 470 };
    doc.fontSize(8).fillColor(grey);
    ["#", "Item", "Source", "Cost", "Mkp%", "Sell", "Total"].forEach((h, i) => {
      doc.text(h, Object.values(c)[i], doc.y);
    });
    doc.y += 4; doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#e5e7eb").stroke(); doc.y += 6;

    let totalCost = 0; let totalSell = 0;
    q.items.forEach((item, i) => {
      const cost = item.costPrice ?? 0;
      const mkp = item.markupPct ?? q.globalMarkupPct;
      const sell = item.sellingPrice ?? (cost > 0 ? cost * (1 + mkp / 100) : 0);
      const qty = item.quantity ?? 1;
      totalCost += cost * qty; totalSell += sell * qty;

      doc.fontSize(8).fillColor(black);
      doc.text(String(i + 1), c.no, doc.y);
      doc.text(item.itemName, c.item, doc.y, { width: 152 });
      doc.fontSize(7).fillColor(grey).text(item.sourceName ?? "manual", c.src, doc.y, { width: 70 });
      doc.fontSize(8).fillColor(black).text(cost > 0 ? `₹${cost.toFixed(2)}` : "—", c.cost, doc.y);
      doc.fillColor(mkp > 20 ? green : black).text(`${mkp.toFixed(0)}%`, c.mkp, doc.y);
      doc.fillColor(black).text(sell > 0 ? `₹${sell.toFixed(2)}` : "—", c.sell, doc.y);
      doc.text(sell > 0 ? `₹${(sell * qty).toFixed(2)}` : "—", c.total, doc.y);
      doc.y += 14;
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#f3f4f6").stroke(); doc.y += 4;
    });

    doc.y += 6;
    doc.fontSize(9).fillColor(grey).text(`Total Cost: ₹${totalCost.toFixed(2)}`, c.cost, doc.y);
    doc.fontSize(11).fillColor(blue).text(`Total Selling: ₹${totalSell.toFixed(2)}`, { align: "right" });
    doc.y += 8;
    const margin = totalCost > 0 ? ((totalSell - totalCost) / totalCost * 100).toFixed(1) : "0";
    doc.fontSize(9).fillColor(green).text(`Margin: ₹${(totalSell - totalCost).toFixed(2)} (${margin}%)`, { align: "right" });
  }

  async createInvoice(quoteId: string, dueAt?: string) {
    const quote = await this.findOne(quoteId);
    if (!["ACCEPTED", "SENT"].includes(quote.status)) {
      throw new BadRequestException("Invoice can only be generated for ACCEPTED or SENT quotes");
    }
    const existing = await this.prisma.sourcingInvoice.findUnique({ where: { quoteId } });
    if (existing) return existing;

    const ym = new Date().toISOString().substring(0, 7).replace("-", "");
    const prefix = `INV-${ym}-`;
    const last = await this.prisma.sourcingInvoice.findFirst({
      where: { invoiceNumber: { startsWith: prefix } },
      orderBy: { invoiceNumber: "desc" },
      select: { invoiceNumber: true },
    });
    const seq = last ? parseInt(last.invoiceNumber.replace(prefix, ""), 10) + 1 : 1;
    const invoiceNumber = `${prefix}${String(seq).padStart(4, "0")}`;

    return this.prisma.sourcingInvoice.create({
      data: {
        quoteId,
        invoiceNumber,
        dueAt: dueAt ? new Date(dueAt) : undefined,
      },
    });
  }

  async getInvoice(quoteId: string) {
    const inv = await this.prisma.sourcingInvoice.findUnique({ where: { quoteId } });
    if (!inv) throw new NotFoundException("Invoice not found for this quote");
    return inv;
  }

  async generateInvoicePdf(quoteId: string): Promise<Buffer> {
    const quote = await this.findOne(quoteId);
    const invoice = await this.getInvoice(quoteId);
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      this.buildInvoicePdf(doc, quote, invoice);
      doc.end();
    });
  }

  private buildInvoicePdf(
    doc: PDFKit.PDFDocument,
    q: Awaited<ReturnType<SourcingService["findOne"]>>,
    inv: { invoiceNumber: string; issuedAt: Date; dueAt: Date | null },
  ) {
    const blue = "#1d4ed8"; const grey = "#6b7280"; const black = "#111827";

    doc.fontSize(22).fillColor(blue).text("FULFILUS", 50, 50);
    doc.fontSize(9).fillColor(grey).text("Vendor Intelligence Platform", 50, 76);
    doc.fontSize(9).fillColor(black).text(`Invoice: ${inv.invoiceNumber}`, 400, 50, { align: "right" });
    doc.fontSize(9).fillColor(black).text(`Issued: ${inv.issuedAt.toLocaleDateString("en-IN")}`, 400, 64, { align: "right" });
    if (inv.dueAt) doc.text(`Due: ${inv.dueAt.toLocaleDateString("en-IN")}`, 400, 78, { align: "right" });
    doc.moveTo(50, 95).lineTo(545, 95).strokeColor("#d1d5db").stroke();

    doc.y = 110;
    doc.fontSize(14).fillColor(blue).text("TAX INVOICE", { align: "center" });
    doc.y = 135; doc.fontSize(11).fillColor(black).text(q.title, { align: "center" });

    doc.y = 165;
    if (q.customerName) { doc.fontSize(10).fillColor(grey).text("BILL TO"); doc.fontSize(11).fillColor(black).text(q.customerName); }
    if (q.customer?.companyName) doc.fontSize(10).fillColor(black).text(q.customer.companyName);
    if (q.customerAddress) doc.fontSize(9).fillColor(grey).text(q.customerAddress);
    if (q.customerPhone) doc.fontSize(9).text(`Phone: ${q.customerPhone}`);
    if (q.customerGst) doc.fontSize(9).text(`GSTIN: ${q.customerGst}`);

    doc.y = Math.max(doc.y + 10, 240);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#d1d5db").stroke(); doc.y += 8;

    const cols = { no: 50, item: 70, qty: 325, unit: 375, price: 415, gst: 455, total: 490 };
    doc.fontSize(9).fillColor(grey);
    doc.text("#", cols.no, doc.y); doc.text("Item / Description", cols.item, doc.y);
    doc.text("Qty", cols.qty, doc.y); doc.text("Unit", cols.unit, doc.y);
    doc.text("Rate", cols.price, doc.y); doc.text("GST%", cols.gst, doc.y); doc.text("Amount", cols.total, doc.y);
    doc.y += 4; doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#e5e7eb").stroke(); doc.y += 6;

    let subTotal = 0; let totalGst = 0;
    q.items.forEach((item, i) => {
      const price = item.sellingPrice ?? 0;
      const qty = item.quantity ?? 1;
      const gstRate = item.gstRate ?? 0;
      const lineAmt = price * qty;
      const gstAmt = lineAmt * gstRate / 100;
      subTotal += lineAmt; totalGst += gstAmt;
      doc.fontSize(9).fillColor(black);
      doc.text(String(i + 1), cols.no, doc.y);
      doc.text(item.itemName + (item.description ? `\n${item.description}` : ""), cols.item, doc.y, { width: 250 });
      const rowH = item.description ? 24 : 14;
      doc.text(qty % 1 === 0 ? String(qty) : qty.toFixed(2), cols.qty, doc.y);
      doc.text(item.unit ?? "", cols.unit, doc.y);
      doc.text(price > 0 ? `₹${price.toFixed(2)}` : "—", cols.price, doc.y);
      doc.text(gstRate > 0 ? `${gstRate}%` : "—", cols.gst, doc.y);
      doc.text(lineAmt > 0 ? `₹${lineAmt.toFixed(2)}` : "—", cols.total, doc.y);
      doc.y += rowH;
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#f3f4f6").stroke(); doc.y += 4;
    });

    doc.y += 6;
    doc.fontSize(9).fillColor(grey).text(`Subtotal: ₹${subTotal.toFixed(2)}`, { align: "right" });
    if (totalGst > 0) { doc.y += 4; doc.text(`GST: ₹${totalGst.toFixed(2)}`, { align: "right" }); }
    doc.y += 4;
    doc.fontSize(12).fillColor(blue).text(`Total: ₹${(subTotal + totalGst).toFixed(2)}`, { align: "right" });
    if (q.notes) { doc.y += 16; doc.fontSize(9).fillColor(grey).text(`Notes: ${q.notes}`); }
    doc.y += 20; doc.fontSize(8).fillColor(grey).text("This is a computer-generated invoice.", { align: "center" });
  }
}
