import { QuotationStatus, QuotationType } from "./enums";
export interface LineItemDto {
    id?: string;
    itemName: string;
    description?: string | null;
    quantity?: number | null;
    unit?: string | null;
    unitPrice?: number | null;
    totalPrice?: number | null;
    aiSuggested?: boolean;
    sortOrder?: number;
}
export interface CreateQuotationDto {
    vendorId: string;
    type: QuotationType;
    title: string;
    notes?: string;
    validUntil?: string;
    lineItems?: LineItemDto[];
}
export interface UpdateQuotationDto {
    type?: QuotationType;
    status?: QuotationStatus;
    title?: string;
    notes?: string;
    validUntil?: string;
    lineItems?: LineItemDto[];
}
export interface QuotationResponseDto {
    id: string;
    vendorId: string;
    type: QuotationType;
    status: QuotationStatus;
    referenceNumber: string;
    title: string;
    notes: string | null;
    validUntil: string | null;
    sentAt: string | null;
    lineItems: LineItemDto[];
    totalAmount: number | null;
    createdAt: string;
    updatedAt: string;
}
export interface PaginatedQuotationResponse {
    data: QuotationResponseDto[];
    total: number;
    page: number;
    limit: number;
}
export interface QuotationTemplateResponseDto {
    id: string;
    title: string;
    type: QuotationType;
    notes: string | null;
    lineItems: LineItemDto[];
    createdAt: string;
}
export interface AiSuggestedItem {
    itemName: string;
    description: string;
    quantity: number;
    unit: string;
}
//# sourceMappingURL=quotation.dto.d.ts.map