import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSpendAnalytics() {
    const poQuotes = await this.prisma.quotation.findMany({
      where: { type: "PO_QUOTE", totalAmount: { not: null } },
      include: { vendor: { select: { id: true, shopName: true, categories: true } } },
      orderBy: { createdAt: "asc" },
    });

    if (poQuotes.length === 0) {
      return { totalSpend: 0, byMonth: [], byVendor: [], byCategory: [] };
    }

    const totalSpend = poQuotes.reduce((s, q) => s + (q.totalAmount ?? 0), 0);

    // By month
    const monthMap = new Map<string, number>();
    for (const q of poQuotes) {
      const month = q.createdAt.toISOString().slice(0, 7);
      monthMap.set(month, (monthMap.get(month) ?? 0) + (q.totalAmount ?? 0));
    }
    const byMonth = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, total: Math.round(total * 100) / 100 }));

    // By vendor
    const vendorMap = new Map<string, { shopName: string; total: number }>();
    for (const q of poQuotes) {
      const v = vendorMap.get(q.vendorId) ?? { shopName: q.vendor.shopName, total: 0 };
      v.total += q.totalAmount ?? 0;
      vendorMap.set(q.vendorId, v);
    }
    const byVendor = Array.from(vendorMap.entries())
      .map(([vendorId, v]) => ({
        vendorId,
        shopName: v.shopName,
        total: Math.round(v.total * 100) / 100,
        pct: Math.round((v.total / totalSpend) * 100),
      }))
      .sort((a, b) => b.total - a.total);

    // By category (vendor categories × spend)
    const catMap = new Map<string, number>();
    for (const q of poQuotes) {
      const cats = q.vendor.categories;
      if (cats.length === 0) { catMap.set("UNCATEGORIZED", (catMap.get("UNCATEGORIZED") ?? 0) + (q.totalAmount ?? 0)); }
      else {
        const share = (q.totalAmount ?? 0) / cats.length;
        for (const cat of cats) { catMap.set(cat, (catMap.get(cat) ?? 0) + share); }
      }
    }
    const byCategory = Array.from(catMap.entries())
      .map(([category, total]) => ({
        category,
        total: Math.round(total * 100) / 100,
        pct: Math.round((total / totalSpend) * 100),
      }))
      .sort((a, b) => b.total - a.total);

    return { totalSpend: Math.round(totalSpend * 100) / 100, byMonth, byVendor, byCategory };
  }

  async getSummary() {
    const [totalVendors, contactedCount, enrichedCount, categoryCounts, recentVendors] =
      await this.prisma.$transaction([
        this.prisma.vendor.count(),
        this.prisma.vendor.count({ where: { contactStatus: "CONTACTED" } }),
        this.prisma.vendor.count({ where: { enrichmentJobs: { some: { status: "COMPLETED" } } } }),
        this.prisma.vendor.findMany({ select: { categories: true } }),
        this.prisma.vendor.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, shopName: true, contactStatus: true, createdAt: true },
        }),
      ]);

    const quotationStatusCounts = await this.prisma.quotation.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    const categoryMap: Record<string, number> = {};
    for (const v of categoryCounts) {
      for (const cat of v.categories) {
        categoryMap[cat] = (categoryMap[cat] ?? 0) + 1;
      }
    }

    return {
      totalVendors,
      contactedCount,
      notContactedCount: totalVendors - contactedCount,
      enrichedCount,
      enrichmentCoveragePct: totalVendors > 0 ? Math.round((enrichedCount / totalVendors) * 100) : 0,
      categoryBreakdown: Object.entries(categoryMap)
        .sort((a, b) => b[1] - a[1])
        .map(([category, count]) => ({ category, count })),
      quotationFunnel: quotationStatusCounts.map(s => ({ status: s.status, count: s._count._all })),
      recentVendors,
    };
  }
}
