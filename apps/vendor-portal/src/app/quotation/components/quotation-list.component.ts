import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { QuotationResponseDto, QuotationStatus } from "@fulfilus/shared";
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil } from "rxjs";
import { QuotationService } from "../services/quotation.service";

@Component({
  selector: "app-quotation-list",
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="admin-page">
      <div class="admin-header">
        <h2>Quotations</h2>
        <a [routerLink]="['/quotations', 'new']" [queryParams]="{ vendorId }" class="btn-secondary">+ New Quotation</a>
      </div>

      <!-- Filters -->
      <div class="filters">
        <input [(ngModel)]="search" (ngModelChange)="onSearchChange($event)" placeholder="Search by title..." />
        <select [(ngModel)]="statusFilter" (ngModelChange)="onFilterChange()">
          <option value="">All statuses</option>
          <option *ngFor="let s of allStatuses" [value]="s">{{ s }}</option>
        </select>
      </div>

      <div class="table-wrapper">
        <table *ngIf="quotations.length; else empty">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Type</th>
              <th>Title</th>
              <th>Status</th>
              <th>Total</th>
              <th>Valid Until</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let q of quotations">
              <td><code>{{ q.referenceNumber }}</code></td>
              <td><span class="chip">{{ formatType(q.type) }}</span></td>
              <td>{{ q.title }}</td>
              <td>
                <span class="badge" [ngClass]="q.status.toLowerCase()">{{ q.status }}</span>
              </td>
              <td>{{ q.totalAmount != null ? ('₹' + q.totalAmount.toFixed(2)) : '—' }}</td>
              <td>{{ q.validUntil ? (q.validUntil | date:'dd MMM yy') : '—' }}</td>
              <td>{{ q.createdAt | date:'dd MMM yy' }}</td>
              <td style="display:flex; gap:8px;">
                <a [routerLink]="['/quotations', q.id]" class="btn-link">View</a>
                <a *ngIf="q.status === QuotationStatus.DRAFT" [routerLink]="['/quotations', q.id, 'edit']" class="btn-link">Edit</a>
                <button
                  *ngIf="q.status === QuotationStatus.DRAFT"
                  (click)="delete(q.id)"
                  class="btn-link"
                  style="color:var(--red);">
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <ng-template #empty>
          <p class="empty-state">{{ loading ? 'Loading...' : 'No quotations found.' }}</p>
        </ng-template>
      </div>

      <!-- Pagination -->
      <div class="pagination" *ngIf="total > pageSize">
        <button (click)="prevPage()" [disabled]="page === 1">Prev</button>
        <span>{{ page }} / {{ totalPages }}</span>
        <button (click)="nextPage()" [disabled]="page === totalPages">Next</button>
      </div>

      <div *ngIf="errorMessage" class="error">{{ errorMessage }}</div>
    </div>
  `,
})
export class QuotationListComponent implements OnInit, OnDestroy {
  quotations: QuotationResponseDto[] = [];
  total = 0;
  page = 1;
  pageSize = 20;
  loading = false;
  errorMessage = "";
  vendorId = "";

  search = "";
  statusFilter = "";
  allStatuses = Object.values(QuotationStatus);
  QuotationStatus = QuotationStatus;

  get totalPages(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }

  private search$ = new Subject<string>();
  private reload$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly quotationService: QuotationService,
  ) {}

  ngOnInit() {
    this.vendorId = this.route.snapshot.queryParamMap.get("vendorId") ?? "";
    if (!this.vendorId) { this.errorMessage = "No vendor specified."; return; }

    this.search$.pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => { this.page = 1; this.reload$.next(); });

    this.reload$.pipe(
      switchMap(() => {
        this.loading = true;
        return this.quotationService.listByVendor(this.vendorId, {
          page: this.page, limit: this.pageSize,
          search: this.search || undefined,
          status: this.statusFilter || undefined,
        });
      }),
      takeUntil(this.destroy$),
    ).subscribe({
      next: res => { this.quotations = res.data; this.total = res.total; this.loading = false; },
      error: () => { this.errorMessage = "Failed to load quotations."; this.loading = false; },
    });

    this.reload$.next();
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  onSearchChange(v: string) { this.search$.next(v); }
  onFilterChange() { this.page = 1; this.reload$.next(); }
  prevPage() { if (this.page > 1) { this.page--; this.reload$.next(); } }
  nextPage() { if (this.page < this.totalPages) { this.page++; this.reload$.next(); } }

  delete(id: string) {
    if (!confirm("Delete this draft quotation?")) return;
    this.quotationService.remove(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.reload$.next(),
      error: () => { this.errorMessage = "Failed to delete quotation."; },
    });
  }

  formatType(type: string): string {
    return type === "RFQ" ? "RFQ" : type === "PRICE_LIST" ? "Price List" : "PO Quote";
  }
}
