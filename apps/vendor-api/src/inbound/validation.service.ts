import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";

export type FlagSeverity = "error" | "warning" | "info";
export type FlagType =
  | "NO_PRICE_FOUND"
  | "STALE_PRICE"
  | "HIGH_VARIANCE"
  | "SINGLE_SOURCE"
  | "NEW_CUSTOMER"
  | "UNRECOGNIZED_NUMBER"
  | "ITEM_AMBIGUOUS";

export interface ValidationFlag {
  itemName?: string;
  flagType: FlagType;
  message: string;
  severity: FlagSeverity;
}

const STALE_DAYS = 90;
const HIGH_VARIANCE_PCT = 30;

@Injectable()
export class ValidationService {
  private readonly logger = new Logger(ValidationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async validate(quoteId: string): Promise<void> {
    const quote = await this.prisma.sourcingQuote.findUnique({
      where: { id: quoteId },
      include: {
        items: true,
        customer: true,
        inboundMessage: true,
      },
    });
    if (!quote) return;

    const flags: ValidationFlag[] = [];

    // Quote-level: unknown customer
    if (!quote.customerId) {
      flags.push({
        flagType: "UNRECOGNIZED_NUMBER",
        message: `Sender number not linked to any customer record. Verify identity before sending.`,
        severity: "error",
      });
    } else {
      // Customer-level: first time inquiry
      const priorQuotes = await this.prisma.sourcingQuote.count({
        where: { customerId: quote.customerId, id: { not: quoteId } },
      });
      if (priorQuotes === 0) {
        flags.push({
          flagType: "NEW_CUSTOMER",
          message: `First inquiry from this customer. No order history to verify against.`,
          severity: "warning",
        });
      }
    }

    // Per-item checks
    const staleThreshold = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);

    for (const item of quote.items) {
      const itemFlags = await this.checkItem(item.itemName, staleThreshold);
      flags.push(...itemFlags.map(f => ({ ...f, itemName: item.itemName })));
    }

    // Overall score: start at 100, deduct per flag
    let score = 100;
    for (const f of flags) {
      if (f.severity === "error") score -= 25;
      else if (f.severity === "warning") score -= 10;
      else score -= 3;
    }
    score = Math.max(0, Math.min(100, score));

    // Upsert validation record
    const existing = await this.prisma.quoteValidation.findUnique({ where: { quoteId } });
    if (existing) {
      await this.prisma.quoteValidation.update({
        where: { quoteId },
        data: { score, flags: flags as object[], updatedAt: new Date() },
      });
    } else {
      await this.prisma.quoteValidation.create({
        data: { quoteId, score, flags: flags as object[] },
      });
    }

    this.logger.log(`[validation] quoteId=${quoteId} score=${score} flags=${flags.length}`);
  }

  private async checkItem(itemName: string, staleThreshold: Date): Promise<Omit<ValidationFlag, "itemName">[]> {
    const flags: Omit<ValidationFlag, "itemName">[] = [];

    // Gather prices from price lists
    const lineItems = await this.prisma.quotationLineItem.findMany({
      where: {
        itemName: { contains: itemName, mode: "insensitive" },
        unitPrice: { not: null },
        quotation: { type: "PRICE_LIST" },
      },
      include: { quotation: { select: { updatedAt: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Gather prices from procurement bids
    const procItems = await this.prisma.procurementItem.findMany({
      where: { itemName: { contains: itemName, mode: "insensitive" } },
      select: { id: true },
      take: 10,
    });
    const bidPrices: { price: number; updatedAt: Date }[] = [];
    if (procItems.length > 0) {
      const itemIds = procItems.map((p: { id: string }) => p.id);
      const bids = await this.prisma.vendorBid.findMany({
        where: { status: "RECEIVED" },
        select: { lineItemPrices: true, updatedAt: true },
        take: 50,
      });
      for (const bid of bids) {
        if (!bid.lineItemPrices) continue;
        const prices = bid.lineItemPrices as Record<string, number>;
        for (const id of itemIds) {
          if (prices[id] != null) { bidPrices.push({ price: prices[id], updatedAt: bid.updatedAt }); break; }
        }
      }
    }

    const allPrices = [
      ...lineItems.map((li) => ({ price: li.unitPrice!, updatedAt: li.quotation.updatedAt })),
      ...bidPrices,
    ];

    if (allPrices.length === 0) {
      flags.push({ flagType: "NO_PRICE_FOUND", message: `No vendor prices found for "${itemName}". Manual pricing required.`, severity: "error" });
      return flags;
    }

    // Stale check
    const mostRecent = allPrices.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b));
    if (mostRecent.updatedAt < staleThreshold) {
      const days = Math.floor((Date.now() - mostRecent.updatedAt.getTime()) / 86400000);
      flags.push({ flagType: "STALE_PRICE", message: `Most recent price for "${itemName}" is ${days} days old. Verify before quoting.`, severity: "warning" });
    }

    // Single source
    const vendorCount = new Set(lineItems.map(li => li.quotation)).size + (bidPrices.length > 0 ? 1 : 0);
    if (vendorCount === 1) {
      flags.push({ flagType: "SINGLE_SOURCE", message: `Only one vendor has pricing for "${itemName}". Consider getting more quotes.`, severity: "info" });
    }

    // High variance
    const prices = allPrices.map(p => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min > 0 && (max - min) / min * 100 > HIGH_VARIANCE_PCT) {
      const spread = ((max - min) / min * 100).toFixed(0);
      flags.push({ flagType: "HIGH_VARIANCE", message: `Price spread for "${itemName}" is ${spread}% (₹${min.toFixed(2)}–₹${max.toFixed(2)}). Review before sending.`, severity: "warning" });
    }

    return flags;
  }
}
