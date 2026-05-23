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
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <input type="date" [(ngModel)]="exportFrom" style="padding:5px 8px; border:1px solid #d1d5db; border-radius:5px; font-size:13px;" />
          <span style="font-size:12px; color:#6b7280;">to</span>
          <input type="date" [(ngModel)]="exportTo" style="padding:5px 8px; border:1px solid #d1d5db; border-radius:5px; font-size:13px;" />
          <button (click)="downloadAccountingExport()" class="btn-secondary" style="font-size:13px;">Export POs (CSV)</button>
        </div>
        <a routerLink="/admin" class="btn-secondary">Manage Vendors</a>
      </div>

      <div *ngIf="loading" class="empty-state">Loading...</div>
      <div *ngIf="errorMessage" class="error">{{ errorMessage }}</div>

      <ng-container *ngIf="data && !loading">

        <!-- KPI row -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:16px; margin-bottom:24px;">
          <div class="vendor-form" style="text-align:center; padding:16px;">
            <div style="font-size:28px; font-weight:700; color:#2563eb;">{{ data.totalVendors }}</div>
            <div style="font-size:12px; color:#6b7280; margin-top:4px;">Total Vendors</div>
          </div>
          <div class="vendor-form" style="text-align:center; padding:16px;">
            <div style="font-size:28px; font-weight:700; color:#16a34a;">{{ data.contactedCount }}</div>
            <div style="font-size:12px; color:#6b7280; margin-top:4px;">Contacted</div>
          </div>
          <div class="vendor-form" style="text-align:center; padding:16px;">
            <div style="font-size:28px; font-weight:700; color:#dc2626;">{{ data.notContactedCount }}</div>
            <div style="font-size:12px; color:#6b7280; margin-top:4px;">Not Contacted</div>
          </div>
          <div class="vendor-form" style="text-align:center; padding:16px;">
            <div style="font-size:28px; font-weight:700; color:#7c3aed;">{{ data.enrichmentCoveragePct }}%</div>
            <div style="font-size:12px; color:#6b7280; margin-top:4px;">AI Enriched</div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px;">

          <!-- Category breakdown -->
          <div class="vendor-form">
            <h3 style="font-size:13px; font-weight:600; margin-bottom:12px;">Top Categories</h3>
            <div *ngFor="let row of data.categoryBreakdown.slice(0,8)"
                 style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-size:13px;">{{ formatCategory(row.category) }}</span>
              <div style="display:flex; align-items:center; gap:8px;">
                <div style="height:8px; background:#2563eb; border-radius:4px;"
                     [style.width.px]="barWidth(row.count)"></div>
                <span style="font-size:12px; color:#6b7280; min-width:24px; text-align:right;">{{ row.count }}</span>
              </div>
            </div>
            <p *ngIf="!data.categoryBreakdown.length" class="empty-state" style="font-size:12px;">No vendors yet.</p>
          </div>

          <!-- Quotation funnel -->
          <div class="vendor-form">
            <h3 style="font-size:13px; font-weight:600; margin-bottom:12px;">Quotation Funnel</h3>
            <div *ngFor="let row of data.quotationFunnel"
                 style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span class="badge" [class.contacted]="row.status === 'ACCEPTED'">{{ row.status }}</span>
              <span style="font-weight:600;">{{ row.count }}</span>
            </div>
            <p *ngIf="!data.quotationFunnel.length" class="empty-state" style="font-size:12px;">No quotations yet.</p>
          </div>

        </div>

        <!-- Recent vendors -->
        <div class="vendor-form" style="margin-bottom:24px;">
          <h3 style="font-size:13px; font-weight:600; margin-bottom:12px;">Recently Added Vendors</h3>
          <div class="table-wrapper">
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
            <ng-template #noRecent><p class="empty-state" style="font-size:12px;">No vendors yet.</p></ng-template>
          </div>
        </div>

      </ng-container>

      <!-- Spend Analytics -->
      <ng-container *ngIf="spend && !loadingSpend">
        <h3 style="font-size:14px; font-weight:600; margin-bottom:16px; border-top:1px solid #e5e7eb; padding-top:20px;">
          Procurement Spend Analytics
        </h3>

        <div *ngIf="spend.totalSpend === 0" class="empty-state" style="margin-bottom:24px;">
          No awarded PO quotes yet. Award procurement rounds to see spend data.
        </div>

        <ng-container *ngIf="spend.totalSpend > 0">
          <!-- Total KPI -->
          <div style="margin-bottom:20px; padding:14px 18px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; display:inline-block;">
            <div style="font-size:26px; font-weight:700; color:#16a34a;">₹{{ spend.totalSpend.toLocaleString() }}</div>
            <div style="font-size:12px; color:#6b7280; margin-top:2px;">Total Awarded Spend</div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">

            <!-- Spend by vendor -->
            <div class="vendor-form">
              <h4 style="font-size:13px; font-weight:600; margin-bottom:12px;">By Vendor</h4>
              <div *ngFor="let v of spend.byVendor.slice(0, 8)" style="margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:3px;">
                  <span style="font-weight:500;">{{ v.shopName }}</span>
                  <span style="color:#6b7280;">₹{{ v.total.toLocaleString() }} ({{ v.pct }}%)</span>
                </div>
                <div style="height:6px; background:#e5e7eb; border-radius:3px;">
                  <div [style.width]="v.pct + '%'" style="height:100%; background:#2563eb; border-radius:3px;"></div>
                </div>
              </div>
            </div>

            <!-- Spend by category -->
            <div class="vendor-form">
              <h4 style="font-size:13px; font-weight:600; margin-bottom:12px;">By Category</h4>
              <div *ngFor="let c of spend.byCategory.slice(0, 8)" style="margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:3px;">
                  <span style="font-weight:500;">{{ formatCategory(c.category) }}</span>
                  <span style="color:#6b7280;">₹{{ c.total.toLocaleString() }} ({{ c.pct }}%)</span>
                </div>
                <div style="height:6px; background:#e5e7eb; border-radius:3px;">
                  <div [style.width]="c.pct + '%'" style="height:100%; background:#7c3aed; border-radius:3px;"></div>
                </div>
              </div>
            </div>

          </div>

          <!-- Spend by month -->
          <div class="vendor-form">
            <h4 style="font-size:13px; font-weight:600; margin-bottom:12px;">Monthly Spend</h4>
            <div *ngIf="spend.byMonth.length === 0" style="font-size:12px; color:#9ca3af;">No monthly data.</div>
            <div style="display:flex; align-items:flex-end; gap:6px; height:80px; overflow-x:auto; padding-bottom:4px;">
              <div *ngFor="let m of spend.byMonth"
                   style="display:flex; flex-direction:column; align-items:center; gap:4px; min-width:56px;">
                <span style="font-size:10px; color:#6b7280;">₹{{ (m.total / 1000).toFixed(0) }}k</span>
                <div [style.height.px]="monthBarHeight(m.total)"
                     style="width:40px; background:#16a34a; border-radius:3px 3px 0 0; min-height:4px;"></div>
                <span style="font-size:10px; color:#9ca3af; white-space:nowrap;">{{ m.month }}</span>
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
