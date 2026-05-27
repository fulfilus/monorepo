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
        <div class="admin-header-actions">
          <button (click)="showMerge = !showMerge; mergeResult = null; mergeError = ''" class="btn-secondary">Merge Duplicates</button>
          <button (click)="exportCsv()" class="btn-secondary">Export CSV</button>
          <label style="cursor:pointer;">
            <input type="file" accept=".csv,text/csv" style="display:none;" (change)="onImportFile($event)" [disabled]="importing" />
            <span class="btn-secondary" [style.opacity]="importing ? '0.6' : '1'">{{ importing ? 'Importing...' : 'Import CSV' }}</span>
          </label>
          <a routerLink="/procurement/scorecard" class="btn-secondary">Vendor Scorecard</a>
          <button (click)="showIndiamartImport = !showIndiamartImport; indiamartResult = null; indiamartError = ''" class="btn-secondary">Import from IndiaMart</button>
          <a routerLink="/" class="btn-secondary">+ Add Vendor</a>
        </div>
      </div>

      <div *ngIf="showIndiamartImport" class="merge-panel">
        <h3>Import Vendors from IndiaMart</h3>
        <p>Searches IndiaMart for suppliers in the specified city and adds them to the vendor list. Duplicates (matched by name) are skipped.</p>
        <div class="merge-fields" style="flex-wrap:wrap; gap:12px;">
          <label style="flex:2; min-width:200px;">Search Query
            <input [(ngModel)]="imQuery" placeholder="e.g. grocery, food supplier, vegetable wholesale" [disabled]="imLoading" />
          </label>
          <label style="flex:1; min-width:140px;">City
            <input [(ngModel)]="imCity" placeholder="Hyderabad" [disabled]="imLoading" />
          </label>
          <label style="flex:1; min-width:140px;">Max Pages (20/page)
            <input type="number" [(ngModel)]="imMaxPages" min="1" max="50" [disabled]="imLoading" />
          </label>
          <label style="display:flex; align-items:center; gap:6px; min-width:220px; font-weight:normal; cursor:pointer;">
            <input type="checkbox" [(ngModel)]="imEnrich" [disabled]="imLoading" />
            <span>Enrich with AI (products + categories)</span>
          </label>
          <div style="display:flex; gap:8px; align-items:flex-end;">
            <button (click)="runIndiamartImport()" [disabled]="!imQuery.trim() || imLoading" class="btn-primary">
              {{ imLoading ? 'Importing...' : 'Run Import' }}
            </button>
            <button (click)="showIndiamartImport = false; indiamartResult = null" class="btn-ghost">Cancel</button>
          </div>
        </div>
        <p style="font-size:12px; color:var(--text-faint); margin-top:8px;">
          Set <code>INDIAMART_API_KEY</code> in the API .env for direct API access. Without it, falls back to HTML scraping.
          AI enrichment fetches each supplier's product catalog and uses Claude to extract categories and pricing. One API call per vendor — use a lower page count when enabled.
        </p>
        <div *ngIf="indiamartResult" class="import-result" [class.ok]="!indiamartResult.errors.length" [class.error]="indiamartResult.errors.length > 0" style="margin-top:12px;">
          Found: <strong>{{ indiamartResult.total }}</strong> &nbsp;|&nbsp;
          Imported: <strong>{{ indiamartResult.imported }}</strong> &nbsp;|&nbsp;
          Duplicates skipped: <strong>{{ indiamartResult.duplicates }}</strong> &nbsp;|&nbsp;
          Errors: <strong>{{ indiamartResult.errors.length }}</strong>
          <div *ngIf="indiamartResult.errors.length" class="import-errors" style="margin-top:6px;">
            <div *ngFor="let e of indiamartResult.errors.slice(0, 10)">{{ e.name }}: {{ e.reason }}</div>
          </div>
        </div>
        <div *ngIf="indiamartError" class="alert alert-error" style="margin-top:8px;">{{ indiamartError }}</div>
      </div>

      <div *ngIf="importResult" class="import-result" [class.ok]="!importResult.errors.length" [class.error]="importResult.errors.length > 0">
        Imported: <strong>{{ importResult.imported }}</strong> &nbsp;|&nbsp; Skipped: <strong>{{ importResult.skipped }}</strong>
        <div *ngIf="importResult.errors.length" class="import-errors">
          <div *ngFor="let e of importResult.errors">Row {{ e.row }}: {{ e.reason }}</div>
        </div>
      </div>

      <div *ngIf="showMerge" class="merge-panel">
        <h3>Merge Duplicate Vendors</h3>
        <p>All data from the <strong>source</strong> vendor will be moved to the <strong>target</strong> vendor. The source will be permanently deleted.</p>
        <div class="merge-fields">
          <label>Source (to delete)
            <select [(ngModel)]="mergeSourceId">
              <option value="">Select vendor...</option>
              <option *ngFor="let v of vendors" [value]="v.id">{{ v.shopName }}</option>
            </select>
          </label>
          <label>Target (to keep)
            <select [(ngModel)]="mergeTargetId">
              <option value="">Select vendor...</option>
              <option *ngFor="let v of vendors" [value]="v.id" [disabled]="v.id === mergeSourceId">{{ v.shopName }}</option>
            </select>
          </label>
          <button (click)="doMerge()" [disabled]="!mergeSourceId || !mergeTargetId || mergeSourceId === mergeTargetId || merging" class="btn-danger">
            {{ merging ? 'Merging...' : 'Merge & Delete Source' }}
          </button>
          <button (click)="showMerge = false; mergeResult = null" class="btn-ghost">Cancel</button>
        </div>
        <div *ngIf="mergeResult" class="alert alert-success" style="margin-top:10px;">
          Merged "{{ mergeResult.deletedName }}" into "{{ mergeResult.survivingName }}". Source vendor deleted.
        </div>
        <div *ngIf="mergeError" class="alert alert-error" style="margin-top:8px;">{{ mergeError }}</div>
      </div>

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

      <div *ngIf="selectedIds.size > 0" class="bulk-bar">
        <span>{{ selectedIds.size }} selected</span>
        <button (click)="bulkMark('CONTACTED')" [disabled]="bulkWorking" class="btn-secondary">Mark Contacted</button>
        <button (click)="bulkMark('NOT_CONTACTED')" [disabled]="bulkWorking" class="btn-secondary">Mark Not Contacted</button>
        <span class="bulk-bar-spacer"></span>
        <button (click)="clearSelection()" class="btn-ghost">Clear</button>
      </div>

      <div class="table-wrapper">
        <table *ngIf="vendors.length; else empty">
          <thead>
            <tr>
              <th style="width:32px;"><input type="checkbox" (change)="toggleAll($event)" [checked]="allSelected" /></th>
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
              <td><strong>{{ v.shopName }}</strong></td>
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
                <span *ngIf="v.confidenceScore != null" class="score-pill"
                  [class.high]="v.confidenceScore >= 0.7"
                  [class.mid]="v.confidenceScore >= 0.4 && v.confidenceScore < 0.7"
                  [class.low]="v.confidenceScore < 0.4">
                  {{ (v.confidenceScore * 100).toFixed(0) }}%
                </span>
                <span *ngIf="v.confidenceScore == null" style="color:var(--text-faint); font-size:12px;">—</span>
              </td>
              <td>{{ v.createdAt | date:'dd MMM yy' }}</td>
              <td style="white-space:nowrap;">
                <a [routerLink]="['/admin/vendors', v.id]" class="btn-link">Edit</a>
                &nbsp;
                <button (click)="deleteVendor(v.id, v.shopName)" class="btn-link" style="color:var(--red);">Delete</button>
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

  importing = false;
  importResult: { imported: number; skipped: number; errors: { row: number; reason: string }[] } | null = null;

  showMerge = false;
  mergeSourceId = "";
  mergeTargetId = "";
  merging = false;
  mergeResult: { survivingId: string; survivingName: string; deletedId: string; deletedName: string } | null = null;
  mergeError = "";

  showIndiamartImport = false;
  imQuery = "";
  imCity = "Hyderabad";
  imMaxPages = 5;
  imEnrich = false;
  imLoading = false;
  indiamartResult: { imported: number; skipped: number; duplicates: number; errors: { name: string; reason: string }[]; total: number } | null = null;
  indiamartError = "";

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

  doMerge() {
    if (!this.mergeSourceId || !this.mergeTargetId || this.mergeSourceId === this.mergeTargetId) return;
    const sourceName = this.vendors.find(v => v.id === this.mergeSourceId)?.shopName ?? this.mergeSourceId;
    const targetName = this.vendors.find(v => v.id === this.mergeTargetId)?.shopName ?? this.mergeTargetId;
    if (!confirm(`Merge "${sourceName}" into "${targetName}"?\n\nThis will permanently delete "${sourceName}". All their data will be transferred to "${targetName}". This cannot be undone.`)) return;
    this.merging = true;
    this.mergeError = "";
    this.mergeResult = null;
    this.vendorService.mergeVendors(this.mergeSourceId, this.mergeTargetId).pipe(takeUntil(this.destroy$)).subscribe({
      next: result => {
        this.mergeResult = result;
        this.merging = false;
        this.mergeSourceId = "";
        this.mergeTargetId = "";
        this.reload$.next();
      },
      error: (err: unknown) => {
        this.mergeError = (err as { error?: { message?: string } })?.error?.message ?? "Merge failed.";
        this.merging = false;
      },
    });
  }

  onImportFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.importing = true;
    this.importResult = null;
    this.vendorService.bulkImportCsv(file).pipe(takeUntil(this.destroy$)).subscribe({
      next: result => {
        this.importResult = result;
        this.importing = false;
        input.value = "";
        if (result.imported > 0) this.reload$.next();
      },
      error: () => { this.importing = false; input.value = ""; },
    });
  }

  runIndiamartImport() {
    if (!this.imQuery.trim() || this.imLoading) return;
    this.imLoading = true;
    this.indiamartResult = null;
    this.indiamartError = "";
    this.vendorService.importFromIndiamart(this.imQuery.trim(), this.imCity || "Hyderabad", this.imMaxPages, this.imEnrich)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: result => {
          this.indiamartResult = result;
          this.imLoading = false;
          if (result.imported > 0) this.reload$.next();
        },
        error: (err: unknown) => {
          this.indiamartError = (err as { error?: { message?: string } })?.error?.message ?? "Import failed.";
          this.imLoading = false;
        },
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
