import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { InboundListResponse, InboundMessage, InboundService, ValidationFlag } from "../services/inbound.service";

@Component({
  selector: "app-inbound-inbox",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  styles: [`
    .inbox-page { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .inbox-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
    .inbox-header h2 { margin: 0; flex: 1; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { background: #f5f5f5; text-align: left; padding: 10px 12px; font-weight: 600; border-bottom: 2px solid #e0e0e0; }
    td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
    tr:hover td { background: #fafafa; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; }
    .badge-quoted { background: #e3f2fd; color: #1565c0; }
    .badge-failed { background: #fce4ec; color: #b71c1c; }
    .badge-pending { background: #fff9c4; color: #f57f17; }
    .score-high { color: #2e7d32; font-weight: 600; }
    .score-mid { color: #e65100; font-weight: 600; }
    .score-low { color: #b71c1c; font-weight: 600; }
    .review-badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; }
    .review-pending { background: #fff3e0; color: #bf360c; }
    .review-approved { background: #e8f5e9; color: #1b5e20; }
    .review-rejected { background: #fce4ec; color: #880e4f; }
    .flags-list { list-style: none; margin: 4px 0 0; padding: 0; }
    .flags-list li { font-size: 12px; padding: 2px 0; }
    .flag-error { color: #c62828; }
    .flag-warning { color: #e65100; }
    .flag-info { color: #1565c0; }
    .flag-icon { margin-right: 4px; }
    .items-chip { font-size: 12px; color: #666; }
    .customer-name { font-weight: 500; }
    .phone { font-size: 12px; color: #666; }
    .review-form { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
    .review-form input { padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; }
    .review-form textarea { padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; resize: vertical; }
    .btn-approve { background: #2e7d32; color: #fff; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 13px; }
    .btn-approve:hover { background: #1b5e20; }
    .btn-reject { background: #c62828; color: #fff; border: none; padding: 6px 14px; border-radius: 4px; cursor: pointer; font-size: 13px; }
    .btn-reject:hover { background: #880e4f; }
    .btn-link { color: #1976d2; text-decoration: none; font-size: 14px; }
    .btn-link:hover { text-decoration: underline; }
    .pagination { display: flex; align-items: center; gap: 12px; margin-top: 20px; font-size: 14px; }
    .pagination button { padding: 6px 14px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; background: #fff; }
    .pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
    .empty { text-align: center; color: #999; padding: 40px; }
    .ref-num { font-size: 12px; color: #999; }
    .quote-title { font-size: 13px; }
  `],
  template: `
    <div class="inbox-page">
      <div class="inbox-header">
        <h2>WhatsApp Inbox</h2>
        <a routerLink="/sourcing" class="btn-link">Sourcing Quotes</a>
        <a routerLink="/admin" class="btn-link">Vendors</a>
        <button class="btn-link" (click)="load()">Refresh</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>From</th>
              <th>Customer</th>
              <th>Message</th>
              <th>Status</th>
              <th>Quote</th>
              <th>Validation</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let msg of messages">
              <td>
                <div>{{ msg.fromNumber }}</div>
                <div class="phone">{{ msg.createdAt | date:'dd MMM, HH:mm' }}</div>
              </td>
              <td>
                <ng-container *ngIf="msg.customer; else unknown">
                  <div class="customer-name">{{ msg.customer.name }}</div>
                  <div class="phone">{{ msg.customer.companyName }}</div>
                </ng-container>
                <ng-template #unknown><span style="color:#999;font-size:12px;">Unknown</span></ng-template>
              </td>
              <td>
                <div style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;">
                  {{ msg.rawText || (msg.messageType === 'image' ? '[Image]' : '-') }}
                </div>
                <div class="items-chip" *ngIf="msg.quote?._count?.items">
                  {{ msg.quote!._count.items }} item(s) extracted
                </div>
              </td>
              <td>
                <span class="badge" [ngClass]="statusClass(msg.status)">{{ msg.status }}</span>
                <div *ngIf="msg.errorMessage" style="font-size:11px;color:#c62828;margin-top:4px;">
                  {{ msg.errorMessage }}
                </div>
              </td>
              <td>
                <ng-container *ngIf="msg.quote">
                  <a [routerLink]="['/sourcing', msg.quote.id]" class="btn-link quote-title">
                    {{ msg.quote.title }}
                  </a>
                  <div class="ref-num" *ngIf="msg.quote.referenceNumber">{{ msg.quote.referenceNumber }}</div>
                </ng-container>
                <span *ngIf="!msg.quote" style="color:#999;font-size:12px;">--</span>
              </td>
              <td>
                <ng-container *ngIf="msg.quote?.validation as v">
                  <div>
                    Score:
                    <span [ngClass]="scoreClass(v.score)">{{ v.score | number:'1.0-0' }}</span>
                  </div>
                  <ul class="flags-list">
                    <li *ngFor="let f of topFlags(v.flags)" [ngClass]="flagClass(f)">
                      <span class="flag-icon">{{ flagIcon(f) }}</span>{{ f.message }}
                    </li>
                  </ul>
                </ng-container>
                <span *ngIf="!msg.quote?.validation" style="color:#999;font-size:12px;">--</span>
              </td>
              <td>
                <ng-container *ngIf="msg.quote?.validation as v">
                  <span class="review-badge" [ngClass]="reviewClass(v.status)">{{ v.status | titlecase }}</span>

                  <ng-container *ngIf="v.status === 'PENDING_REVIEW'">
                    <div class="review-form">
                      <input
                        [(ngModel)]="reviewerName[msg.id]"
                        placeholder="Your name"
                      />
                      <textarea
                        [(ngModel)]="reviewNotes[msg.id]"
                        placeholder="Notes (optional)"
                        rows="2"
                      ></textarea>
                      <div style="display:flex;gap:6px;">
                        <button class="btn-approve" (click)="doReview(msg, 'APPROVED')">Approve</button>
                        <button class="btn-reject" (click)="doReview(msg, 'REJECTED')">Reject</button>
                      </div>
                    </div>
                  </ng-container>

                  <ng-container *ngIf="v.status !== 'PENDING_REVIEW'">
                    <div style="font-size:12px;color:#666;margin-top:4px;" *ngIf="v.reviewedBy">
                      by {{ v.reviewedBy }}
                    </div>
                    <div style="font-size:12px;color:#666;" *ngIf="v.reviewNotes">
                      {{ v.reviewNotes }}
                    </div>
                  </ng-container>
                </ng-container>
                <span *ngIf="!msg.quote?.validation" style="color:#999;font-size:12px;">--</span>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="empty" *ngIf="!loading && messages.length === 0">
          No inbound messages to review.
        </div>
        <div class="empty" *ngIf="loading">Loading...</div>
      </div>

      <div class="pagination" *ngIf="total > limit">
        <button [disabled]="page <= 1" (click)="changePage(page - 1)">&laquo; Prev</button>
        <span>Page {{ page }} of {{ totalPages }}</span>
        <button [disabled]="page >= totalPages" (click)="changePage(page + 1)">Next &raquo;</button>
        <span style="color:#999;">{{ total }} total</span>
      </div>
    </div>
  `,
})
export class InboundInboxComponent implements OnInit {
  messages: InboundMessage[] = [];
  total = 0;
  page = 1;
  limit = 20;
  loading = false;

  reviewerName: Record<string, string> = {};
  reviewNotes: Record<string, string> = {};

  constructor(private readonly inboundService: InboundService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.inboundService.list(this.page, this.limit).subscribe({
      next: (res: InboundListResponse) => {
        this.messages = res.data;
        this.total = res.total;
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  changePage(p: number) {
    this.page = p;
    this.load();
  }

  get totalPages() {
    return Math.ceil(this.total / this.limit);
  }

  doReview(msg: InboundMessage, action: "APPROVED" | "REJECTED") {
    if (!msg.quote) return;
    const by = (this.reviewerName[msg.id] ?? "").trim();
    if (!by) { alert("Enter your name before reviewing."); return; }
    const notes = this.reviewNotes[msg.id];
    this.inboundService.review(msg.quote.id, action, by, notes).subscribe({
      next: (updated) => {
        if (msg.quote?.validation) {
          msg.quote.validation.status = updated.status;
          msg.quote.validation.reviewedBy = updated.reviewedBy;
          msg.quote.validation.reviewNotes = updated.reviewNotes;
        }
      },
      error: (err: unknown) => {
        alert(`Review failed: ${String(err)}`);
      },
    });
  }

  topFlags(flags: ValidationFlag[]): ValidationFlag[] {
    return flags.slice(0, 3);
  }

  statusClass(s: string) {
    return {
      "badge-quoted": s === "QUOTED",
      "badge-failed": s === "FAILED",
      "badge-pending": s === "PROCESSING" || s === "PENDING",
    };
  }

  scoreClass(score: number) {
    if (score >= 70) return "score-high";
    if (score >= 40) return "score-mid";
    return "score-low";
  }

  flagClass(f: ValidationFlag) {
    return {
      "flag-error": f.severity === "error",
      "flag-warning": f.severity === "warning",
      "flag-info": f.severity === "info",
    };
  }

  flagIcon(f: ValidationFlag): string {
    if (f.severity === "error") return "!";
    if (f.severity === "warning") return "~";
    return "i";
  }

  reviewClass(s: string) {
    return {
      "review-pending": s === "PENDING_REVIEW",
      "review-approved": s === "APPROVED",
      "review-rejected": s === "REJECTED",
    };
  }
}
