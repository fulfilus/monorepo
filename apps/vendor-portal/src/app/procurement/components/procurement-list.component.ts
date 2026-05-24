import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { PriceHistoryDto, ProcurementRoundDto, ProcurementRoundTemplateDto } from "@fulfilus/shared";
import { ProcurementService } from "../services/procurement.service";

@Component({
  selector: "app-procurement-list",
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="admin-page">
      <div class="admin-header">
        <h2>Procurement Rounds</h2>
        <div class="admin-header-actions">
          <a routerLink="/procurement/scorecard" class="btn-secondary">Vendor Scorecard</a>
          <a routerLink="/procurement/new" class="btn-secondary">+ New Round</a>
        </div>
      </div>

      <div *ngIf="templates.length" class="panel" style="margin-bottom:20px;">
        <div class="panel-header">
          <h3>Round Templates ({{ templates.length }})</h3>
        </div>
        <div class="panel-body" style="display:flex; flex-wrap:wrap; gap:10px;">
          <div *ngFor="let t of templates" class="template-card">
            <div>
              <div style="font-weight:600; font-size:13px;">{{ t.title }}</div>
              <div style="font-size:11px; color:var(--text-faint);">{{ templateItemCount(t) }} items</div>
            </div>
            <button (click)="useTemplate(t)" [disabled]="usingTemplateId === t.id" class="btn-primary" style="padding:5px 12px; font-size:12px;">
              {{ usingTemplateId === t.id ? 'Creating...' : 'Use' }}
            </button>
            <button (click)="deleteTemplate(t)" class="btn-danger" style="padding:5px 10px; font-size:12px;">Delete</button>
          </div>
          <div *ngIf="templateError" class="alert alert-error" style="width:100%; margin:0;">{{ templateError }}</div>
        </div>
      </div>

      <div class="panel" style="margin-bottom:20px;">
        <div class="panel-header"><h3>Price History</h3></div>
        <div class="panel-body">
          <div style="display:flex; gap:8px; align-items:center; margin-bottom:12px;">
            <input [(ngModel)]="priceHistoryQuery" (keyup.enter)="searchPriceHistory()"
                   placeholder="Search item name..." class="inline-input" style="max-width:300px;" />
            <button (click)="searchPriceHistory()" [disabled]="loadingHistory" class="btn-primary">
              {{ loadingHistory ? 'Searching...' : 'Search' }}
            </button>
          </div>

          <ng-container *ngIf="priceHistory && !loadingHistory">
            <p *ngIf="priceHistory.rounds.length === 0" class="empty-state">
              No price data found for "{{ priceHistory.itemName }}".
            </p>
            <div *ngIf="priceHistory.rounds.length > 0" class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style="min-width:140px;">Vendor</th>
                    <th *ngFor="let r of priceHistory.rounds" style="text-align:right; min-width:110px;">
                      {{ r.title }}<br/>
                      <span style="color:var(--text-faint); font-weight:400;">{{ r.createdAt | date:'dd MMM yy' }}</span>
                    </th>
                    <th style="text-align:center; min-width:70px;">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let v of priceHistory.vendors">
                    <td style="font-weight:600;">{{ v.shopName }}</td>
                    <td *ngFor="let p of v.prices" style="text-align:right;"
                        [style.color]="p != null ? 'var(--text)' : 'var(--text-faint)'">
                      {{ p != null ? ('₹' + p) : '—' }}
                    </td>
                    <td style="text-align:center; vertical-align:middle;">
                      <ng-container *ngIf="sparklinePoints(v.prices) as pts">
                        <svg *ngIf="pts.length > 1" width="70" height="28" style="display:inline-block; vertical-align:middle;">
                          <polyline [attr.points]="pts.join(' ')"
                                    [attr.stroke]="priceTrend(v.prices) === 'up' ? 'var(--red)' : priceTrend(v.prices) === 'down' ? 'var(--green)' : 'var(--text-faint)'"
                                    stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                          <circle *ngFor="let pt of sparklineCircles(v.prices)"
                                  [attr.cx]="pt.x" [attr.cy]="pt.y" r="2.5"
                                  [attr.fill]="priceTrend(v.prices) === 'up' ? 'var(--red)' : priceTrend(v.prices) === 'down' ? 'var(--green)' : 'var(--text-faint)'"/>
                        </svg>
                        <span *ngIf="pts.length < 2" style="color:var(--text-faint); font-size:12px;">—</span>
                      </ng-container>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </ng-container>
        </div>
      </div>

      <div *ngIf="loading" class="empty-state">Loading...</div>

      <div class="table-wrapper" *ngIf="!loading && rounds.length">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Items</th>
              <th>Vendors</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let r of rounds">
              <td><strong>{{ r.title }}</strong></td>
              <td><span class="badge" [ngClass]="r.status.toLowerCase()">{{ r.status }}</span></td>
              <td>{{ r.items.length }} items</td>
              <td>{{ r.vendorBids.length }} vendors</td>
              <td style="white-space:nowrap;">{{ r.createdAt | date:'dd MMM yy' }}</td>
              <td>
                <a [routerLink]="['/procurement', r.id]" class="btn-link">Open</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div *ngIf="!loading && !rounds.length" class="empty-state">
        No procurement rounds yet. Create one to start sourcing from multiple vendors.
      </div>

      <div class="pagination" *ngIf="total > limit">
        <button (click)="loadPage(page - 1)" [disabled]="page === 1">Prev</button>
        <span>Page {{ page }} of {{ Math.ceil(total / limit) }}</span>
        <button (click)="loadPage(page + 1)" [disabled]="page * limit >= total">Next</button>
      </div>
    </div>
  `,
})
export class ProcurementListComponent implements OnInit {
  rounds: ProcurementRoundDto[] = [];
  templates: ProcurementRoundTemplateDto[] = [];
  loading = true;
  total = 0;
  page = 1;
  limit = 20;
  Math = Math;

  usingTemplateId = "";
  templateError = "";

  priceHistoryQuery = "";
  priceHistory: PriceHistoryDto | null = null;
  loadingHistory = false;

  constructor(
    private readonly procurementService: ProcurementService,
    private readonly router: Router,
  ) {}

  ngOnInit() {
    this.loadPage(1);
    this.loadTemplates();
  }

  loadPage(p: number) {
    this.page = p;
    this.loading = true;
    this.procurementService.list(p, this.limit).subscribe({
      next: res => { this.rounds = res.data; this.total = res.total; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  loadTemplates() {
    this.procurementService.listTemplates().subscribe({
      next: t => { this.templates = t; },
    });
  }

  templateItemCount(t: ProcurementRoundTemplateDto): number {
    return Array.isArray(t.items) ? t.items.length : 0;
  }

  useTemplate(t: ProcurementRoundTemplateDto) {
    this.usingTemplateId = t.id;
    this.templateError = "";
    this.procurementService.useTemplate(t.id).subscribe({
      next: round => { void this.router.navigate(["/procurement", round.id]); },
      error: () => { this.templateError = "Failed to create round from template."; this.usingTemplateId = ""; },
    });
  }

  deleteTemplate(t: ProcurementRoundTemplateDto) {
    if (!confirm(`Delete template "${t.title}"?`)) return;
    this.procurementService.deleteTemplate(t.id).subscribe({
      next: () => { this.templates = this.templates.filter(x => x.id !== t.id); },
      error: () => { this.templateError = "Failed to delete template."; },
    });
  }

  searchPriceHistory() {
    const q = this.priceHistoryQuery.trim();
    if (!q) return;
    this.loadingHistory = true;
    this.priceHistory = null;
    this.procurementService.getPriceHistory(q).subscribe({
      next: h => { this.priceHistory = h; this.loadingHistory = false; },
      error: () => { this.loadingHistory = false; },
    });
  }

  priceTrend(prices: (number | null)[]): "up" | "down" | "flat" | "n/a" {
    const filled = prices.filter((p): p is number => p !== null);
    if (filled.length < 2) return "n/a";
    const last = filled[filled.length - 1];
    const prev = filled[filled.length - 2];
    if (last > prev) return "up";
    if (last < prev) return "down";
    return "flat";
  }

  sparklinePoints(prices: (number | null)[]): string[] {
    const filled = prices.filter((p): p is number => p !== null);
    if (filled.length < 2) return [];
    const w = 70; const h = 28; const pad = 4;
    const min = Math.min(...filled);
    const max = Math.max(...filled);
    const range = max - min || 1;
    return filled.map((p, i) => {
      const x = pad + (i / (filled.length - 1)) * (w - pad * 2);
      const y = h - pad - ((p - min) / range) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
  }

  sparklineCircles(prices: (number | null)[]): { x: number; y: number }[] {
    return this.sparklinePoints(prices).map(pt => {
      const [x, y] = pt.split(",").map(Number);
      return { x, y };
    });
  }
}
