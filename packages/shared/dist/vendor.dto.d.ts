import { ContactStatus, PaymentType, VendorCategory } from "./enums";
export interface CreateVendorDto {
    shopName: string;
    shopDetails?: string;
    location: string;
    whatsappNumber: string;
    gstNumber?: string;
    contactStatus: ContactStatus;
    notes?: string;
    categories: VendorCategory[];
    payment: PaymentDto;
}
export interface PaymentDto {
    type: PaymentType;
    value: string;
}
export interface BankAccountDto {
    accountNumber: string;
    ifscCode: string;
    accountHolder: string;
    bankName: string;
}
export interface VendorDeliveryDto {
    deliversOwn: boolean;
    thirdPartyPickup: boolean;
    coverageArea: string | null;
    minOrderAmount: number | null;
    deliveryCharge: number | null;
    chargeNotes: string | null;
}
export interface VendorResponseDto {
    id: string;
    shopName: string;
    shopDetails: string | null;
    location: string;
    whatsappNumber: string;
    gstNumber: string | null;
    contactStatus: ContactStatus;
    notes: string | null;
    categories: VendorCategory[];
    shopPhotoUrl: string | null;
    placeId: string | null;
    rating: number | null;
    confidenceScore: number | null;
    payment: PaymentDto | null;
    bankAccount: BankAccountDto | null;
    delivery: VendorDeliveryDto | null;
    createdAt: string;
    updatedAt: string;
}
export interface AiMetadata {
    confidenceScore: number;
    source: string;
    modelId: string;
    generatedAt: string;
}
export interface DocumentResponseDto {
    id: string;
    vendorId: string;
    type: string;
    url: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
}
export interface AuditLogResponseDto {
    id: string;
    action: string;
    changedBy: string;
    diff: Record<string, unknown> | null;
    createdAt: string;
}
export type ContactLogType = "CALL" | "WHATSAPP" | "VISIT" | "EMAIL";
export interface ContactLogResponseDto {
    id: string;
    type: ContactLogType;
    notes: string | null;
    contactedBy: string;
    contactedAt: string;
}
export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}
//# sourceMappingURL=vendor.dto.d.ts.map