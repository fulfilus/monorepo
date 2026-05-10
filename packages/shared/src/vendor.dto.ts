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
  payment: PaymentDto | null;
  bankAccount: BankAccountDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiMetadata {
  confidenceScore: number;
  source: string;
  modelId: string;
  generatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
