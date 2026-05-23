import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { RouterLink } from "@angular/router";
import { DashboardResponseDto } from "@fulfilus/shared";
import { DashboardService } from "../services/dashboard.service";

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="admin-page">
      <div class="admin-header">
        <h2>Dashboard</h2>
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
        <div class="vendor-form">
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
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  data: DashboardResponseDto | null = null;
  loading = true;
  errorMessage = "";

  constructor(private readonly dashboardService: DashboardService) {}

  ngOnInit() {
    this.dashboardService.getSummary().subscribe({
      next: d => { this.data = d; this.loading = false; },
      error: () => { this.errorMessage = "Failed to load dashboard."; this.loading = false; },
    });
  }

  formatCategory(cat: string): string {
    return cat.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  barWidth(count: number): number {
    const max = this.data?.categoryBreakdown[0]?.count ?? 1;
    return Math.round((count / max) * 80);
  }
}
