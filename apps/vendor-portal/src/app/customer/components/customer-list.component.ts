import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { CustomerDto } from "@fulfilus/shared";
import { debounceTime, Subject } from "rxjs";
import { CustomerService } from "../services/customer.service";

@Component({
  selector: "app-customer-list",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="admin-page">
      <div class="admin-header">
        <div>
          <a routerLink="/admin" class="back-link" style="font-size:13px; color:#6b7280; text-decoration:none;">Vendors</a>
          <h2>Customers</h2>
        </div>
        <a routerLink="/customers/new" class="btn-secondary">+ New Customer</a>
      </div>

      <div class="filters">
        <input [(ngModel)]="search" (ngModelChange)="onSearch($event)"
               placeholder="Search by name, company or phone..." style="max-width:340px;" />
      </div>

      <div *ngIf="loading" class="empty-state">Loading...</div>

      <div class="table-wrapper" *ngIf="!loading && customers.length">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Company</th>
              <th>Phone</th>
              <th>Email</th>
              <th>GST</th>
              <th>Added</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let c of customers">
              <td><strong>{{ c.name }}</strong></td>
              <td>{{ c.companyName || '—' }}</td>
              <td>{{ c.phone || '—' }}</td>
              <td>{{ c.email || '—' }}</td>
              <td style="font-size:11px; color:#6b7280;">{{ c.gstNumber || '—' }}</td>
              <td style="white-space:nowrap; font-size:12px; color:#9ca3af;">{{ c.createdAt | date:'dd MMM yy' }}</td>
              <td>
                <a [routerLink]="['/customers', c.id]" class="btn-link">Edit</a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div *ngIf="!loading && !customers.length" class="empty-state">
        No customers yet. Add one to link them to sourcing quotes.
      </div>

      <div class="pagination" *ngIf="total > limit">
        <button (click)="loadPage(page - 1)" [disabled]="page === 1">Prev</button>
        <span>Page {{ page }} of {{ Math.ceil(total / limit) }}</span>
        <button (click)="loadPage(page + 1)" [disabled]="page * limit >= total">Next</button>
      </div>
    </div>
  `,
})
export class CustomerListComponent implements OnInit {
  customers: CustomerDto[] = [];
  loading = true;
  total = 0;
  page = 1;
  limit = 50;
  search = "";
  Math = Math;
  private readonly searchSubject = new Subject<string>();

  constructor(private readonly customerService: CustomerService) {
    this.searchSubject.pipe(debounceTime(300)).subscribe(() => this.loadPage(1));
  }

  ngOnInit() { this.loadPage(1); }

  onSearch(val: string) { this.search = val; this.searchSubject.next(val); }

  loadPage(p: number) {
    this.page = p;
    this.loading = true;
    this.customerService.list(p, this.limit, this.search || undefined).subscribe({
      next: res => { this.customers = res.data; this.total = res.total; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }
}
