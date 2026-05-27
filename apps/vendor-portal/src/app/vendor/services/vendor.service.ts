import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { AuditLogResponseDto, ContactLogResponseDto, ContactLogType, CreateVendorDto, DocumentResponseDto, EnrichmentResult, PaginatedResponse, VendorResponseDto } from "@fulfilus/shared";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

export interface VendorListFilters {
  search?: string;
  status?: string;
  category?: string;
}

@Injectable({ providedIn: "root" })
export class VendorService {
  private readonly base = `${environment.apiUrl}/vendors`;

  constructor(private readonly http: HttpClient) {}

  create(dto: CreateVendorDto): Observable<VendorResponseDto> {
    return this.http.post<VendorResponseDto>(this.base, dto);
  }

  list(page = 1, limit = 20, filters: VendorListFilters = {}): Observable<PaginatedResponse<VendorResponseDto>> {
    let params = new HttpParams().set("page", page).set("limit", limit);
    if (filters.search) params = params.set("search", filters.search);
    if (filters.status) params = params.set("status", filters.status);
    if (filters.category) params = params.set("category", filters.category);
    return this.http.get<PaginatedResponse<VendorResponseDto>>(this.base, { params });
  }

  getById(id: string): Observable<VendorResponseDto> {
    return this.http.get<VendorResponseDto>(`${this.base}/${id}`);
  }

  update(id: string, dto: Partial<CreateVendorDto>): Observable<VendorResponseDto> {
    return this.http.patch<VendorResponseDto>(`${this.base}/${id}`, dto);
  }

  uploadPhoto(id: string, file: File): Observable<VendorResponseDto> {
    const form = new FormData();
    form.append("file", file);
    return this.http.post<VendorResponseDto>(`${this.base}/${id}/photo`, form);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  auditLogs(id: string): Observable<AuditLogResponseDto[]> {
    return this.http.get<AuditLogResponseDto[]>(`${this.base}/${id}/audit-logs`);
  }

  bulkStatus(ids: string[], contactStatus: string): Observable<{ count: number }> {
    return this.http.post<{ count: number }>(`${this.base}/bulk-status`, { ids, contactStatus });
  }

  listDocuments(id: string): Observable<DocumentResponseDto[]> {
    return this.http.get<DocumentResponseDto[]>(`${this.base}/${id}/documents`);
  }

  uploadDocument(id: string, file: File): Observable<DocumentResponseDto> {
    const form = new FormData();
    form.append("file", file);
    return this.http.post<DocumentResponseDto>(`${this.base}/${id}/documents`, form);
  }

  deleteDocument(vendorId: string, docId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${vendorId}/documents/${docId}`);
  }

  startEnrichment(mapsUrl: string): Observable<{ jobId: string; status: string }> {
    return this.http.post<{ jobId: string; status: string }>(`${environment.apiUrl}/enrich/maps-url`, { mapsUrl });
  }

  pollEnrichmentJob(jobId: string): Observable<{ id: string; status: string; rawPayload: unknown; confidenceScore: number | null; errorMessage: string | null }> {
    return this.http.get<{ id: string; status: string; rawPayload: unknown; confidenceScore: number | null; errorMessage: string | null }>(`${environment.apiUrl}/enrich/jobs/${jobId}`);
  }

  enrichFromUrl(mapsUrl: string): Observable<EnrichmentResult> {
    return this.http.post<EnrichmentResult>(`${environment.apiUrl}/enrich/maps-url`, { mapsUrl });
  }

  enrichFromIndiamartUrl(url: string): Observable<EnrichmentResult> {
    return this.http.post<EnrichmentResult>(`${environment.apiUrl}/enrich/indiamart-url`, { url });
  }

  enrichFromJustdialUrl(url: string): Observable<EnrichmentResult> {
    return this.http.post<EnrichmentResult>(`${environment.apiUrl}/enrich/justdial-url`, { url });
  }

  reEnrich(id: string): Observable<{ jobId: string }> {
    return this.http.post<{ jobId: string }>(`${this.base}/${id}/re-enrich`, {});
  }

  listContactLogs(vendorId: string): Observable<ContactLogResponseDto[]> {
    return this.http.get<ContactLogResponseDto[]>(`${this.base}/${vendorId}/contact-logs`);
  }

  addContactLog(vendorId: string, type: ContactLogType, notes: string, contactedBy: string): Observable<ContactLogResponseDto> {
    return this.http.post<ContactLogResponseDto>(`${this.base}/${vendorId}/contact-logs`, { type, notes, contactedBy });
  }

  deleteContactLog(vendorId: string, logId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${vendorId}/contact-logs/${logId}`);
  }

  bulkImportCsv(file: File): Observable<{ imported: number; skipped: number; errors: { row: number; reason: string }[] }> {
    const form = new FormData();
    form.append("file", file);
    return this.http.post<{ imported: number; skipped: number; errors: { row: number; reason: string }[] }>(`${this.base}/bulk-import`, form);
  }

  mergeVendors(sourceId: string, targetId: string): Observable<{ survivingId: string; survivingName: string; deletedId: string; deletedName: string }> {
    return this.http.post<{ survivingId: string; survivingName: string; deletedId: string; deletedName: string }>(`${this.base}/merge`, { sourceId, targetId });
  }

  importFromIndiamart(query: string, city: string, maxPages: number, enrich = false): Observable<{ imported: number; skipped: number; duplicates: number; errors: { name: string; reason: string }[]; total: number }> {
    return this.http.post<{ imported: number; skipped: number; duplicates: number; errors: { name: string; reason: string }[]; total: number }>(
      `${environment.apiUrl}/indiamart-import`,
      { query, city, maxPages, enrich },
    );
  }

  listVendorInvoices(vendorId: string): Observable<{ id: string; invoiceNumber: string; amount: number; dueAt: string | null; paidAt: string | null; notes: string | null; quotationId: string | null }[]> {
    return this.http.get<{ id: string; invoiceNumber: string; amount: number; dueAt: string | null; paidAt: string | null; notes: string | null; quotationId: string | null }[]>(`${this.base}/${vendorId}/invoices`);
  }

  createVendorInvoice(vendorId: string, dto: { invoiceNumber: string; amount: number; dueAt?: string; notes?: string }): Observable<{ id: string; invoiceNumber: string; amount: number; dueAt: string | null; paidAt: string | null; notes: string | null; quotationId: string | null }> {
    return this.http.post<{ id: string; invoiceNumber: string; amount: number; dueAt: string | null; paidAt: string | null; notes: string | null; quotationId: string | null }>(`${this.base}/${vendorId}/invoices`, dto);
  }

  updateVendorInvoice(vendorId: string, invoiceId: string, dto: { paidAt?: string; dueAt?: string; notes?: string }): Observable<{ id: string; paidAt: string | null }> {
    return this.http.patch<{ id: string; paidAt: string | null }>(`${this.base}/${vendorId}/invoices/${invoiceId}`, dto);
  }

  deleteVendorInvoice(vendorId: string, invoiceId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${vendorId}/invoices/${invoiceId}`);
  }
}
