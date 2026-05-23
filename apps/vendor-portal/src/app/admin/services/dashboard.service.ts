import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { DashboardResponseDto, SpendAnalyticsDto } from "@fulfilus/shared";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class DashboardService {
  private readonly base = `${environment.apiUrl}/dashboard`;

  constructor(private readonly http: HttpClient) {}

  getSummary(): Observable<DashboardResponseDto> {
    return this.http.get<DashboardResponseDto>(this.base);
  }

  getSpend(): Observable<SpendAnalyticsDto> {
    return this.http.get<SpendAnalyticsDto>(`${this.base}/spend`);
  }
}
