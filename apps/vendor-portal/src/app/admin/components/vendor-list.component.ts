import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { ContactStatus, VendorCategory, VendorResponseDto } from "@fulfilus/shared";
import { VendorService } from "../../vendor/services/vendor.service";

@Component({
  selector: "app-vendor-list",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="admin-page">
      <div class="admin-header">
        <h2>Vendor Management</h2>
        <a routerLink="/" class="btn-secondary">+ Add Vendor</a>
      </div>

      <!-- Filters -->
      <div class="filters">
        <input [(ngModel)]="search" (ngModelChange)="onFilter()" placeholder="Search by name..." />
        <select [(ngModel)]="statusFilter" (ngModelChange)="onFilter()">
          <option value="">All statuses</option>
          <option [value]="ContactStatus.CONTACTED">Contacted</option>
          <option [value]="ContactStatus.NOT_CONTACTED">Not Contacted</option>
        </select>
        <select [(ngModel)]="categoryFilter" (ngModelChange)="onFilter()">
          <option value="">All categories</option>
          <option *ngFor="let cat of allCategories" [value]="cat">{{ formatCategory(cat) }}</option>
        </select>
      </div>

      <!-- Table -->
      <div class="table-wrapper">
        <table *ngIf="filtered.length; else empty">
          <thead>
            <tr>
              <th>Shop Name</th>
              <th>Location</th>
              <th>WhatsApp</th>
              <th>Categories</th>
              <th>Status</th>
              <th>Added</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let v of paginated">
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
              <td>{{ v.createdAt | date:'dd MMM yy' }}</td>
              <td>
                <a [routerLink]="['/admin/vendors', v.id]" class="btn-link">Edit</a>
              </td>
            </tr>
          </tbody>
        </table>
        <ng-template #empty>
          <p class="empty-state">No vendors found.</p>
        </ng-template>
      </div>

      <!-- Pagination -->
      <div class="pagination" *ngIf="filtered.length > pageSize">
        <button (click)="prevPage()" [disabled]="page === 1">Prev</button>
        <span>{{ page }} / {{ totalPages }}</span>
        <button (click)="nextPage()" [disabled]="page === totalPages">Next</button>
      </div>

      <div *ngIf="errorMessage" class="error">{{ errorMessage }}</div>
    </div>
  `,
})
export class VendorListComponent implements OnInit {
  vendors: VendorResponseDto[] = [];
  filtered: VendorResponseDto[] = [];
  paginated: VendorResponseDto[] = [];

  search = "";
  statusFilter = "";
  categoryFilter = "";

  page = 1;
  pageSize = 20;
  totalPages = 1;
  errorMessage = "";

  allCategories = Object.values(VendorCategory);
  ContactStatus = ContactStatus;

  constructor(private readonly vendorService: VendorService, private readonly router: Router) {}

  ngOnInit() {
    this.vendorService.list(1, 200).subscribe({
      next: res => { this.vendors = res.data; this.applyFilters(); },
      error: () => { this.errorMessage = "Failed to load vendors."; },
    });
  }

  onFilter() { this.page = 1; this.applyFilters(); }

  applyFilters() {
    this.filtered = this.vendors.filter(v => {
      const matchName = !this.search || v.shopName.toLowerCase().includes(this.search.toLowerCase());
      const matchStatus = !this.statusFilter || v.contactStatus === this.statusFilter;
      const matchCat = !this.categoryFilter || v.categories.includes(this.categoryFilter as VendorCategory);
      return matchName && matchStatus && matchCat;
    });
    this.totalPages = Math.max(1, Math.ceil(this.filtered.length / this.pageSize));
    this.updatePage();
  }

  updatePage() {
    const start = (this.page - 1) * this.pageSize;
    this.paginated = this.filtered.slice(start, start + this.pageSize);
  }

  prevPage() { if (this.page > 1) { this.page--; this.updatePage(); } }
  nextPage() { if (this.page < this.totalPages) { this.page++; this.updatePage(); } }

  formatCategory(cat: string): string {
    return cat.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }
}
