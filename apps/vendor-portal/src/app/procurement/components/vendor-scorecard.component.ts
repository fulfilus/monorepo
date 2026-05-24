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
        <div>
          <a routerLink="/procurement" class="back-link">Procurement</a>
          <h2>Vendor Performance Scorecard</h2>
        </div>
        <a routerLink="/admin" class="btn-secondary">All Vendors</a>
      </div>

      <div *ngIf="loading" class="empty-state">Loading scorecard...</div>

      <div *ngIf="!loading && vendors.length === 0" class="empty-state">
        No vendor bid data yet. Start procurement rounds to track performance.
      </div>

      <ng-container *ngIf="!loading && vendors.length > 0">
        <div class="alert alert-info" style="margin-bottom:16px;">
          <strong>Composite score:</strong> 30% Response Rate + 40% Win Rate + 30% Price Competitiveness
        </div>

        <div class="panel">
          <div class="table-wrapper" style="border-radius:var(--r-xl); overflow:hidden;">
            <table class="scorecard-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th style="text-align:right;">Rounds</th>
                  <th style="text-align:right; min-width:120px;">Response Rate</th>
                  <th style="text-align:right;">Win Rate</th>
                  <th style="text-align:right; min-width:130px;">Price Competitiveness</th>
                  <th style="text-align:right; min-width:110px;">Composite Score</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let v of vendors; let i = index">
                  <td>
                    <div style="font-weight:700;">
                      {{ v.shopName }}
                      <span *ngIf="i === 0" class="top-badge">TOP</span>
                    </div>
                    <div style="font-size:11px; color:var(--text-faint); margin-top:2px;">
                      {{ v.receivedBids }}/{{ v.sentBids }} bids &nbsp;|&nbsp; {{ v.wonBids }} won
                    </div>
                  </td>
                  <td style="text-align:right;">{{ v.totalRounds }}</td>
                  <td style="text-align:right;">
                    <ng-container *ngIf="v.responseRate != null">
                      <div class="score-bar-wrap" style="justify-content:flex-end;">
                        <div class="score-bar">
                          <div class="score-fill" [class.high]="v.responseRate >= 70" [class.mid]="v.responseRate >= 40 && v.responseRate < 70" [class.low]="v.responseRate < 40"
                               [style.width]="v.responseRate + '%'"></div>
                        </div>
                        <span class="score-pill" [class.high]="v.responseRate >= 70" [class.mid]="v.responseRate >= 40 && v.responseRate < 70" [class.low]="v.responseRate < 40">
                          {{ v.responseRate }}%
                        </span>
                      </div>
                    </ng-container>
                    <span *ngIf="v.responseRate == null" style="color:var(--text-faint);">—</span>
                  </td>
                  <td style="text-align:right;">
                    <span *ngIf="v.winRate != null" class="score-pill"
                          [class.high]="v.winRate >= 70" [class.mid]="v.winRate >= 40 && v.winRate < 70" [class.low]="v.winRate < 40">
                      {{ v.winRate }}%
                    </span>
                    <span *ngIf="v.winRate == null" style="color:var(--text-faint);">—</span>
                  </td>
                  <td style="text-align:right;">
                    <span *ngIf="v.priceCompetitiveness != null" class="score-pill"
                          [class.high]="v.priceCompetitiveness >= 70" [class.mid]="v.priceCompetitiveness >= 40 && v.priceCompetitiveness < 70" [class.low]="v.priceCompetitiveness < 40">
                      {{ v.priceCompetitiveness }}%
                    </span>
                    <span *ngIf="v.priceCompetitiveness == null" style="color:var(--text-faint);">—</span>
                  </td>
                  <td style="text-align:right;">
                    <ng-container *ngIf="v.compositeScore != null">
                      <span class="score-pill" style="font-size:15px; min-width:52px;"
                            [class.high]="v.compositeScore >= 70" [class.mid]="v.compositeScore >= 40 && v.compositeScore < 70" [class.low]="v.compositeScore < 40">
                        {{ v.compositeScore }}
                      </span>
                      <span style="font-size:10px; color:var(--text-faint);">/100</span>
                    </ng-container>
                    <span *ngIf="v.compositeScore == null" style="color:var(--text-faint);">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </ng-container>
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
