import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { AgreedRateContractDto } from "@fulfilus/shared";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class ContractsService {
  private readonly base = `${environment.apiUrl}/contracts`;

  constructor(private readonly http: HttpClient) {}

  list(vendorId?: string, itemName?: string, status?: string): Observable<AgreedRateContractDto[]> {
    let params = new HttpParams();
    if (vendorId) params = params.set("vendorId", vendorId);
    if (itemName) params = params.set("itemName", itemName);
    if (status) params = params.set("status", status);
    return this.http.get<AgreedRateContractDto[]>(this.base, { params });
  }

  create(payload: {
    vendorId: string; itemName: string; unitPrice: number; unit?: string;
    minQty?: number; tolerancePct?: number; hsnCode?: string; gstRate?: number;
    validFrom?: string; validUntil?: string; notes?: string;
  }): Observable<AgreedRateContractDto> {
    return this.http.post<AgreedRateContractDto>(this.base, payload);
  }

  update(id: string, payload: Partial<{ unitPrice: number; unit: string; minQty: number; tolerancePct: number; validUntil: string; notes: string; status: string }>): Observable<AgreedRateContractDto> {
    return this.http.put<AgreedRateContractDto>(`${this.base}/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
