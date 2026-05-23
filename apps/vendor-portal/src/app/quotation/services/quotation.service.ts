import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import {
  AiSuggestedItem,
  CreateQuotationDto,
  LineItemDto,
  PaginatedQuotationResponse,
  QuotationResponseDto,
  QuotationTemplateResponseDto,
  QuotationType,
  UpdateQuotationDto,
} from "@fulfilus/shared";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class QuotationService {
  private readonly base = `${environment.apiUrl}/quotations`;

  constructor(private readonly http: HttpClient) {}

  create(dto: CreateQuotationDto): Observable<QuotationResponseDto> {
    return this.http.post<QuotationResponseDto>(this.base, dto);
  }

  listByVendor(
    vendorId: string,
    opts: { page?: number; limit?: number; search?: string; status?: string } = {},
  ): Observable<PaginatedQuotationResponse> {
    let params = new HttpParams().set("page", opts.page ?? 1).set("limit", opts.limit ?? 20);
    if (opts.search) params = params.set("search", opts.search);
    if (opts.status) params = params.set("status", opts.status);
    return this.http.get<PaginatedQuotationResponse>(`${this.base}/vendor/${vendorId}`, { params });
  }

  getById(id: string): Observable<QuotationResponseDto> {
    return this.http.get<QuotationResponseDto>(`${this.base}/${id}`);
  }

  update(id: string, dto: UpdateQuotationDto): Observable<QuotationResponseDto> {
    return this.http.patch<QuotationResponseDto>(`${this.base}/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  suggestItems(vendorId: string, quotationType: string): Observable<AiSuggestedItem[]> {
    return this.http.post<AiSuggestedItem[]>(`${this.base}/suggest-items`, { vendorId, quotationType });
  }

  downloadPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/pdf`, { responseType: "blob" });
  }

  listTemplates(): Observable<QuotationTemplateResponseDto[]> {
    return this.http.get<QuotationTemplateResponseDto[]>(`${environment.apiUrl}/quotation-templates`);
  }

  saveAsTemplate(title: string, type: QuotationType, notes: string | null, lineItems: LineItemDto[]): Observable<QuotationTemplateResponseDto> {
    return this.http.post<QuotationTemplateResponseDto>(`${environment.apiUrl}/quotation-templates`, { title, type, notes, lineItems });
  }

  deleteTemplate(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/quotation-templates/${id}`);
  }

  hsnLookup(code: string): Observable<{ code: string; gstRate: number | null; slabs: number[] }> {
    const params = new HttpParams().set("code", code);
    return this.http.get<{ code: string; gstRate: number | null; slabs: number[] }>(`${this.base}/hsn-lookup`, { params });
  }

  buildWhatsAppLink(quotation: QuotationResponseDto, whatsappNumber: string): string {
    const phone = whatsappNumber.replace(/\D/g, "");
    const text = encodeURIComponent(
      `Hello, please find our ${quotation.type.replace("_", " ")} attached.\n` +
      `Ref: ${quotation.referenceNumber}\n` +
      `Title: ${quotation.title}\n` +
      `Valid Until: ${quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString("en-IN") : "N/A"}`
    );
    return `https://wa.me/${phone}?text=${text}`;
  }
}
