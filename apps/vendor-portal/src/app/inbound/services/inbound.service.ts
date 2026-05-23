import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

export type InboundStatus = "PENDING" | "PROCESSING" | "QUOTED" | "FAILED";
export type ValidationReviewStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED";
export type ValidationFlagSeverity = "error" | "warning" | "info";

export interface ValidationFlag {
  code: string;
  severity: ValidationFlagSeverity;
  message: string;
  itemName?: string;
}

export interface QuoteValidation {
  score: number;
  status: ValidationReviewStatus;
  flags: ValidationFlag[];
  reviewedBy?: string;
  reviewNotes?: string;
}

export interface InboundQuoteSummary {
  id: string;
  referenceNumber?: string;
  title: string;
  status: string;
  validation?: QuoteValidation;
  _count: { items: number };
}

export interface InboundCustomer {
  id: string;
  name: string;
  companyName?: string;
  phone: string;
}

export interface InboundMessage {
  id: string;
  waMessageId: string;
  fromNumber: string;
  messageType: "text" | "image";
  rawText?: string;
  status: InboundStatus;
  errorMessage?: string;
  extractedItems: unknown[];
  createdAt: string;
  customer?: InboundCustomer;
  quote?: InboundQuoteSummary;
}

export interface InboundListResponse {
  data: InboundMessage[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({ providedIn: "root" })
export class InboundService {
  private readonly base = "/inbound";

  constructor(private readonly http: HttpClient) {}

  list(page = 1, limit = 20): Observable<InboundListResponse> {
    const params = new HttpParams().set("page", page).set("limit", limit);
    return this.http.get<InboundListResponse>(this.base, { params });
  }

  review(quoteId: string, action: "APPROVED" | "REJECTED", reviewedBy: string, reviewNotes?: string): Observable<QuoteValidation> {
    return this.http.patch<QuoteValidation>(`${this.base}/${quoteId}/review`, { action, reviewedBy, reviewNotes });
  }
}
