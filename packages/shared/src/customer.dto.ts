export interface CustomerDto {
  id: string;
  name: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerWithQuotesDto extends CustomerDto {
  quotes: {
    id: string;
    referenceNumber: string;
    title: string;
    status: string;
    createdAt: string;
  }[];
}

export interface CreateCustomerRequest {
  name: string;
  companyName?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstNumber?: string;
  notes?: string;
}

export interface SourcingQuoteSendDto {
  id: string;
  quoteId: string;
  method: "WHATSAPP" | "EMAIL" | "PDF_HANDOFF";
  sentBy: string;
  notes: string | null;
  createdAt: string;
}
