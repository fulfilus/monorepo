import { VendorCategory } from "./enums";
export interface EnrichedProduct {
    name: string;
    priceRange?: string;
    moq?: string;
    unit?: string;
    specs?: string;
}
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
    /** Product names — quick list */
    items?: string[];
    /** Structured product catalog with price/MOQ/specs */
    products?: EnrichedProduct[];
    /** Which enrichment sources contributed to this result */
    sources?: string[];
}
//# sourceMappingURL=enrichment.dto.d.ts.map