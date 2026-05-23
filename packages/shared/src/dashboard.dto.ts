export interface DashboardResponseDto {
  totalVendors: number;
  contactedCount: number;
  notContactedCount: number;
  enrichedCount: number;
  enrichmentCoveragePct: number;
  categoryBreakdown: Array<{ category: string; count: number }>;
  quotationFunnel: Array<{ status: string; count: number }>;
  recentVendors: Array<{ id: string; shopName: string; contactStatus: string; createdAt: string }>;
}
