import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { CreateVendorDto, PaginatedResponse, VendorResponseDto } from "@fulfilus/shared";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class VendorService {
  private readonly base = `${environment.apiUrl}/vendors`;

  constructor(private readonly http: HttpClient) {}

  create(dto: CreateVendorDto): Observable<VendorResponseDto> {
    return this.http.post<VendorResponseDto>(this.base, dto);
  }

  list(page = 1, limit = 20): Observable<PaginatedResponse<VendorResponseDto>> {
    return this.http.get<PaginatedResponse<VendorResponseDto>>(this.base, {
      params: { page, limit },
    });
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
}
