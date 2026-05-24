import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { RouterLink } from "@angular/router";
import { SourcingQuoteDto } from "@fulfilus/shared";
import { SourcingService } from "../services/sourcing.service";

@Component({
  selector: "app-sourcing-list",
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="admin-page">
      <div class="admin-header">
        <div>
          <a routerLink="/admin" class="back-link">Vendors</a>
          <h2>Sourcing Quotes</h2>
        </div>
        <a routerLink="/sourcing/new" class="btn-secondary">+ New Quote</a>
      </div>

      <div *ngIf="loading" class="empty-state">Loading...</div>

      <div class="table-wrapper" *ngIf="!loading && quotes.length">
        <table>
          <thead>
            <tr>
              <th>Ref</th>
              <th>Title</th>
              <th>Customer</th>
              <th>Status</th>
              <th>Rev</th>
              <th>Items</th>
              <th>Valid Until</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let q of quotes">
              <td style="font-size:11px; color:var(--text-muted); white-space:nowrap;">{{ q.referenceNumber }}</td>
              <td><strong>{{ q.title }}</strong></td>
              <td>{{ q.customerName || '—' }}</td>
              <td><span class="badge" [ngClass]="q.status.toLowerCase()">{{ q.status }}</span></td>
              <td style="text-align:center; color:var(--text-faint); font-size:12px;">{{ q.revisionNumber }}</td>
              <td>{{ q.items.length }} items</td>
              <td>{{ q.validUntil ? (q.validUntil | date:'dd MMM yy') : '—' }}</td>
              <td style="white-space:nowrap;">{{ q.createdAt | date:'dd MMM yy' }}</td>
              <td>
                <a [routerLink]="['/sourcing', q.id]" class="btn-link">Open</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div *ngIf="!loading && !quotes.length" class="empty-state">
        No sourcing quotes yet. Create one to build a priced quotation for your customer.
      </div>

      <div class="pagination" *ngIf="total > limit">
        <button (click)="loadPage(page - 1)" [disabled]="page === 1">Prev</button>
        <span>Page {{ page }} of {{ Math.ceil(total / limit) }}</span>
        <button (click)="loadPage(page + 1)" [disabled]="page * limit >= total">Next</button>
      </div>
    </div>
  `,
})
export class SourcingListComponent implements OnInit {
  quotes: SourcingQuoteDto[] = [];
  loading = true;
  total = 0;
  page = 1;
  limit = 20;
  Math = Math;

  constructor(private readonly sourcingService: SourcingService) {}

  ngOnInit() { this.loadPage(1); }

  loadPage(p: number) {
    this.page = p;
    this.loading = true;
    this.sourcingService.list(p, this.limit).subscribe({
      next: res => { this.quotes = res.data; this.total = res.total; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }
}
