import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { ProcurementRoundDto, ProcurementRoundTemplateDto } from "@fulfilus/shared";
import { ProcurementService } from "../services/procurement.service";

@Component({
  selector: "app-procurement-list",
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="admin-page">
      <div class="admin-header">
        <h2>Procurement Rounds</h2>
        <a routerLink="/procurement/new" class="btn-secondary">+ New Round</a>
      </div>

      <!-- Templates Panel -->
      <section *ngIf="templates.length" style="margin-bottom:24px; padding:14px 16px; background:#faf5ff; border:1px solid #e9d5ff; border-radius:8px;">
        <h3 style="font-size:13px; font-weight:600; color:#6d28d9; margin:0 0 12px;">Round Templates ({{ templates.length }})</h3>
        <div style="display:flex; flex-wrap:wrap; gap:10px;">
          <div *ngFor="let t of templates"
               style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:#fff; border:1px solid #e9d5ff; border-radius:6px;">
            <div>
              <div style="font-size:13px; font-weight:500; color:#374151;">{{ t.title }}</div>
              <div style="font-size:11px; color:#9ca3af;">{{ templateItemCount(t) }} items</div>
            </div>
            <button (click)="useTemplate(t)" [disabled]="usingTemplateId === t.id"
                    style="font-size:12px; padding:4px 10px; background:#6d28d9; color:#fff; border:none; border-radius:5px; cursor:pointer;">
              {{ usingTemplateId === t.id ? 'Creating...' : 'Use' }}
            </button>
            <button (click)="deleteTemplate(t)"
                    style="font-size:12px; padding:4px 8px; background:none; border:1px solid #dc2626; color:#dc2626; border-radius:5px; cursor:pointer;">
              Delete
            </button>
          </div>
        </div>
        <div *ngIf="templateError" style="margin-top:8px; font-size:12px; color:#dc2626;">{{ templateError }}</div>
      </section>

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
  styles: [`
    .badge.open { background:#dbeafe; color:#1d4ed8; }
    .badge.comparing { background:#fef3c7; color:#92400e; }
    .badge.awarded { background:#d1fae5; color:#065f46; }
    .badge.closed { background:#f3f4f6; color:#374151; }
  `],
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
}
