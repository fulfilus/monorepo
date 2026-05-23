import { Injectable } from "@nestjs/common";
import { PrismaService } from "../common/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

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
