export type ProcurementStatus = "OPEN" | "COMPARING" | "AWARDED" | "CLOSED";
export type BidStatus = "PENDING" | "SENT" | "RECEIVED" | "DECLINED";

export interface ProcurementItemDto {
  id: string;
  itemName: string;
  description?: string | null;
  quantity?: number | null;
  unit?: string | null;
  targetPrice?: number | null;
  sortOrder: number;
}

export interface VendorBidDto {
  id: string;
  vendorId: string;
  roundId: string;
  status: BidStatus;
  lineItemPrices: Record<string, number> | null;
  notes: string | null;
  quotationId?: string | null;
  vendor: { id: string; shopName: string; whatsappNumber?: string };
  quotation?: { id: string; referenceNumber: string; status: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProcurementRoundDto {
  id: string;
  title: string;
  status: ProcurementStatus;
  notes: string | null;
  items: ProcurementItemDto[];
  vendorBids: VendorBidDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ProcurementTemplateItemDto {
  itemName: string;
  description?: string | null;
  quantity?: number | null;
  unit?: string | null;
  targetPrice?: number | null;
  sortOrder: number;
}

export interface ProcurementRoundTemplateDto {
  id: string;
  title: string;
  notes: string | null;
  items: ProcurementTemplateItemDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ComparisonRowDto {
  itemId: string;
  itemName: string;
  quantity: number | null;
  unit: string | null;
  targetPrice: number | null;
  prices: Record<string, number | null>;
  lowestPrice: number | null;
  lowestVendorId: string | null;
}

export interface ComparisonVendorDto {
  bidId: string;
  vendorId: string;
  shopName: string;
  status: BidStatus;
  total: number;
  coverage: number;
  totalItems: number;
}

export interface ComparisonResultDto {
  roundId: string;
  title: string;
  status: ProcurementStatus;
  items: ComparisonRowDto[];
  vendors: ComparisonVendorDto[];
  suggestedSplit: Record<string, string>;
}
