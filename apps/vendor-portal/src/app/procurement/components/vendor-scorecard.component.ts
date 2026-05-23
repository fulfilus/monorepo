import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { RouterLink } from "@angular/router";
import { VendorScorecardDto } from "@fulfilus/shared";
import { ProcurementService } from "../services/procurement.service";

@Component({
  selector: "app-vendor-scorecard",
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="admin-page">
      <div class="admin-header">
        <a routerLink="/procurement" class="btn-link">← Procurement</a>
        <h2>Vendor Performance Scorecard</h2>
      </div>

      <div *ngIf="loading" class="empty-state">Loading scorecard...</div>

      <div *ngIf="!loading && vendors.length === 0" class="empty-state">
        No vendor bid data yet. Start procurement rounds to track performance.
      </div>

      <div *ngIf="!loading && vendors.length > 0">
        <!-- Score legend -->
        <div style="margin-bottom:16px; padding:10px 14px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px; font-size:12px; color:#6b7280;">
          <strong style="color:#374151;">How scores are calculated:</strong>
          Response Rate = bids responded / bids sent &nbsp;|&nbsp;
          Win Rate = rounds awarded / bids responded &nbsp;|&nbsp;
          Price Competitiveness = rounds with at least one lowest price / rounds participated &nbsp;|&nbsp;
          Composite = 30% Response + 40% Win Rate + 30% Competitiveness
        </div>

        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="padding:10px 12px; text-align:left;">Vendor</th>
                <th style="padding:10px 12px; text-align:right; min-width:80px;">Rounds</th>
                <th style="padding:10px 12px; text-align:right; min-width:90px;">Response Rate</th>
                <th style="padding:10px 12px; text-align:right; min-width:80px;">Win Rate</th>
                <th style="padding:10px 12px; text-align:right; min-width:110px;">Price Competitiveness</th>
                <th style="padding:10px 12px; text-align:right; min-width:100px;">Composite Score</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let v of vendors; let i = index"
                  style="border-bottom:1px solid #f3f4f6;"
                  [style.background]="i === 0 ? '#f0fdf4' : 'white'">
                <td style="padding:10px 12px;">
                  <div style="font-weight:600;">{{ v.shopName }}</div>
                  <div style="font-size:11px; color:#9ca3af;">
                    {{ v.receivedBids }}/{{ v.sentBids }} bids responded &nbsp;|&nbsp; {{ v.wonBids }} won
                  </div>
                </td>
                <td style="padding:10px 12px; text-align:right; color:#374151;">{{ v.totalRounds }}</td>
                <td style="padding:10px 12px; text-align:right;">
                  <ng-container *ngIf="v.responseRate != null">
                    <span [style.color]="scoreColor(v.responseRate)">{{ v.responseRate }}%</span>
                    <div style="margin-top:3px; height:4px; border-radius:2px; background:#e5e7eb; width:64px; display:inline-block; vertical-align:middle; margin-left:6px;">
                      <div [style.width]="v.responseRate + '%'" [style.background]="scoreColor(v.responseRate)" style="height:100%; border-radius:2px; transition:width 0.3s;"></div>
                    </div>
                  </ng-container>
                  <span *ngIf="v.responseRate == null" style="color:#d1d5db;">—</span>
                </td>
                <td style="padding:10px 12px; text-align:right;">
                  <span *ngIf="v.winRate != null" [style.color]="scoreColor(v.winRate)">{{ v.winRate }}%</span>
                  <span *ngIf="v.winRate == null" style="color:#d1d5db;">—</span>
                </td>
                <td style="padding:10px 12px; text-align:right;">
                  <span *ngIf="v.priceCompetitiveness != null" [style.color]="scoreColor(v.priceCompetitiveness)">{{ v.priceCompetitiveness }}%</span>
                  <span *ngIf="v.priceCompetitiveness == null" style="color:#d1d5db;">—</span>
                </td>
                <td style="padding:10px 12px; text-align:right;">
                  <ng-container *ngIf="v.compositeScore != null">
                    <span style="font-size:16px; font-weight:700;" [style.color]="scoreColor(v.compositeScore)">{{ v.compositeScore }}</span>
                    <span style="font-size:11px; color:#9ca3af;">/100</span>
                    <span *ngIf="i === 0" style="margin-left:6px; font-size:11px; background:#d1fae5; color:#065f46; padding:1px 6px; border-radius:10px;">Top</span>
                  </ng-container>
                  <span *ngIf="v.compositeScore == null" style="color:#d1d5db;">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export class VendorScorecardComponent implements OnInit {
  vendors: VendorScorecardDto[] = [];
  loading = true;

  constructor(private readonly procurementService: ProcurementService) {}

  ngOnInit() {
    this.procurementService.getVendorScorecard().subscribe({
      next: v => { this.vendors = v; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  scoreColor(score: number): string {
    if (score >= 70) return "#16a34a";
    if (score >= 40) return "#d97706";
    return "#dc2626";
  }
}
