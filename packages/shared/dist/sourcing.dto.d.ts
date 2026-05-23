export interface SourcingItemDto {
    id: string;
    quoteId: string;
    itemName: string;
    description: string | null;
    quantity: number | null;
    unit: string | null;
    costPrice: number | null;
    sourceType: string | null;
    sourceName: string | null;
    markupPct: number | null;
    sellingPrice: number | null;
    sortOrder: number;
    createdAt: string;
}
export type SourcingStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";
export interface SourcingQuoteRevisionDto {
    id: string;
    quoteId: string;
    revisionNumber: number;
    snapshot: unknown;
    createdAt: string;
}
export interface SourcingQuoteDto {
    id: string;
    referenceNumber: string;
    title: string;
    customerId: string | null;
    customer?: {
        id: string;
        name: string;
        companyName: string | null;
    } | null;
    customerName: string | null;
    customerAddress: string | null;
    customerPhone: string | null;
    customerEmail: string | null;
    customerGst: string | null;
    validUntil: string | null;
    notes: string | null;
    globalMarkupPct: number;
    status: SourcingStatus;
    sentAt: string | null;
    acceptedAt: string | null;
    rejectedAt: string | null;
    revisionNumber: number;
    items: SourcingItemDto[];
    revisions?: SourcingQuoteRevisionDto[];
    sends?: import("./customer.dto").SourcingQuoteSendDto[];
    createdAt: string;
    updatedAt: string;
}
export interface PriceSuggestion {
    vendorId: string;
    vendorName: string;
    price: number;
    unit: string | null;
    source: "PRICE_LIST" | "PROCUREMENT_BID";
    date: string;
}
export interface PriceLookupResult {
    [itemName: string]: PriceSuggestion[];
}
export interface CreateSourcingItemRequest {
    itemName: string;
    description?: string;
    quantity?: number;
    unit?: string;
    costPrice?: number;
    sourceType?: string;
    sourceName?: string;
    markupPct?: number;
    sellingPrice?: number;
    sortOrder?: number;
}
export interface CreateSourcingQuoteRequest {
    title: string;
    customerName?: string;
    customerAddress?: string;
    customerPhone?: string;
    customerEmail?: string;
    validUntil?: string;
    notes?: string;
    globalMarkupPct?: number;
    status?: SourcingStatus;
    items: CreateSourcingItemRequest[];
}
//# sourceMappingURL=sourcing.dto.d.ts.map