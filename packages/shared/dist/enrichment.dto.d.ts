import { VendorCategory } from "./enums";
export interface EnrichmentResult {
    jobId: string;
    shopName: string;
    location: string;
    shopDetails: string;
    categories: VendorCategory[];
    notes: string;
    confidence: number;
    insight: string;
    placeId: string | undefined;
    enrichedAt: string;
    modelUsed: string;
    whatsappNumber?: string;
}
//# sourceMappingURL=enrichment.dto.d.ts.map