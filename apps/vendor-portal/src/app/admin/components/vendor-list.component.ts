import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { ContactStatus, VendorCategory, VendorResponseDto } from "@fulfilus/shared";
import { environment } from "../../../environments/environment";
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil } from "rxjs";
import { VendorListFilters, VendorService } from "../../vendor/services/vendor.service";

@Component({
  selector: "app-vendor-list",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="admin-page">
      <div class="admin-header">
        <h2>Vendor Management</h2>
        <a routerLink="/admin/dashboard" class="btn-link" style="margin-right:8px;">Dashboard</a>
        <a routerLink="/procurement" class="btn-link" style="margin-right:8px;">Procurement</a>
        <a routerLink="/sourcing" class="btn-link" style="margin-right:8px;">Sourcing</a>
        <a routerLink="/customers" class="btn-link" style="margin-right:8px;">Customers</a>
        <a routerLink="/inbox" class="btn-link" style="margin-right:8px;">Inbox</a>
        <button (click)="exportCsv()" class="btn-secondary" style="margin-right:8px;">Export CSV</button>
        <a routerLink="/" class="btn-secondary">+ Add Vendor</a>
      </div>

      <!-- Filters -->
      <div class="filters">
        <input [(ngModel)]="search" (ngModelChange)="onSearchChange($event)" placeholder="Search by name..." />
        <select [(ngModel)]="statusFilter" (ngModelChange)="onFilterChange()">
          <option value="">All statuses</option>
          <option [value]="ContactStatus.CONTACTED">Contacted</option>
          <option [value]="ContactStatus.NOT_CONTACTED">Not Contacted</option>
        </select>
        <select [(ngModel)]="categoryFilter" (ngModelChange)="onFilterChange()">
          <option value="">All categories</option>
          <option *ngFor="let cat of allCategories" [value]="cat">{{ formatCategory(cat) }}</option>
        </select>
      </div>

      <!-- Bulk action bar -->
      <div *ngIf="selectedIds.size > 0"
           style="display:flex; align-items:center; gap:12px; padding:10px 14px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; margin-bottom:12px;">
        <span style="font-size:13px; font-weight:500;">{{ selectedIds.size }} selected</span>
        <button (click)="bulkMark('CONTACTED')" [disabled]="bulkWorking" class="btn-secondary" style="font-size:12px; padding:4px 10px;">
          Mark Contacted
        </button>
        <button (click)="bulkMark('NOT_CONTACTED')" [disabled]="bulkWorking" class="btn-secondary" style="font-size:12px; padding:4px 10px;">
          Mark Not Contacted
        </button>
        <button (click)="clearSelection()" style="background:none;border:none;color:#6b7280;cursor:pointer;font-size:12px;margin-left:auto;">
          Clear
        </button>
      </div>

      <!-- Table -->
      <div class="table-wrapper">
        <table *ngIf="vendors.length; else empty">
          <thead>
            <tr>
              <th style="width:32px;">
                <input type="checkbox" (change)="toggleAll($event)" [checked]="allSelected" />
              </th>
              <th>Shop Name</th>
              <th>Location</th>
              <th>WhatsApp</th>
              <th>Categories</th>
              <th>Status</th>
              <th>AI</th>
              <th>Added</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let v of vendors">
              <td><input type="checkbox" [checked]="selectedIds.has(v.id)" (change)="toggleOne(v.id, $event)" /></td>
              <td>{{ v.shopName }}</td>
              <td class="truncate">{{ v.location }}</td>
              <td>{{ v.whatsappNumber }}</td>
              <td>
                <span class="chip" *ngFor="let c of v.categories.slice(0,2)">{{ formatCategory(c) }}</span>
                <span class="chip muted" *ngIf="v.categories.length > 2">+{{ v.categories.length - 2 }}</span>
              </td>
              <td>
                <span class="badge" [class.contacted]="v.contactStatus === 'CONTACTED'">
                  {{ v.contactStatus === 'CONTACTED' ? 'Contacted' : 'Not Contacted' }}
                </span>
              </td>
              <td>
                <span *ngIf="v.confidenceScore != null"
                  [style.color]="v.confidenceScore >= 0.7 ? '#16a34a' : v.confidenceScore >= 0.4 ? '#d97706' : '#dc2626'"
                  style="font-size:12px; font-weight:600;">
                  {{ (v.confidenceScore * 100).toFixed(0) }}%
                </span>
                <span *ngIf="v.confidenceScore == null" style="color:#d1d5db; font-size:12px;">—</span>
              </td>
              <td>{{ v.createdAt | date:'dd MMM yy' }}</td>
              <td>
                <a [routerLink]="['/admin/vendors', v.id]" class="btn-link">Edit</a>
                <button (click)="deleteVendor(v.id, v.shopName)"
                  style="background:none;border:none;color:#dc2626;cursor:pointer;padding:0;font-size:13px;">
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <ng-template #empty>
          <p class="empty-state">{{ loading ? 'Loading...' : 'No vendors found.' }}</p>
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
export class VendorListComponent implements OnInit, OnDestroy {
  vendors: VendorResponseDto[] = [];
  total = 0;
  page = 1;
  pageSize = 20;
  loading = false;
  errorMessage = "";

  search = "";
  statusFilter = "";
  categoryFilter = "";

  allCategories = Object.values(VendorCategory);
  ContactStatus = ContactStatus;

  selectedIds = new Set<string>();
  bulkWorking = false;

  get allSelected(): boolean {
    return this.vendors.length > 0 && this.vendors.every(v => this.selectedIds.has(v.id));
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  private search$ = new Subject<string>();
  private reload$ = new Subject<void>();
  private destroy$ = new Subject<void>();

  constructor(private readonly vendorService: VendorService) {}

  ngOnInit() {
    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe(() => {
      this.page = 1;
      this.reload$.next();
    });

    this.reload$.pipe(
      switchMap(() => {
        this.loading = true;
        this.errorMessage = "";
        const filters: VendorListFilters = {
          search: this.search || undefined,
          status: this.statusFilter || undefined,
          category: this.categoryFilter || undefined,
        };
        return this.vendorService.list(this.page, this.pageSize, filters);
      }),
      takeUntil(this.destroy$),
    ).subscribe({
      next: res => {
        this.vendors = res.data;
        this.total = res.total;
        this.loading = false;
      },
      error: () => {
        this.errorMessage = "Failed to load vendors.";
        this.loading = false;
      },
    });

    this.reload$.next();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchChange(value: string) {
    this.search$.next(value);
  }

  onFilterChange() {
    this.page = 1;
    this.reload$.next();
  }

  prevPage() {
    if (this.page > 1) { this.page--; this.reload$.next(); }
  }

  nextPage() {
    if (this.page < this.totalPages) { this.page++; this.reload$.next(); }
  }

  deleteVendor(id: string, name: string) {
    if (!confirm(`Delete vendor "${name}"? This cannot be undone.`)) return;
    this.vendorService.remove(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.reload$.next(),
      error: () => { this.errorMessage = "Failed to delete vendor."; },
    });
  }

  toggleAll(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) { this.vendors.forEach(v => this.selectedIds.add(v.id)); }
    else { this.selectedIds.clear(); }
  }

  toggleOne(id: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) { this.selectedIds.add(id); } else { this.selectedIds.delete(id); }
  }

  clearSelection() { this.selectedIds.clear(); }

  bulkMark(status: string) {
    if (this.selectedIds.size === 0) return;
    this.bulkWorking = true;
    this.vendorService.bulkStatus([...this.selectedIds], status).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.clearSelection(); this.bulkWorking = false; this.reload$.next(); },
      error: () => { this.errorMessage = "Bulk update failed."; this.bulkWorking = false; },
    });
  }

  exportCsv() {
    const params = new URLSearchParams();
    if (this.search) params.set("search", this.search);
    if (this.statusFilter) params.set("status", this.statusFilter);
    if (this.categoryFilter) params.set("category", this.categoryFilter);
    const qs = params.toString();
    window.location.href = `${environment.apiUrl}/vendors/export${qs ? "?" + qs : ""}`;
  }

  formatCategory(cat: string): string {
    return cat.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }
}
