import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { CreateSourcingQuoteRequest, PriceLookupResult, SourcingQuoteDto, SourcingQuoteRevisionDto, SourcingStatus } from "@fulfilus/shared";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class SourcingService {
  private readonly base = `${environment.apiUrl}/sourcing`;

  constructor(private readonly http: HttpClient) {}

  create(dto: CreateSourcingQuoteRequest): Observable<SourcingQuoteDto> {
    return this.http.post<SourcingQuoteDto>(this.base, dto);
  }

  list(page = 1, limit = 20): Observable<{ data: SourcingQuoteDto[]; total: number; page: number; limit: number }> {
    const params = new HttpParams().set("page", page).set("limit", limit);
    return this.http.get<{ data: SourcingQuoteDto[]; total: number; page: number; limit: number }>(this.base, { params });
  }

  getOne(id: string): Observable<SourcingQuoteDto> {
    return this.http.get<SourcingQuoteDto>(`${this.base}/${id}`);
  }

  update(id: string, dto: CreateSourcingQuoteRequest): Observable<SourcingQuoteDto> {
    return this.http.put<SourcingQuoteDto>(`${this.base}/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  lookup(itemNames: string[]): Observable<PriceLookupResult> {
    return this.http.post<PriceLookupResult>(`${this.base}/lookup`, { itemNames });
  }

  updateStatus(
    id: string,
    status: SourcingStatus,
    opts?: { method?: "WHATSAPP" | "EMAIL" | "PDF_HANDOFF"; sentBy?: string; sendNotes?: string },
  ): Observable<SourcingQuoteDto> {
    return this.http.patch<SourcingQuoteDto>(`${this.base}/${id}/status`, { status, ...opts });
  }

  duplicate(id: string): Observable<SourcingQuoteDto> {
    return this.http.post<SourcingQuoteDto>(`${this.base}/${id}/duplicate`, {});
  }

  getRevisions(id: string): Observable<SourcingQuoteRevisionDto[]> {
    return this.http.get<SourcingQuoteRevisionDto[]>(`${this.base}/${id}/revisions`);
  }

  downloadPdf(id: string, type: "customer" | "internal"): Observable<Blob> {
    return this.http.get(`${this.base}/${id}/pdf/${type}`, { responseType: "blob" });
  }
}
