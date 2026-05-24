import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { CustomerWithQuotesDto } from "@fulfilus/shared";
import { EMPTY, Subject, switchMap, takeUntil } from "rxjs";
import { CustomerService } from "../services/customer.service";

@Component({
  selector: "app-customer-form",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="admin-page" style="max-width:780px;">
      <div class="admin-header">
        <div>
          <a routerLink="/customers" class="back-link">Customers</a>
          <h2>{{ customerId ? 'Edit Customer' : 'New Customer' }}</h2>
        </div>
        <button *ngIf="customerId" type="button" class="btn-danger"
                (click)="deleteCustomer()" [disabled]="deleting">
          {{ deleting ? 'Deleting...' : 'Delete' }}
        </button>
      </div>

      <form [formGroup]="form" (ngSubmit)="save()" class="vendor-form">
        <section>
          <h3>Contact Details</h3>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <label>Name *
              <input formControlName="name" placeholder="Rajesh Kumar" />
            </label>
            <label>Company / Organisation
              <input formControlName="companyName" placeholder="Acme Industrial Pvt Ltd" />
            </label>
            <label>Phone / WhatsApp
              <input formControlName="phone" placeholder="+91 98765 43210" />
            </label>
            <label>Email
              <input formControlName="email" type="email" placeholder="buyer@company.com" />
            </label>
          </div>
          <div style="margin-top:12px;">
            <label>Address
              <textarea formControlName="address" rows="2" placeholder="123 Industrial Area, Sector 5, Gurugram 122001"></textarea>
            </label>
          </div>
        </section>

        <section>
          <h3>GST & Notes</h3>
          <label>GST Number
            <input formControlName="gstNumber" placeholder="27AABCU9603R1ZX" style="max-width:240px;" />
          </label>
          <label style="margin-top:12px;">Notes
            <textarea formControlName="notes" rows="2" placeholder="Any relevant notes about this customer..."></textarea>
          </label>
        </section>

        <!-- Quote history -->
        <section *ngIf="quotes.length">
          <h3>Quote History</h3>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let q of quotes">
                  <td style="font-size:11px; color:var(--text-muted);">{{ q.referenceNumber }}</td>
                  <td>{{ q.title }}</td>
                  <td><span class="badge" [ngClass]="q.status.toLowerCase()">{{ q.status }}</span></td>
                  <td style="font-size:12px; color:var(--text-faint);">{{ q.createdAt | date:'dd MMM yy' }}</td>
                  <td><a [routerLink]="['/sourcing', q.id]" class="btn-link">Open</a></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <div class="actions">
          <button type="submit" [disabled]="form.invalid || saving">
            {{ saving ? 'Saving...' : (customerId ? 'Save Changes' : 'Create Customer') }}
          </button>
          <a routerLink="/customers" class="btn-secondary">Cancel</a>
        </div>
        <div *ngIf="error" class="error" style="margin-top:6px;">{{ error }}</div>
      </form>
    </div>
  `,
})
export class CustomerFormComponent implements OnInit, OnDestroy {
  form: FormGroup;
  customerId: string | null = null;
  saving = false;
  deleting = false;
  error = "";
  quotes: CustomerWithQuotesDto["quotes"] = [];
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly customerService: CustomerService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {
    this.form = this.fb.group({
      name: ["", Validators.required],
      companyName: [""],
      phone: [""],
      email: [""],
      address: [""],
      gstNumber: [""],
      notes: [""],
    });
  }

  ngOnInit() {
    this.route.paramMap.pipe(
      takeUntil(this.destroy$),
      switchMap(params => {
        this.customerId = params.get("id");
        this.quotes = [];
        this.form.reset({ name: "", companyName: "", phone: "", email: "", address: "", gstNumber: "", notes: "" });
        if (!this.customerId) return EMPTY;
        return this.customerService.getOne(this.customerId);
      }),
    ).subscribe({
      next: c => {
        this.form.patchValue({
          name: c.name,
          companyName: c.companyName ?? "",
          phone: c.phone ?? "",
          email: c.email ?? "",
          address: c.address ?? "",
          gstNumber: c.gstNumber ?? "",
          notes: c.notes ?? "",
        });
        this.quotes = c.quotes;
      },
    });
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    this.error = "";
    const v = this.form.value as { name: string; companyName: string; phone: string; email: string; address: string; gstNumber: string; notes: string };
    const payload = {
      name: v.name,
      companyName: v.companyName || undefined,
      phone: v.phone || undefined,
      email: v.email || undefined,
      address: v.address || undefined,
      gstNumber: v.gstNumber || undefined,
      notes: v.notes || undefined,
    };
    const req$ = this.customerId
      ? this.customerService.update(this.customerId, payload)
      : this.customerService.create(payload);
    req$.pipe(takeUntil(this.destroy$)).subscribe({
      next: c => {
        this.saving = false;
        if (!this.customerId) void this.router.navigate(["/customers", c.id]);
      },
      error: () => { this.error = "Failed to save."; this.saving = false; },
    });
  }

  deleteCustomer() {
    if (!this.customerId || !confirm("Delete this customer? Their quotes will not be deleted, just unlinked.")) return;
    this.deleting = true;
    this.customerService.remove(this.customerId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => void this.router.navigate(["/customers"]),
      error: () => { this.error = "Failed to delete."; this.deleting = false; },
    });
  }
}
