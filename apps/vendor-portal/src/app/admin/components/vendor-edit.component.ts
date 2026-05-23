import { CommonModule } from "@angular/common";
import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from "@angular/core";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { AuditLogResponseDto, ContactLogResponseDto, ContactLogType, DocumentResponseDto, ContactStatus, PaymentType, VendorCategory, VendorResponseDto } from "@fulfilus/shared";
import { FormsModule } from "@angular/forms";
import { GoogleMapsService } from "../../core/google-maps.service";
import { VendorService } from "../../vendor/services/vendor.service";

@Component({
  selector: "app-vendor-edit",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
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
          <label>Location * <input #locationInput formControlName="location" autocomplete="off" /></label>
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

        <section *ngIf="vendor?.rating || vendor?.placeId" style="display:flex; gap:16px; align-items:center;">
          <span *ngIf="vendor?.rating" style="font-size:13px; color:#d97706;">
            &#9733; {{ vendor!.rating!.toFixed(1) }} / 5 <span style="color:#9ca3af;">(Google Maps)</span>
          </span>
          <span *ngIf="vendor?.confidenceScore != null" style="font-size:13px;">
            AI confidence:
            <strong [style.color]="vendor!.confidenceScore! >= 0.7 ? '#16a34a' : vendor!.confidenceScore! >= 0.4 ? '#d97706' : '#dc2626'">
              {{ (vendor!.confidenceScore! * 100).toFixed(0) }}%
            </strong>
          </span>
          <button type="button" (click)="reEnrich()" [disabled]="reEnriching" class="btn-secondary" style="font-size:12px; padding:4px 10px;">
            {{ reEnriching ? 'Re-enriching...' : 'Re-enrich from Maps' }}
          </button>
          <a *ngIf="vendor?.placeId"
             href="https://maps.google.com/?place_id={{ vendor!.placeId }}"
             target="_blank" class="btn-link" style="font-size:12px;">
            View on Google Maps
          </a>
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
          <a *ngIf="vendor" [routerLink]="['/quotations']" [queryParams]="{ vendorId: vendor.id }"
             class="btn-secondary" style="margin-left:12px;">
            View Quotations
          </a>
          <a *ngIf="vendor" [routerLink]="['/quotations', 'new']" [queryParams]="{ vendorId: vendor.id }"
             class="btn-secondary" style="margin-left:8px;">
            + New Quotation
          </a>
        </div>

        <div *ngIf="successMessage" class="success">{{ successMessage }}</div>
        <div *ngIf="errorMessage" class="error">{{ errorMessage }}</div>
      </form>

      <!-- Documents -->
      <section style="margin-top:32px;" *ngIf="!loading">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="font-size:14px; font-weight:600; color:#374151; margin:0;">Documents</h3>
          <label style="cursor:pointer;" class="btn-secondary">
            {{ docUploading ? 'Uploading...' : '+ Upload Document' }}
            <input type="file" style="display:none;" (change)="onDocSelected($event)" [disabled]="docUploading" />
          </label>
        </div>
        <div class="table-wrapper" *ngIf="documents.length">
          <table>
            <thead><tr><th>Type</th><th>File</th><th>Size</th><th>Added</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let d of documents">
                <td><span class="chip">{{ d.type }}</span></td>
                <td><a [href]="d.url" target="_blank" class="btn-link">View</a></td>
                <td style="font-size:12px; color:#6b7280;">{{ formatBytes(d.sizeBytes) }}</td>
                <td style="white-space:nowrap;">{{ d.createdAt | date:'dd MMM yy' }}</td>
                <td>
                  <button (click)="deleteDoc(d.id)"
                    style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:13px;padding:0;">
                    Delete
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p *ngIf="!documents.length" class="empty-state" style="font-size:12px;">No documents uploaded.</p>
        <div *ngIf="docError" class="error" style="margin-top:8px;">{{ docError }}</div>
      </section>

      <!-- Audit Log -->
      <section style="margin-top:32px;" *ngIf="!loading">
        <h3 style="font-size:14px; font-weight:600; color:#374151; margin-bottom:12px;">Audit History</h3>
        <div *ngIf="auditLoading" class="empty-state">Loading history...</div>
        <div class="table-wrapper" *ngIf="!auditLoading && auditLogs.length">
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Changed By</th>
                <th>When</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let log of auditLogs">
                <td><span class="chip">{{ log.action }}</span></td>
                <td>{{ log.changedBy }}</td>
                <td style="white-space:nowrap;">{{ log.createdAt | date:'dd MMM yy, HH:mm' }}</td>
                <td class="truncate" style="max-width:260px; font-size:12px; color:#6b7280;">
                  {{ log.diff ? (log.diff | json) : '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p *ngIf="!auditLoading && !auditLogs.length" class="empty-state">No audit history yet.</p>
      </section>

      <!-- Contact Log -->
      <section style="margin-top:32px;" *ngIf="!loading">
        <h3 style="font-size:14px; font-weight:600; color:#374151; margin-bottom:12px;">Contact Log</h3>

        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end; margin-bottom:16px; padding:12px; background:#f9fafb; border-radius:8px; border:1px solid #e5e7eb;">
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:11px; color:#6b7280; font-weight:500;">Type</label>
            <select [(ngModel)]="newLogType" style="padding:6px 8px; border:1px solid #d1d5db; border-radius:6px; font-size:13px;">
              <option value="CALL">Call</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="VISIT">Visit</option>
              <option value="EMAIL">Email</option>
            </select>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px; flex:1; min-width:180px;">
            <label style="font-size:11px; color:#6b7280; font-weight:500;">Notes</label>
            <input [(ngModel)]="newLogNotes" placeholder="What was discussed..." style="padding:6px 8px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; width:100%;" />
          </div>
          <div style="display:flex; flex-direction:column; gap:4px; min-width:120px;">
            <label style="font-size:11px; color:#6b7280; font-weight:500;">Contacted by</label>
            <input [(ngModel)]="newLogContactedBy" placeholder="Your name" style="padding:6px 8px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; width:100%;" />
          </div>
          <button type="button" (click)="addContactLog()" [disabled]="!newLogContactedBy.trim() || contactLogSaving"
            style="padding:6px 16px; background:#2563eb; color:#fff; border:none; border-radius:6px; font-size:13px; font-weight:500; cursor:pointer; white-space:nowrap; align-self:flex-end;">
            {{ contactLogSaving ? 'Saving...' : '+ Log Contact' }}
          </button>
        </div>
        <div *ngIf="contactLogError" class="error" style="margin-bottom:8px;">{{ contactLogError }}</div>

        <div *ngIf="contactLogs.length" class="contact-timeline">
          <div *ngFor="let log of contactLogs" class="timeline-entry">
            <div class="timeline-dot" [ngClass]="'dot-' + log.type.toLowerCase()"></div>
            <div class="timeline-body">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="chip" style="font-size:11px;">{{ log.type }}</span>
                <span style="font-size:11px; color:#9ca3af;">{{ log.contactedAt | date:'dd MMM yy, HH:mm' }}</span>
              </div>
              <p *ngIf="log.notes" style="margin:4px 0 0; font-size:13px; color:#374151;">{{ log.notes }}</p>
              <div style="display:flex; justify-content:space-between; margin-top:4px;">
                <span style="font-size:11px; color:#6b7280;">by {{ log.contactedBy }}</span>
                <button (click)="deleteContactLog(log.id)"
                  style="background:none;border:none;color:#dc2626;cursor:pointer;font-size:11px;padding:0;">
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
        <p *ngIf="!contactLogs.length" class="empty-state" style="font-size:12px;">No contact interactions logged yet.</p>
      </section>
    </div>
  `,
})
export class VendorEditComponent implements OnInit, AfterViewInit {
  @ViewChild("locationInput") locationInputRef!: ElementRef<HTMLInputElement>;

  vendor: VendorResponseDto | null = null;
  form: FormGroup | null = null;
  loading = true;
  saving = false;
  successMessage = "";
  errorMessage = "";

  reEnriching = false;

  auditLogs: AuditLogResponseDto[] = [];
  auditLoading = false;

  documents: DocumentResponseDto[] = [];
  docUploading = false;
  docError = "";

  contactLogs: ContactLogResponseDto[] = [];
  contactLogSaving = false;
  contactLogError = "";
  newLogType: ContactLogType = "CALL";
  newLogNotes = "";
  newLogContactedBy = "";

  allCategories = Object.values(VendorCategory);
  ContactStatus = ContactStatus;
  PaymentType = PaymentType;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly fb: FormBuilder,
    private readonly vendorService: VendorService,
    private readonly mapsService: GoogleMapsService,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get("id")!;
    this.vendorService.getById(id).subscribe({
      next: vendor => {
        this.vendor = vendor;
        this.buildForm(vendor);
        this.loading = false;
        this.loadAuditLogs(id);
        this.loadDocuments(id);
        this.loadContactLogs(id);
      },
      error: () => {
        this.errorMessage = "Vendor not found.";
        this.loading = false;
      },
    });
  }

  reEnrich() {
    if (!this.vendor) return;
    this.reEnriching = true;
    this.errorMessage = "";
    this.vendorService.reEnrich(this.vendor.id).subscribe({
      next: result => {
        this.successMessage = `Re-enriched with ${(result.confidence * 100).toFixed(0)}% confidence. Reload to see updates.`;
        this.reEnriching = false;
      },
      error: () => { this.errorMessage = "Re-enrichment failed."; this.reEnriching = false; },
    });
  }

  private loadDocuments(id: string) {
    this.vendorService.listDocuments(id).subscribe({
      next: docs => { this.documents = docs; },
      error: () => {},
    });
  }

  onDocSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.vendor) return;
    this.docUploading = true;
    this.docError = "";
    this.vendorService.uploadDocument(this.vendor.id, file).subscribe({
      next: doc => { this.documents = [doc, ...this.documents]; this.docUploading = false; },
      error: () => { this.docError = "Upload failed."; this.docUploading = false; },
    });
  }

  deleteDoc(docId: string) {
    if (!this.vendor || !confirm("Delete this document?")) return;
    this.vendorService.deleteDocument(this.vendor.id, docId).subscribe({
      next: () => { this.documents = this.documents.filter(d => d.id !== docId); },
      error: () => { this.docError = "Failed to delete document."; },
    });
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private loadContactLogs(id: string) {
    this.vendorService.listContactLogs(id).subscribe({
      next: logs => { this.contactLogs = logs; },
      error: () => {},
    });
  }

  addContactLog() {
    if (!this.vendor || !this.newLogContactedBy.trim()) return;
    this.contactLogSaving = true;
    this.contactLogError = "";
    this.vendorService.addContactLog(this.vendor.id, this.newLogType, this.newLogNotes.trim(), this.newLogContactedBy.trim()).subscribe({
      next: log => {
        this.contactLogs = [log, ...this.contactLogs];
        this.newLogNotes = "";
        this.contactLogSaving = false;
      },
      error: () => { this.contactLogError = "Failed to save contact log."; this.contactLogSaving = false; },
    });
  }

  deleteContactLog(logId: string) {
    if (!this.vendor || !confirm("Remove this contact log entry?")) return;
    this.vendorService.deleteContactLog(this.vendor.id, logId).subscribe({
      next: () => { this.contactLogs = this.contactLogs.filter(l => l.id !== logId); },
      error: () => { this.contactLogError = "Failed to delete contact log."; },
    });
  }

  private loadAuditLogs(id: string) {
    this.auditLoading = true;
    this.vendorService.auditLogs(id).subscribe({
      next: logs => { this.auditLogs = logs; this.auditLoading = false; },
      error: () => { this.auditLoading = false; },
    });
  }

  ngAfterViewInit() {
    this.mapsService.load().then(() => {
      const autocomplete = new google.maps.places.Autocomplete(
        this.locationInputRef.nativeElement,
        { types: ["establishment", "geocode"], fields: ["formatted_address", "name", "geometry"] },
      );
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const address = place.formatted_address ?? place.name ?? "";
        this.form?.patchValue({ location: address });
      });
    }).catch(() => {
      // Maps unavailable — manual input still works
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
