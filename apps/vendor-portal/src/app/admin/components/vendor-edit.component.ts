import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { ContactStatus, PaymentType, VendorCategory, VendorResponseDto } from "@fulfilus/shared";
import { VendorService } from "../../vendor/services/vendor.service";

@Component({
  selector: "app-vendor-edit",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="admin-page">
      <div class="admin-header">
        <a routerLink="/admin" class="btn-link">← Back to list</a>
        <h2>{{ vendor?.shopName ?? 'Loading...' }}</h2>
      </div>

      <div *ngIf="loading" class="empty-state">Loading...</div>

      <form *ngIf="form && !loading" [formGroup]="form" (ngSubmit)="save()" class="vendor-form">

        <section>
          <label>Shop Name * <input formControlName="shopName" /></label>
          <label>Shop Details <textarea formControlName="shopDetails"></textarea></label>
          <label>Location * <input formControlName="location" /></label>
          <label>WhatsApp Number * <input formControlName="whatsappNumber" /></label>
          <label>GST Number <input formControlName="gstNumber" /></label>
        </section>

        <section>
          <label>Categories *</label>
          <div class="category-grid">
            <label *ngFor="let cat of allCategories" class="category-chip">
              <input
                type="checkbox"
                [value]="cat"
                (change)="toggleCategory($event, cat)"
                [checked]="isCategorySelected(cat)"
              />
              {{ formatCategory(cat) }}
            </label>
          </div>
        </section>

        <section>
          <label>Contact Status
            <select formControlName="contactStatus">
              <option [value]="ContactStatus.NOT_CONTACTED">Not Contacted</option>
              <option [value]="ContactStatus.CONTACTED">Contacted</option>
            </select>
          </label>
          <label>Notes <textarea formControlName="notes"></textarea></label>
        </section>

        <section *ngIf="vendor?.shopPhotoUrl">
          <label>Current Shop Photo</label>
          <img [src]="vendor!.shopPhotoUrl" class="photo-preview" alt="Shop photo" />
        </section>

        <section formGroupName="payment">
          <h3>Payment</h3>
          <label>Type
            <select formControlName="type">
              <option [value]="PaymentType.QR_CODE">QR Code</option>
              <option [value]="PaymentType.PHONE_NUMBER">Phone Number</option>
              <option [value]="PaymentType.BANK_ACCOUNT">Bank Account</option>
            </select>
          </label>
          <label>Value <input formControlName="value" /></label>
        </section>

        <section formGroupName="bankAccount">
          <h3>Bank Account</h3>
          <label>Account Number <input formControlName="accountNumber" /></label>
          <label>IFSC Code <input formControlName="ifscCode" /></label>
          <label>Account Holder <input formControlName="accountHolder" /></label>
          <label>Bank Name <input formControlName="bankName" /></label>
        </section>

        <div class="actions">
          <button type="submit" [disabled]="form.invalid || saving">
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>

        <div *ngIf="successMessage" class="success">{{ successMessage }}</div>
        <div *ngIf="errorMessage" class="error">{{ errorMessage }}</div>
      </form>
    </div>
  `,
})
export class VendorEditComponent implements OnInit {
  vendor: VendorResponseDto | null = null;
  form: FormGroup | null = null;
  loading = true;
  saving = false;
  successMessage = "";
  errorMessage = "";

  allCategories = Object.values(VendorCategory);
  ContactStatus = ContactStatus;
  PaymentType = PaymentType;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly fb: FormBuilder,
    private readonly vendorService: VendorService,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get("id")!;
    this.vendorService.getById(id).subscribe({
      next: vendor => {
        this.vendor = vendor;
        this.buildForm(vendor);
        this.loading = false;
      },
      error: () => {
        this.errorMessage = "Vendor not found.";
        this.loading = false;
      },
    });
  }

  buildForm(v: VendorResponseDto) {
    this.form = this.fb.group({
      shopName: [v.shopName, Validators.required],
      shopDetails: [v.shopDetails ?? ""],
      location: [v.location, Validators.required],
      whatsappNumber: [v.whatsappNumber, [Validators.required, Validators.pattern(/^\+?[1-9]\d{9,14}$/)]],
      gstNumber: [v.gstNumber ?? ""],
      contactStatus: [v.contactStatus, Validators.required],
      notes: [v.notes ?? ""],
      categories: [v.categories, Validators.required],
      payment: this.fb.group({
        type: [v.payment?.type ?? PaymentType.QR_CODE],
        value: [v.payment?.value ?? ""],
      }),
      bankAccount: this.fb.group({
        accountNumber: [v.bankAccount?.accountNumber ?? ""],
        ifscCode: [v.bankAccount?.ifscCode ?? ""],
        accountHolder: [v.bankAccount?.accountHolder ?? ""],
        bankName: [v.bankAccount?.bankName ?? ""],
      }),
    });
  }

  toggleCategory(event: Event, category: VendorCategory) {
    const current: VendorCategory[] = this.form!.value.categories ?? [];
    const checked = (event.target as HTMLInputElement).checked;
    this.form!.patchValue({
      categories: checked ? [...current, category] : current.filter(c => c !== category),
    });
  }

  isCategorySelected(category: VendorCategory): boolean {
    return (this.form!.value.categories ?? []).includes(category);
  }

  formatCategory(cat: string): string {
    return cat.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  save() {
    if (!this.form || this.form.invalid) return;
    this.saving = true;
    this.successMessage = "";
    this.errorMessage = "";
    this.vendorService.update(this.vendor!.id, this.form.value).subscribe({
      next: updated => {
        this.vendor = updated;
        this.successMessage = "Changes saved.";
        this.saving = false;
      },
      error: () => {
        this.errorMessage = "Failed to save changes.";
        this.saving = false;
      },
    });
  }
}
