import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { InboundListResponse, InboundMessage, InboundService, ValidationFlag } from "../services/inbound.service";

@Component({
  selector: "app-inbound-inbox",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="admin-page">
      <div class="admin-header">
        <h2>WhatsApp Inbox</h2>
        <div class="admin-header-actions">
          <a routerLink="/sourcing" class="btn-secondary">Sourcing Quotes</a>
          <button class="btn-ghost" (click)="load()">Refresh</button>
        </div>
      </div>

      <div class="table-wrapper">
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
                <div style="font-weight:600;">{{ msg.fromNumber }}</div>
                <div style="font-size:11px; color:var(--text-faint);">{{ msg.createdAt | date:'dd MMM, HH:mm' }}</div>
              </td>
              <td>
                <ng-container *ngIf="msg.customer; else unknown">
                  <div style="font-weight:600;">{{ msg.customer.name }}</div>
                  <div style="font-size:11px; color:var(--text-muted);">{{ msg.customer.companyName }}</div>
                </ng-container>
                <ng-template #unknown><span style="color:var(--text-faint); font-size:12px;">Unknown</span></ng-template>
              </td>
              <td>
                <div class="truncate" style="max-width:200px;">
                  {{ msg.rawText || (msg.messageType === 'image' ? '[Image]' : '-') }}
                </div>
                <div *ngIf="msg.quote?._count?.items" style="font-size:11px; color:var(--text-muted);">
                  {{ msg.quote!._count.items }} item(s) extracted
                </div>
              </td>
              <td>
                <span class="badge" [ngClass]="statusClass(msg.status)">{{ msg.status }}</span>
                <div *ngIf="msg.errorMessage" style="font-size:11px; color:var(--red); margin-top:4px;">{{ msg.errorMessage }}</div>
              </td>
              <td>
                <ng-container *ngIf="msg.quote">
                  <a [routerLink]="['/sourcing', msg.quote.id]" class="btn-link">{{ msg.quote.title }}</a>
                  <div *ngIf="msg.quote.referenceNumber" style="font-size:11px; color:var(--text-faint);">{{ msg.quote.referenceNumber }}</div>
                </ng-container>
                <span *ngIf="!msg.quote" style="color:var(--text-faint); font-size:12px;">--</span>
              </td>
              <td>
                <ng-container *ngIf="msg.quote?.validation as v">
                  <div style="margin-bottom:4px;">
                    Score: <span class="score-pill" [class.high]="v.score >= 70" [class.mid]="v.score >= 40 && v.score < 70" [class.low]="v.score < 40">{{ v.score | number:'1.0-0' }}</span>
                  </div>
                  <ul style="list-style:none; margin:0; padding:0;">
                    <li *ngFor="let f of topFlags(v.flags)" style="font-size:11px; padding:1px 0;"
                        [style.color]="f.severity === 'error' ? 'var(--red)' : f.severity === 'warning' ? 'var(--amber)' : 'var(--blue)'">
                      {{ flagIcon(f) }} {{ f.message }}
                    </li>
                  </ul>
                </ng-container>
                <span *ngIf="!msg.quote?.validation" style="color:var(--text-faint); font-size:12px;">--</span>
              </td>
              <td>
                <ng-container *ngIf="msg.quote?.validation as v">
                  <span class="badge" [ngClass]="reviewClass(v.status)">{{ v.status | titlecase }}</span>

                  <ng-container *ngIf="v.status === 'PENDING_REVIEW'">
                    <div style="display:flex; flex-direction:column; gap:6px; margin-top:8px;">
                      <input [(ngModel)]="reviewerName[msg.id]" placeholder="Your name" class="inline-input" />
                      <textarea [(ngModel)]="reviewNotes[msg.id]" placeholder="Notes (optional)" rows="2" class="inline-input" style="resize:vertical;"></textarea>
                      <div style="display:flex; gap:6px;">
                        <button class="btn-primary" style="padding:5px 12px; font-size:12px;" (click)="doReview(msg, 'APPROVED')">Approve</button>
                        <button class="btn-danger" style="padding:5px 10px; font-size:12px;" (click)="doReview(msg, 'REJECTED')">Reject</button>
                      </div>
                    </div>
                  </ng-container>

                  <ng-container *ngIf="v.status !== 'PENDING_REVIEW'">
                    <div *ngIf="v.reviewedBy" style="font-size:11px; color:var(--text-muted); margin-top:4px;">by {{ v.reviewedBy }}</div>
                    <div *ngIf="v.reviewNotes" style="font-size:11px; color:var(--text-muted);">{{ v.reviewNotes }}</div>
                  </ng-container>
                </ng-container>
                <span *ngIf="!msg.quote?.validation" style="color:var(--text-faint); font-size:12px;">--</span>
              </td>
            </tr>
          </tbody>
        </table>

        <p class="empty-state" *ngIf="!loading && messages.length === 0">No inbound messages to review.</p>
        <p class="empty-state" *ngIf="loading">Loading...</p>
      </div>

      <div class="pagination" *ngIf="total > limit">
        <button [disabled]="page <= 1" (click)="changePage(page - 1)">Prev</button>
        <span>Page {{ page }} of {{ totalPages }}</span>
        <button [disabled]="page >= totalPages" (click)="changePage(page + 1)">Next</button>
        <span style="color:var(--text-faint);">{{ total }} total</span>
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

  statusClass(s: string): Record<string, boolean> {
    return {
      "quoted":  s === "QUOTED",
      "failed":  s === "FAILED",
      "pending": s === "PROCESSING" || s === "PENDING",
    };
  }

  flagIcon(f: ValidationFlag): string {
    if (f.severity === "error") return "!";
    if (f.severity === "warning") return "~";
    return "i";
  }

  reviewClass(s: string): Record<string, boolean> {
    return {
      "pending":  s === "PENDING_REVIEW",
      "accepted": s === "APPROVED",
      "rejected": s === "REJECTED",
    };
  }
}
