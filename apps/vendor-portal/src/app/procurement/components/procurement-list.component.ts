import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { RouterLink } from "@angular/router";
import { ProcurementRoundDto } from "@fulfilus/shared";
import { ProcurementService } from "../services/procurement.service";

@Component({
  selector: "app-procurement-list",
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="admin-page">
      <div class="admin-header">
        <h2>Procurement Rounds</h2>
        <a routerLink="/procurement/new" class="btn-secondary">+ New Round</a>
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
  loading = true;
  total = 0;
  page = 1;
  limit = 20;
  Math = Math;

  constructor(private readonly procurementService: ProcurementService) {}

  ngOnInit() { this.loadPage(1); }

  loadPage(p: number) {
    this.page = p;
    this.loading = true;
    this.procurementService.list(p, this.limit).subscribe({
      next: res => { this.rounds = res.data; this.total = res.total; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }
}
