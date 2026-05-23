export interface SpendByMonthDto {
    month: string;
    total: number;
}
export interface SpendByVendorDto {
    vendorId: string;
    shopName: string;
    total: number;
    pct: number;
}
export interface SpendByCategoryDto {
    category: string;
    total: number;
    pct: number;
}
export interface SpendAnalyticsDto {
    totalSpend: number;
    byMonth: SpendByMonthDto[];
    byVendor: SpendByVendorDto[];
    byCategory: SpendByCategoryDto[];
}
export interface DashboardResponseDto {
    totalVendors: number;
    contactedCount: number;
    notContactedCount: number;
    enrichedCount: number;
    enrichmentCoveragePct: number;
    categoryBreakdown: Array<{
        category: string;
        count: number;
    }>;
    quotationFunnel: Array<{
        status: string;
        count: number;
    }>;
    recentVendors: Array<{
        id: string;
        shopName: string;
        contactStatus: string;
        createdAt: string;
    }>;
}
//# sourceMappingURL=dashboard.dto.d.ts.map