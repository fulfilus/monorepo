import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { DashboardResponseDto } from "@fulfilus/shared";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({ providedIn: "root" })
export class DashboardService {
  constructor(private readonly http: HttpClient) {}

  getSummary(): Observable<DashboardResponseDto> {
    return this.http.get<DashboardResponseDto>(`${environment.apiUrl}/dashboard`);
  }
}
