import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { ComparisonResultDto, ProcurementRoundDto, ProcurementRoundTemplateDto, ProcurementTemplateItemDto, VendorBidDto } from "@fulfilus/shared";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class ProcurementService {
  private readonly base = `${environment.apiUrl}/procurement`;

  constructor(private readonly http: HttpClient) {}

  create(title: string, notes: string, items: { itemName: string; description?: string; quantity?: number; unit?: string; targetPrice?: number }[]): Observable<ProcurementRoundDto> {
    return this.http.post<ProcurementRoundDto>(this.base, { title, notes, items });
  }

  list(page = 1, limit = 20): Observable<{ data: ProcurementRoundDto[]; total: number; page: number; limit: number }> {
    const params = new HttpParams().set("page", page).set("limit", limit);
    return this.http.get<{ data: ProcurementRoundDto[]; total: number; page: number; limit: number }>(this.base, { params });
  }

  getOne(id: string): Observable<ProcurementRoundDto> {
    return this.http.get<ProcurementRoundDto>(`${this.base}/${id}`);
  }

  addVendor(roundId: string, vendorId: string, quotationId?: string): Observable<VendorBidDto> {
    return this.http.post<VendorBidDto>(`${this.base}/${roundId}/vendors`, { vendorId, quotationId });
  }

  updateBid(roundId: string, bidId: string, payload: { lineItemPrices?: Record<string, number>; status?: string; notes?: string; quotationId?: string }): Observable<VendorBidDto> {
    return this.http.put<VendorBidDto>(`${this.base}/${roundId}/vendors/${bidId}`, payload);
  }

  removeVendor(roundId: string, bidId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${roundId}/vendors/${bidId}`);
  }

  getComparison(roundId: string): Observable<ComparisonResultDto> {
    return this.http.get<ComparisonResultDto>(`${this.base}/${roundId}/comparison`);
  }

  blastRfq(roundId: string): Observable<{ sent: string[]; skipped: string[]; failed: string[] }> {
    return this.http.post<{ sent: string[]; skipped: string[]; failed: string[] }>(`${this.base}/${roundId}/blast`, {});
  }

  award(roundId: string, type: "SPLIT" | "SINGLE", singleVendorId?: string): Observable<{ type: string; quotations: { id: string; referenceNumber: string; vendorId: string; totalAmount: number }[] }> {
    return this.http.post<{ type: string; quotations: { id: string; referenceNumber: string; vendorId: string; totalAmount: number }[] }>(`${this.base}/${roundId}/award`, { type, singleVendorId });
  }

  ocrPriceList(file: File): Observable<{ items: { itemName: string; price: number | null; unit: string | null }[]; count: number }> {
    const form = new FormData();
    form.append("file", file);
    return this.http.post<{ items: { itemName: string; price: number | null; unit: string | null }[]; count: number }>(`${environment.apiUrl}/enrich/ocr-price-list`, form);
  }

  poPdfUrl(roundId: string, quotationId: string): string {
    return `${this.base}/${roundId}/po-pdf/${quotationId}`;
  }

  listTemplates(): Observable<ProcurementRoundTemplateDto[]> {
    return this.http.get<ProcurementRoundTemplateDto[]>(`${this.base}/templates`);
  }

  createTemplate(title: string, notes: string | null, items: ProcurementTemplateItemDto[]): Observable<ProcurementRoundTemplateDto> {
    return this.http.post<ProcurementRoundTemplateDto>(`${this.base}/templates`, { title, notes, items });
  }

  deleteTemplate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/templates/${id}`);
  }

  saveAsTemplate(roundId: string): Observable<ProcurementRoundTemplateDto> {
    return this.http.post<ProcurementRoundTemplateDto>(`${this.base}/${roundId}/save-as-template`, {});
  }

  useTemplate(templateId: string, title?: string): Observable<ProcurementRoundDto> {
    return this.http.post<ProcurementRoundDto>(`${this.base}/templates/${templateId}/use`, title ? { title } : {});
  }
}
