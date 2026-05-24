import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { DashboardResponseDto, SpendAnalyticsDto } from "@fulfilus/shared";
import { environment } from "../../../environments/environment";
import { DashboardService } from "../services/dashboard.service";

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="admin-page">
      <div class="admin-header">
        <h2>Dashboard</h2>
        <div class="admin-header-actions">
          <input type="date" [(ngModel)]="exportFrom" class="header-input" />
          <span style="font-size:12px; color:var(--text-muted);">to</span>
          <input type="date" [(ngModel)]="exportTo" class="header-input" />
          <button (click)="downloadAccountingExport()" class="btn-secondary">Export POs (CSV)</button>
        </div>
        <a routerLink="/admin" class="btn-secondary">Manage Vendors</a>
      </div>

      <div *ngIf="loading" class="empty-state">Loading...</div>
      <div *ngIf="errorMessage" class="alert alert-error">{{ errorMessage }}</div>

      <ng-container *ngIf="data && !loading">

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total Vendors</div>
            <div class="stat-value" style="color:var(--blue)">{{ data.totalVendors }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Contacted</div>
            <div class="stat-value" style="color:var(--green)">{{ data.contactedCount }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Not Contacted</div>
            <div class="stat-value" style="color:var(--red)">{{ data.notContactedCount }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">AI Enriched</div>
            <div class="stat-value" style="color:var(--purple)">{{ data.enrichmentCoveragePct }}%</div>
          </div>
        </div>

        <div class="two-col">
          <div class="panel">
            <div class="panel-header"><h3>Top Categories</h3></div>
            <div class="panel-body">
              <div *ngFor="let row of data.categoryBreakdown.slice(0,8)" class="bar-row">
                <span>{{ formatCategory(row.category) }}</span>
                <div class="bar-right">
                  <div class="bar-track" style="width:80px;"><div class="bar-fill" [style.width.px]="barWidth(row.count)"></div></div>
                  <span class="bar-count">{{ row.count }}</span>
                </div>
              </div>
              <p *ngIf="!data.categoryBreakdown.length" class="empty-state">No vendors yet.</p>
            </div>
          </div>

          <div class="panel">
            <div class="panel-header"><h3>Quotation Funnel</h3></div>
            <div class="panel-body">
              <div *ngFor="let row of data.quotationFunnel" class="funnel-row">
                <span class="badge" [ngClass]="row.status.toLowerCase()">{{ row.status }}</span>
                <span class="funnel-count">{{ row.count }}</span>
              </div>
              <p *ngIf="!data.quotationFunnel.length" class="empty-state">No quotations yet.</p>
            </div>
          </div>
        </div>

        <div class="panel" style="margin-bottom:24px;">
          <div class="panel-header"><h3>Recently Added Vendors</h3></div>
          <div class="table-wrapper" style="margin:0; border-radius:0 0 var(--r-xl) var(--r-xl);">
            <table *ngIf="data.recentVendors.length; else noRecent">
              <thead><tr><th>Shop Name</th><th>Status</th><th>Added</th><th></th></tr></thead>
              <tbody>
                <tr *ngFor="let v of data.recentVendors">
                  <td>{{ v.shopName }}</td>
                  <td><span class="badge" [class.contacted]="v.contactStatus === 'CONTACTED'">
                    {{ v.contactStatus === 'CONTACTED' ? 'Contacted' : 'Not Contacted' }}
                  </span></td>
                  <td>{{ v.createdAt | date:'dd MMM yy' }}</td>
                  <td><a [routerLink]="['/admin/vendors', v.id]" class="btn-link">Edit</a></td>
                </tr>
              </tbody>
            </table>
            <ng-template #noRecent><p class="empty-state">No vendors yet.</p></ng-template>
          </div>
        </div>

      </ng-container>

      <ng-container *ngIf="spend && !loadingSpend">
        <div *ngIf="spend.totalSpend === 0" class="panel" style="margin-bottom:24px;">
          <div class="panel-body">
            <p class="empty-state">No awarded PO quotes yet. Award procurement rounds to see spend data.</p>
          </div>
        </div>

        <ng-container *ngIf="spend.totalSpend > 0">
          <div class="stats-grid" style="margin-bottom:20px;">
            <div class="stat-card">
              <div class="stat-label">Total Awarded Spend</div>
              <div class="stat-value" style="color:var(--green)">₹{{ spend.totalSpend.toLocaleString() }}</div>
            </div>
          </div>

          <div class="two-col">
            <div class="panel">
              <div class="panel-header"><h3>By Vendor</h3></div>
              <div class="panel-body">
                <div *ngFor="let v of spend.byVendor.slice(0, 8)" class="spend-row">
                  <div class="spend-row-label">
                    <span>{{ v.shopName }}</span>
                    <span class="spend-amount">₹{{ v.total.toLocaleString() }} ({{ v.pct }}%)</span>
                  </div>
                  <div class="spend-bar-track"><div class="spend-bar-fill" [style.width]="v.pct + '%'"></div></div>
                </div>
              </div>
            </div>

            <div class="panel">
              <div class="panel-header"><h3>By Category</h3></div>
              <div class="panel-body">
                <div *ngFor="let c of spend.byCategory.slice(0, 8)" class="spend-row">
                  <div class="spend-row-label">
                    <span>{{ formatCategory(c.category) }}</span>
                    <span class="spend-amount">₹{{ c.total.toLocaleString() }} ({{ c.pct }}%)</span>
                  </div>
                  <div class="spend-bar-track"><div class="spend-bar-fill purple" [style.width]="c.pct + '%'"></div></div>
                </div>
              </div>
            </div>
          </div>

          <div class="panel" style="margin-bottom:24px;">
            <div class="panel-header"><h3>Monthly Spend</h3></div>
            <div class="panel-body">
              <p *ngIf="spend.byMonth.length === 0" class="empty-state">No monthly data.</p>
              <div class="month-chart">
                <div *ngFor="let m of spend.byMonth" class="month-bar-col">
                  <span class="month-amount">₹{{ (m.total / 1000).toFixed(0) }}k</span>
                  <div class="month-bar" [style.height.px]="monthBarHeight(m.total)"></div>
                  <span class="month-label">{{ m.month }}</span>
                </div>
              </div>
            </div>
          </div>
        </ng-container>
      </ng-container>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  data: DashboardResponseDto | null = null;
  spend: SpendAnalyticsDto | null = null;
  loading = true;
  loadingSpend = true;
  errorMessage = "";

  exportFrom = "";
  exportTo = "";

  constructor(private readonly dashboardService: DashboardService) {}

  ngOnInit() {
    this.dashboardService.getSummary().subscribe({
      next: d => { this.data = d; this.loading = false; },
      error: () => { this.errorMessage = "Failed to load dashboard."; this.loading = false; },
    });
    this.dashboardService.getSpend().subscribe({
      next: s => { this.spend = s; this.loadingSpend = false; },
      error: () => { this.loadingSpend = false; },
    });
  }

  downloadAccountingExport() {
    const params = new URLSearchParams();
    if (this.exportFrom) params.set("from", this.exportFrom);
    if (this.exportTo) params.set("to", this.exportTo);
    const qs = params.toString();
    window.open(`${environment.apiUrl}/quotations/accounting-export${qs ? "?" + qs : ""}`, "_blank");
  }

  formatCategory(cat: string): string {
    return cat.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  barWidth(count: number): number {
    const max = this.data?.categoryBreakdown[0]?.count ?? 1;
    return Math.round((count / max) * 80);
  }

  monthBarHeight(total: number): number {
    const max = this.spend?.byMonth.reduce((m, r) => Math.max(m, r.total), 1) ?? 1;
    return Math.max(4, Math.round((total / max) * 64));
  }
}
