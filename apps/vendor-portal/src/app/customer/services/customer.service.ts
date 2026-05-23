import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { CreateCustomerRequest, CustomerDto, CustomerWithQuotesDto } from "@fulfilus/shared";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class CustomerService {
  private readonly base = `${environment.apiUrl}/customers`;

  constructor(private readonly http: HttpClient) {}

  create(dto: CreateCustomerRequest): Observable<CustomerDto> {
    return this.http.post<CustomerDto>(this.base, dto);
  }

  list(page = 1, limit = 50, search?: string): Observable<{ data: CustomerDto[]; total: number; page: number; limit: number }> {
    let params = new HttpParams().set("page", page).set("limit", limit);
    if (search) params = params.set("search", search);
    return this.http.get<{ data: CustomerDto[]; total: number; page: number; limit: number }>(this.base, { params });
  }

  getOne(id: string): Observable<CustomerWithQuotesDto> {
    return this.http.get<CustomerWithQuotesDto>(`${this.base}/${id}`);
  }

  update(id: string, dto: CreateCustomerRequest): Observable<CustomerDto> {
    return this.http.put<CustomerDto>(`${this.base}/${id}`, dto);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
