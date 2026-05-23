import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";
import { WhatsappService } from "../whatsapp/whatsapp.service";
import { AddVendorBidDto, AwardDto, AwardType, CreateProcurementDto, CreateTemplateDto, UpdateBidDto, UseTemplateDto } from "./procurement.dto";

@Injectable()
export class ProcurementService {
  private readonly logger = new Logger(ProcurementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
  ) {}

  async create(dto: CreateProcurementDto) {
    return this.prisma.procurementRound.create({
      data: {
        title: dto.title,
        notes: dto.notes,
        items: {
          create: dto.items.map((item, i) => ({
            itemName: item.itemName,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            targetPrice: item.targetPrice,
            barcode: item.barcode,
            sortOrder: item.sortOrder ?? i,
          })),
        },
      },
      include: { items: { orderBy: { sortOrder: "asc" } }, vendorBids: true },
    });
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.procurementRound.findMany({
        skip, take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          items: { orderBy: { sortOrder: "asc" } },
          vendorBids: { include: { vendor: { select: { id: true, shopName: true } } } },
        },
      }),
      this.prisma.procurementRound.count(),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const round = await this.prisma.procurementRound.findUnique({
      where: { id },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        vendorBids: {
          include: {
            vendor: { select: { id: true, shopName: true, whatsappNumber: true, categories: true } },
            quotation: { select: { id: true, referenceNumber: true, status: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!round) throw new NotFoundException(`Procurement round ${id} not found`);
    return round;
  }

  async addVendor(roundId: string, dto: AddVendorBidDto) {
    await this.findOne(roundId);
    const existing = await this.prisma.vendorBid.findFirst({ where: { roundId, vendorId: dto.vendorId } });
    if (existing) throw new BadRequestException("Vendor already added to this round");

    return this.prisma.vendorBid.create({
      data: { roundId, vendorId: dto.vendorId, quotationId: dto.quotationId },
      include: { vendor: { select: { id: true, shopName: true, whatsappNumber: true } } },
    });
  }

  async updateBid(roundId: string, bidId: string, dto: UpdateBidDto) {
    const bid = await this.prisma.vendorBid.findFirst({ where: { id: bidId, roundId } });
    if (!bid) throw new NotFoundException("Bid not found");

    return this.prisma.vendorBid.update({
      where: { id: bidId },
      data: {
        ...(dto.lineItemPrices !== undefined ? { lineItemPrices: dto.lineItemPrices } : {}),
        ...(dto.status ? { status: dto.status as never } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.quotationId !== undefined ? { quotationId: dto.quotationId } : {}),
      },
      include: { vendor: { select: { id: true, shopName: true } } },
    });
  }

  async removeVendor(roundId: string, bidId: string) {
    const bid = await this.prisma.vendorBid.findFirst({ where: { id: bidId, roundId } });
    if (!bid) throw new NotFoundException("Bid not found");
    await this.prisma.vendorBid.delete({ where: { id: bidId } });
  }

  async blastRfq(roundId: string): Promise<{ sent: string[]; skipped: string[]; failed: string[] }> {
    const round = await this.findOne(roundId);
    if (round.status !== "OPEN") throw new BadRequestException("Can only blast RFQ for OPEN rounds");

    const itemLines = round.items.map((item, i) => {
      let line = `${i + 1}. ${item.itemName}`;
      if (item.quantity) line += ` x${item.quantity}`;
      if (item.unit) line += ` ${item.unit}`;
      if (item.targetPrice) line += ` (target: ₹${item.targetPrice})`;
      return line;
    }).join("\n");

    const message =
      `*RFQ: ${round.title}*\n\n` +
      `Fulfilus is requesting your best prices for the following items:\n\n` +
      `${itemLines}\n\n` +
      (round.notes ? `Notes: ${round.notes}\n\n` : "") +
      `Please reply with your prices for each item. Thank you!`;

    const sent: string[] = [];
    const skipped: string[] = [];
    const failed: string[] = [];

    for (const bid of round.vendorBids) {
      if (bid.status === "DECLINED") { skipped.push(bid.id); continue; }
      const phone = bid.vendor.whatsappNumber;
      if (!phone) { skipped.push(bid.id); continue; }

      try {
        await this.whatsapp.sendMessage(phone, message);
        await this.prisma.vendorBid.update({ where: { id: bid.id }, data: { status: "SENT" } });
        sent.push(bid.id);
        this.logger.log(`[rfq-blast] sent to ${bid.vendor.shopName} (${phone})`);
      } catch (err) {
        this.logger.error(`[rfq-blast] failed for ${bid.vendor.shopName}: ${String(err)}`);
        failed.push(bid.id);
      }
    }

    return { sent, skipped, failed };
  }

  async getComparison(roundId: string) {
    const round = await this.findOne(roundId);
    const { items, vendorBids } = round;

    const matrix = items.map(item => {
      const prices: Record<string, number | null> = {};
      let lowestPrice: number | null = null;
      let lowestVendorId: string | null = null;

      for (const bid of vendorBids) {
        if (bid.status === "DECLINED") continue;
        const priceMap = bid.lineItemPrices as Record<string, number> | null ?? {};
        const price = priceMap[item.id] ?? null;
        prices[bid.vendorId] = price;
        if (price !== null && (lowestPrice === null || price < lowestPrice)) {
          lowestPrice = price;
          lowestVendorId = bid.vendorId;
        }
      }

      return {
        itemId: item.id,
        itemName: item.itemName,
        quantity: item.quantity,
        unit: item.unit,
        targetPrice: item.targetPrice,
        prices,
        lowestPrice,
        lowestVendorId,
      };
    });

    const vendorTotals: Record<string, number> = {};
    const vendorCoverage: Record<string, number> = {};
    for (const bid of vendorBids) {
      if (bid.status === "DECLINED") continue;
      const priceMap = bid.lineItemPrices as Record<string, number> | null ?? {};
      let total = 0;
      let covered = 0;
      for (const item of items) {
        const price = priceMap[item.id];
        if (price != null) {
          total += price * (item.quantity ?? 1);
          covered++;
        }
      }
      vendorTotals[bid.vendorId] = total;
      vendorCoverage[bid.vendorId] = covered;
    }

    const suggestedSplit: Record<string, string> = {};
    for (const row of matrix) {
      if (row.lowestVendorId) suggestedSplit[row.itemId] = row.lowestVendorId;
    }

    return {
      roundId,
      title: round.title,
      status: round.status,
      items: matrix,
      vendors: vendorBids
        .filter(b => b.status !== "DECLINED")
        .map(b => ({
          bidId: b.id,
          vendorId: b.vendorId,
          shopName: b.vendor.shopName,
          status: b.status,
          total: vendorTotals[b.vendorId] ?? 0,
          coverage: vendorCoverage[b.vendorId] ?? 0,
          totalItems: items.length,
        })),
      suggestedSplit,
    };
  }

  async award(roundId: string, dto: AwardDto) {
    const round = await this.findOne(roundId);
    const { items, vendorBids } = round;

    if (dto.type === AwardType.SINGLE) {
      const bid = vendorBids.find(b => b.vendorId === dto.singleVendorId);
      if (!bid) throw new BadRequestException("Vendor not in this round");

      const priceMap = bid.lineItemPrices as Record<string, number> | null ?? {};
      const lineItems = items.map((item, i) => ({
        itemName: item.itemName,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: priceMap[item.id] ?? null,
        totalPrice: priceMap[item.id] != null ? (item.quantity ?? 1) * priceMap[item.id] : null,
        sortOrder: i,
      }));

      const quotation = await this.createPOQuote(bid.vendorId, `Award: ${round.title}`, lineItems);
      await this.prisma.procurementRound.update({ where: { id: roundId }, data: { status: "AWARDED" } });
      return { type: "SINGLE", quotations: [quotation] };
    }

    // SPLIT — one PO quote per vendor for their awarded items
    const itemAwards: Record<string, { vendorId: string; price: number }> = {};
    for (const item of items) {
      let lowest: { vendorId: string; price: number } | null = null;
      for (const bid of vendorBids) {
        if (bid.status === "DECLINED") continue;
        const priceMap = bid.lineItemPrices as Record<string, number> | null ?? {};
        const price = priceMap[item.id];
        if (price != null && (lowest === null || price < lowest.price)) {
          lowest = { vendorId: bid.vendorId, price };
        }
      }
      if (lowest) itemAwards[item.id] = lowest;
    }

    const byVendor: Record<string, { item: typeof items[0]; price: number }[]> = {};
    for (const [itemId, award] of Object.entries(itemAwards)) {
      const item = items.find(i => i.id === itemId)!;
      if (!byVendor[award.vendorId]) byVendor[award.vendorId] = [];
      byVendor[award.vendorId].push({ item, price: award.price });
    }

    const quotations = await Promise.all(
      Object.entries(byVendor).map(([vendorId, awarded], idx) =>
        this.createPOQuote(
          vendorId,
          `${round.title} — Split Award ${idx + 1}`,
          awarded.map((a, i) => ({
            itemName: a.item.itemName,
            description: a.item.description,
            quantity: a.item.quantity,
            unit: a.item.unit,
            unitPrice: a.price,
            totalPrice: (a.item.quantity ?? 1) * a.price,
            sortOrder: i,
          })),
        )
      )
    );

    await this.prisma.procurementRound.update({ where: { id: roundId }, data: { status: "AWARDED" } });
    return { type: "SPLIT", quotations };
  }

  async getVendorScorecard() {
    // Fetch all bids with round items (needed for competitiveness) and vendor info
    const allBids = await this.prisma.vendorBid.findMany({
      include: {
        vendor: { select: { id: true, shopName: true } },
        round: { include: { items: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Group bids by roundId to compute price competitiveness
    const byRound = new Map<string, typeof allBids>();
    for (const bid of allBids) {
      const arr = byRound.get(bid.roundId) ?? [];
      arr.push(bid);
      byRound.set(bid.roundId, arr);
    }

    // Compute per-vendor stats
    const vendorStats = new Map<string, {
      vendorId: string;
      shopName: string;
      totalBids: number;
      sentBids: number;
      receivedBids: number;
      wonBids: number;
      competitiveRounds: number;
      totalRounds: number;
    }>();

    for (const bid of allBids) {
      const s = vendorStats.get(bid.vendorId) ?? {
        vendorId: bid.vendorId,
        shopName: bid.vendor.shopName,
        totalBids: 0, sentBids: 0, receivedBids: 0, wonBids: 0,
        competitiveRounds: 0, totalRounds: 0,
      };
      s.totalBids++;
      if (bid.status === "SENT" || bid.status === "RECEIVED") s.sentBids++;
      if (bid.status === "RECEIVED") s.receivedBids++;
      if (bid.quotationId) s.wonBids++;
      vendorStats.set(bid.vendorId, s);
    }

    // Compute price competitiveness per vendor per round
    for (const [, roundBids] of byRound) {
      if (roundBids.length === 0) continue;
      const items = roundBids[0].round.items;
      const vendorsInRound = new Set(roundBids.map(b => b.vendorId));

      // For each vendor in this round, check if they have the lowest price on any item
      for (const vendorId of vendorsInRound) {
        const s = vendorStats.get(vendorId);
        if (!s) continue;
        s.totalRounds++;

        const vendorBid = roundBids.find(b => b.vendorId === vendorId);
        if (!vendorBid) continue;
        const vendorPrices = vendorBid.lineItemPrices as Record<string, number> | null ?? {};

        let isCompetitive = false;
        for (const item of items) {
          const myPrice = vendorPrices[item.id];
          if (myPrice == null) continue;
          const isLowest = roundBids.every(b => {
            if (b.vendorId === vendorId || b.status === "DECLINED") return true;
            const otherPrices = b.lineItemPrices as Record<string, number> | null ?? {};
            const otherPrice = otherPrices[item.id];
            return otherPrice == null || myPrice <= otherPrice;
          });
          if (isLowest) { isCompetitive = true; break; }
        }
        if (isCompetitive) s.competitiveRounds++;
      }
    }

    return Array.from(vendorStats.values())
      .map(s => {
        const responseRate = s.sentBids > 0 ? Math.round((s.receivedBids / s.sentBids) * 100) : null;
        const winRate = s.receivedBids > 0 ? Math.round((s.wonBids / s.receivedBids) * 100) : null;
        const priceCompetitiveness = s.totalRounds > 0 ? Math.round((s.competitiveRounds / s.totalRounds) * 100) : null;
        const compositeScore = [responseRate, winRate, priceCompetitiveness].every(v => v !== null)
          ? Math.round((responseRate! * 0.3 + winRate! * 0.4 + priceCompetitiveness! * 0.3))
          : null;
        return {
          vendorId: s.vendorId,
          shopName: s.shopName,
          totalRounds: s.totalRounds,
          sentBids: s.sentBids,
          receivedBids: s.receivedBids,
          wonBids: s.wonBids,
          responseRate,
          winRate,
          priceCompetitiveness,
          compositeScore,
        };
      })
      .sort((a, b) => (b.compositeScore ?? -1) - (a.compositeScore ?? -1));
  }

  async getPriceHistory(itemName: string) {
    const items = await this.prisma.procurementItem.findMany({
      where: { itemName: { contains: itemName, mode: "insensitive" } },
      include: { round: { select: { id: true, title: true, status: true, createdAt: true } } },
      orderBy: { round: { createdAt: "asc" } },
    });

    if (items.length === 0) return { itemName, rounds: [], vendors: [] };

    const roundIds = [...new Set(items.map(i => i.roundId))];
    const bids = await this.prisma.vendorBid.findMany({
      where: { roundId: { in: roundIds }, status: { not: "DECLINED" } },
      include: { vendor: { select: { id: true, shopName: true } } },
    });

    // Deduplicate rounds preserving order
    const seenRounds = new Set<string>();
    const rounds: { id: string; title: string; status: string; createdAt: Date }[] = [];
    for (const item of items) {
      if (!seenRounds.has(item.roundId)) {
        seenRounds.add(item.roundId);
        rounds.push(item.round);
      }
    }

    // Build itemId → roundId map
    const itemToRound: Record<string, string> = {};
    for (const item of items) itemToRound[item.id] = item.roundId;

    // Collect unique vendors
    const vendorMap = new Map<string, { vendorId: string; shopName: string }>();
    for (const bid of bids) {
      if (!vendorMap.has(bid.vendorId)) {
        vendorMap.set(bid.vendorId, { vendorId: bid.vendorId, shopName: bid.vendor.shopName });
      }
    }

    // Build per-vendor price arrays indexed to rounds
    const roundIndex = new Map(rounds.map((r, i) => [r.id, i]));
    const vendors = Array.from(vendorMap.values()).map(v => {
      const prices: (number | null)[] = new Array(rounds.length).fill(null);
      for (const bid of bids) {
        if (bid.vendorId !== v.vendorId) continue;
        const priceMap = bid.lineItemPrices as Record<string, number> | null ?? {};
        for (const item of items) {
          if (item.roundId !== bid.roundId) continue;
          const price = priceMap[item.id] ?? null;
          if (price !== null) {
            const idx = roundIndex.get(bid.roundId);
            if (idx !== undefined) prices[idx] = price;
          }
        }
      }
      return { ...v, prices };
    });

    return { itemName, rounds, vendors };
  }

  async listTemplates() {
    return this.prisma.procurementRoundTemplate.findMany({ orderBy: { updatedAt: "desc" } });
  }

  async createTemplate(dto: CreateTemplateDto) {
    const items = dto.items.map(i => ({ ...i }));
    return this.prisma.procurementRoundTemplate.create({
      data: { title: dto.title, notes: dto.notes, items },
    });
  }

  async deleteTemplate(templateId: string) {
    const t = await this.prisma.procurementRoundTemplate.findUnique({ where: { id: templateId } });
    if (!t) throw new NotFoundException(`Template ${templateId} not found`);
    await this.prisma.procurementRoundTemplate.delete({ where: { id: templateId } });
  }

  async saveRoundAsTemplate(roundId: string) {
    const round = await this.findOne(roundId);
    const items = round.items.map(({ itemName, description, quantity, unit, targetPrice, sortOrder }) => ({
      itemName, description, quantity, unit, targetPrice, sortOrder,
    }));
    return this.prisma.procurementRoundTemplate.create({
      data: { title: round.title, notes: round.notes, items },
    });
  }

  async useTemplate(templateId: string, dto: UseTemplateDto) {
    const template = await this.prisma.procurementRoundTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new NotFoundException(`Template ${templateId} not found`);
    const items = template.items as { itemName: string; description?: string; quantity?: number; unit?: string; targetPrice?: number; sortOrder: number }[];
    const round = await this.create({
      title: dto.title ?? template.title,
      notes: template.notes ?? undefined,
      items,
    });
    await this.prisma.procurementRound.update({ where: { id: round.id }, data: { templateId } });
    return round;
  }

  async barcodeLookup(barcode: string) {
    const byBarcode = await this.prisma.procurementItem.findFirst({
      where: { barcode },
      orderBy: { round: { createdAt: "desc" } },
      select: { itemName: true, description: true, unit: true, targetPrice: true, hsnCode: true, gstRate: true, barcode: true },
    });
    if (byBarcode) return { found: true, ...byBarcode };

    const byName = await this.prisma.quotationLineItem.findFirst({
      where: { itemName: { contains: barcode, mode: "insensitive" } },
      orderBy: { createdAt: "desc" },
      select: { itemName: true, description: true, unit: true, hsnCode: true, gstRate: true },
    });
    if (byName) return { found: true, itemName: byName.itemName, description: byName.description, unit: byName.unit, hsnCode: byName.hsnCode, gstRate: byName.gstRate, targetPrice: null, barcode };

    return { found: false, barcode, itemName: null, description: null, unit: null, hsnCode: null, gstRate: null, targetPrice: null };
  }

  async getPoQuotation(roundId: string, quotationId: string) {
    return this.prisma.quotation.findFirst({
      where: { id: quotationId, type: "PO_QUOTE" },
      include: {
        lineItems: { orderBy: { sortOrder: "asc" } },
        vendor: true,
      },
    });
  }

  private async nextPoReference(): Promise<string> {
    const prefix = `PO-${new Date().toISOString().slice(0, 7).replace("-", "")}`;
    const last = await this.prisma.quotation.findFirst({
      where: { referenceNumber: { startsWith: prefix }, type: "PO_QUOTE" },
      orderBy: { referenceNumber: "desc" },
      select: { referenceNumber: true },
    });
    const seq = last ? parseInt(last.referenceNumber.split("-")[2] ?? "0", 10) + 1 : 1;
    return `${prefix}-${String(seq).padStart(4, "0")}`;
  }

  private async createPOQuote(
    vendorId: string,
    title: string,
    lineItems: { itemName: string; description?: string | null; quantity?: number | null; unit?: string | null; unitPrice?: number | null; totalPrice?: number | null; sortOrder: number }[],
  ) {
    const ref = await this.nextPoReference();
    const totalAmount = lineItems.reduce((s, i) => s + (i.totalPrice ?? 0), 0);
    return this.prisma.quotation.create({
      data: {
        vendorId,
        type: "PO_QUOTE",
        status: "DRAFT",
        referenceNumber: ref,
        title,
        totalAmount,
        lineItems: { create: lineItems },
      },
      select: { id: true, referenceNumber: true, vendorId: true, totalAmount: true },
    });
  }
}
