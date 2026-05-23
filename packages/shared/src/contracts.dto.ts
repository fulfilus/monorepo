export type ContractStatus = "ACTIVE" | "EXPIRED" | "CANCELLED";

export interface AgreedRateContractDto {
  id: string;
  vendorId: string;
  itemName: string;
  unitPrice: number;
  unit: string | null;
  minQty: number | null;
  tolerancePct: number;
  validFrom: string;
  validUntil: string | null;
  notes: string | null;
  status: ContractStatus;
  vendor: { id: string; shopName: string };
  createdAt: string;
  updatedAt: string;
}
