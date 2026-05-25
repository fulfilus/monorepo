import { CommonModule } from "@angular/common";
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { AuditLogResponseDto, ContactLogResponseDto, ContactLogType, DocumentResponseDto, ContactStatus, PaymentType, VendorCategory, VendorResponseDto } from "@fulfilus/shared";
import { FormsModule } from "@angular/forms";
import { Subject, interval, switchMap, takeUntil } from "rxjs";
import { GoogleMapsService } from "../../core/google-maps.service";
import { VendorService } from "../../vendor/services/vendor.service";

@Component({
  selector: "app-vendor-edit",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  template: `
    <div class="admin-page">
      <div class="admin-header">
        <div>
          <a routerLink="/admin" class="back-link">Vendors</a>
          <h2>{{ vendor?.shopName ?? 'Loading...' }}</h2>
        </div>
        <div class="admin-header-actions">
          <a routerLink="/procurement/scorecard" class="btn-secondary">Vendor Scorecard</a>
          <a *ngIf="vendor" [routerLink]="['/quotations']" [queryParams]="{ vendorId: vendor.id }" class="btn-secondary">Quotations</a>
        </div>
      </div>

      <div *ngIf="loading" class="empty-state">Loading...</div>

      <form *ngIf="form && !loading" [formGroup]="form" (ngSubmit)="save()" class="vendor-form">

        <section>
          <label>Shop Name * <input formControlName="shopName" /></label>
          <label>Shop Details <textarea formControlName="shopDetails"></textarea></label>
          <label>Location *
            <input formControlName="location" autocomplete="off" placeholder="Current location" />
            <div #locationContainer class="place-container" style="margin-top:4px;"></div>
          </label>
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

        <section *ngIf="vendor?.rating || vendor?.placeId" style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
          <span *ngIf="vendor?.rating" style="font-size:13px; color:var(--amber); font-weight:600;">
            &#9733; {{ vendor!.rating!.toFixed(1) }} / 5 <span style="color:var(--text-faint); font-weight:400;">(Google Maps)</span>
          </span>
          <span *ngIf="vendor?.confidenceScore != null" class="score-pill"
            [class.high]="vendor!.confidenceScore! >= 0.7"
            [class.mid]="vendor!.confidenceScore! >= 0.4 && vendor!.confidenceScore! < 0.7"
            [class.low]="vendor!.confidenceScore! < 0.4">
            AI {{ (vendor!.confidenceScore! * 100).toFixed(0) }}%
          </span>
          <button type="button" (click)="reEnrich()" [disabled]="reEnriching" class="btn-secondary">
            {{ reEnriching ? reEnrichStatus || 'Re-enriching...' : 'Re-enrich from Maps' }}
          </button>
          <a *ngIf="vendor?.placeId"
             href="https://maps.google.com/?place_id={{ vendor!.placeId }}"
             target="_blank" class="btn-link">
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
          <a *ngIf="vendor" [routerLink]="['/quotations', 'new']" [queryParams]="{ vendorId: vendor.id }" class="btn-secondary">
            + New Quotation
          </a>
        </div>

        <div *ngIf="successMessage" class="success">{{ successMessage }}</div>
        <div *ngIf="errorMessage" class="error">{{ errorMessage }}</div>
      </form>

      <!-- Documents -->
      <div class="panel" style="margin-top:24px;" *ngIf="!loading">
        <div class="panel-header">
          <h3>Documents</h3>
          <label style="cursor:pointer;" class="btn-secondary">
            {{ docUploading ? 'Uploading...' : '+ Upload Document' }}
            <input type="file" style="display:none;" (change)="onDocSelected($event)" [disabled]="docUploading" />
          </label>
        </div>
        <div class="table-wrapper" style="border-radius:0 0 var(--r-xl) var(--r-xl);" *ngIf="documents.length">
          <table>
            <thead><tr><th>Type</th><th>File</th><th>Size</th><th>Added</th><th></th></tr></thead>
            <tbody>
              <tr *ngFor="let d of documents">
                <td><span class="chip">{{ d.type }}</span></td>
                <td><a [href]="d.url" target="_blank" class="btn-link">View</a></td>
                <td style="color:var(--text-muted);">{{ formatBytes(d.sizeBytes) }}</td>
                <td style="white-space:nowrap;">{{ d.createdAt | date:'dd MMM yy' }}</td>
                <td><button (click)="deleteDoc(d.id)" class="btn-link" style="color:var(--red);">Delete</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="panel-body" *ngIf="!documents.length">
          <p class="empty-state">No documents uploaded.</p>
        </div>
        <div *ngIf="docError" class="alert alert-error" style="margin:0 16px 16px;">{{ docError }}</div>
      </div>

      <!-- Audit Log -->
      <div class="panel" style="margin-top:24px;" *ngIf="!loading">
        <div class="panel-header"><h3>Audit History</h3></div>
        <div *ngIf="auditLoading" class="panel-body"><p class="empty-state">Loading history...</p></div>
        <div class="table-wrapper" style="border-radius:0 0 var(--r-xl) var(--r-xl);" *ngIf="!auditLoading && auditLogs.length">
          <table>
            <thead><tr><th>Action</th><th>Changed By</th><th>When</th><th>Details</th></tr></thead>
            <tbody>
              <tr *ngFor="let log of auditLogs">
                <td><span class="chip">{{ log.action }}</span></td>
                <td>{{ log.changedBy }}</td>
                <td style="white-space:nowrap;">{{ log.createdAt | date:'dd MMM yy, HH:mm' }}</td>
                <td class="truncate" style="max-width:260px; color:var(--text-muted);">{{ log.diff ? (log.diff | json) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="panel-body" *ngIf="!auditLoading && !auditLogs.length">
          <p class="empty-state">No audit history yet.</p>
        </div>
      </div>

      <!-- Contact Log -->
      <div class="panel" style="margin-top:24px;" *ngIf="!loading">
        <div class="panel-header"><h3>Contact Log</h3></div>
        <div class="panel-body">
          <div class="contact-log-form">
            <div class="contact-log-field">
              <label>Type</label>
              <select [(ngModel)]="newLogType" class="inline-input">
                <option value="CALL">Call</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="VISIT">Visit</option>
                <option value="EMAIL">Email</option>
              </select>
            </div>
            <div class="contact-log-field" style="flex:1; min-width:180px;">
              <label>Notes</label>
              <input [(ngModel)]="newLogNotes" placeholder="What was discussed..." class="inline-input" />
            </div>
            <div class="contact-log-field" style="min-width:140px;">
              <label>Contacted by</label>
              <input [(ngModel)]="newLogContactedBy" placeholder="Your name" class="inline-input" />
            </div>
            <button type="button" (click)="addContactLog()" [disabled]="!newLogContactedBy.trim() || contactLogSaving"
              class="btn-primary" style="align-self:flex-end;">
              {{ contactLogSaving ? 'Saving...' : '+ Log Contact' }}
            </button>
          </div>
          <div *ngIf="contactLogError" class="alert alert-error">{{ contactLogError }}</div>

          <div *ngIf="contactLogs.length" class="contact-timeline" style="margin-top:16px;">
            <div *ngFor="let log of contactLogs" class="timeline-entry">
              <div class="timeline-dot" [ngClass]="'dot-' + log.type.toLowerCase()"></div>
              <div class="timeline-body">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span class="chip">{{ log.type }}</span>
                  <span style="font-size:11px; color:var(--text-faint);">{{ log.contactedAt | date:'dd MMM yy, HH:mm' }}</span>
                </div>
                <p *ngIf="log.notes" style="margin:6px 0 0; font-size:13px;">{{ log.notes }}</p>
                <div style="display:flex; justify-content:space-between; margin-top:6px;">
                  <span style="font-size:11px; color:var(--text-muted);">by {{ log.contactedBy }}</span>
                  <button (click)="deleteContactLog(log.id)" class="btn-link" style="font-size:11px; color:var(--red);">Remove</button>
                </div>
              </div>
            </div>
          </div>
          <p *ngIf="!contactLogs.length" class="empty-state">No contact interactions logged yet.</p>
        </div>
      </div>

      <!-- Vendor Invoices -->
      <div class="panel" style="margin-top:24px;" *ngIf="!loading">
        <div class="panel-header">
          <h3>Invoices ({{ vendorInvoices.length }})</h3>
        </div>
        <div class="panel-body">
          <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(170px,1fr)); gap:8px; margin-bottom:10px;">
            <div>
              <div style="font-size:11px; color:var(--text-muted); margin-bottom:3px;">Invoice #</div>
              <input [(ngModel)]="newInvoice.invoiceNumber" class="inline-input" style="width:100%;" placeholder="INV-2026-001" />
            </div>
            <div>
              <div style="font-size:11px; color:var(--text-muted); margin-bottom:3px;">Amount (₹)</div>
              <input [(ngModel)]="newInvoice.amount" type="number" min="0" class="inline-input" style="width:100%;" placeholder="0.00" />
            </div>
            <div>
              <div style="font-size:11px; color:var(--text-muted); margin-bottom:3px;">Due Date</div>
              <input [(ngModel)]="newInvoice.dueAt" type="date" class="inline-input" style="width:100%;" />
            </div>
            <div>
              <div style="font-size:11px; color:var(--text-muted); margin-bottom:3px;">Notes</div>
              <input [(ngModel)]="newInvoice.notes" class="inline-input" style="width:100%;" placeholder="Optional" />
            </div>
          </div>
          <button (click)="addInvoice()" [disabled]="!newInvoice.invoiceNumber || !newInvoice.amount || savingInvoice" class="btn-primary" style="font-size:12px; padding:6px 14px;">
            {{ savingInvoice ? 'Adding...' : 'Add Invoice' }}
          </button>
          <div *ngIf="invoiceError" class="alert alert-error" style="margin-top:8px;">{{ invoiceError }}</div>
        </div>
        <div class="table-wrapper" *ngIf="vendorInvoices.length" style="border-radius:0 0 var(--r-xl) var(--r-xl);">
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th style="text-align:right;">Amount</th>
                <th>Due</th>
                <th>Paid</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let inv of vendorInvoices">
                <td style="font-weight:600;">{{ inv.invoiceNumber }}</td>
                <td style="text-align:right;">₹{{ inv.amount.toFixed(2) }}</td>
                <td style="color:var(--text-muted);">{{ inv.dueAt ? (inv.dueAt | date:'dd MMM yy') : '—' }}</td>
                <td style="color:var(--green);">{{ inv.paidAt ? (inv.paidAt | date:'dd MMM yy') : '—' }}</td>
                <td>
                  <span class="badge" [ngClass]="inv.paidAt ? 'received' : 'pending'">{{ inv.paidAt ? 'Paid' : 'Unpaid' }}</span>
                </td>
                <td style="display:flex; gap:6px;">
                  <button *ngIf="!inv.paidAt" (click)="markInvoicePaid(inv)" class="btn-link" style="color:var(--green); font-size:12px;">Mark Paid</button>
                  <button (click)="deleteInvoice(inv)" class="btn-link" style="color:var(--red); font-size:12px;">Delete</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="panel-body" *ngIf="!vendorInvoices.length" style="padding:12px 16px;">
          <p class="empty-state">No invoices recorded.</p>
        </div>
      </div>
    </div>
  `,
})
export class VendorEditComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild("locationContainer") locationContainerRef!: ElementRef<HTMLDivElement>;

  vendor: VendorResponseDto | null = null;
  form: FormGroup | null = null;
  loading = true;
  saving = false;
  successMessage = "";
  errorMessage = "";

  reEnriching = false;
  reEnrichStatus = "";
  private readonly destroy$ = new Subject<void>();

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

  vendorInvoices: { id: string; invoiceNumber: string; amount: number; dueAt: string | null; paidAt: string | null; notes: string | null; quotationId: string | null }[] = [];
  newInvoice = { invoiceNumber: "", amount: 0, dueAt: "", notes: "" };
  savingInvoice = false;
  invoiceError = "";

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
        this.loadVendorInvoices(id);
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
    this.reEnrichStatus = "Starting...";
    this.errorMessage = "";
    this.successMessage = "";
    const vendorId = this.vendor.id;
    this.vendorService.reEnrich(vendorId).subscribe({
      next: ({ jobId }) => {
        this.reEnrichStatus = "Running...";
        interval(2000).pipe(
          switchMap(() => this.vendorService.pollEnrichmentJob(jobId)),
          takeUntil(this.destroy$),
        ).subscribe({
          next: job => {
            if (job.status === "COMPLETED") {
              const score = job.confidenceScore != null ? ` — ${(job.confidenceScore * 100).toFixed(0)}% confidence` : "";
              this.reEnrichStatus = `Completed${score}`;
              this.successMessage = `Re-enrichment complete${score}. Reload to see updates.`;
              this.reEnriching = false;
              this.destroy$.next();
              this.vendorService.getById(vendorId).subscribe({ next: v => { this.vendor = v; } });
            } else if (job.status === "FAILED") {
              this.reEnrichStatus = "Failed";
              this.errorMessage = job.errorMessage ?? "Re-enrichment failed.";
              this.reEnriching = false;
              this.destroy$.next();
            }
          },
          error: () => {
            this.errorMessage = "Error polling enrichment status.";
            this.reEnriching = false;
          },
        });
      },
      error: () => { this.errorMessage = "Re-enrichment failed to start."; this.reEnriching = false; this.reEnrichStatus = ""; },
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
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

  loadVendorInvoices(vendorId: string) {
    this.vendorService.listVendorInvoices(vendorId).subscribe({
      next: inv => { this.vendorInvoices = inv; },
      error: () => {},
    });
  }

  addInvoice() {
    if (!this.vendor || !this.newInvoice.invoiceNumber || !this.newInvoice.amount) return;
    this.savingInvoice = true;
    this.invoiceError = "";
    this.vendorService.createVendorInvoice(this.vendor.id, {
      invoiceNumber: this.newInvoice.invoiceNumber,
      amount: this.newInvoice.amount,
      dueAt: this.newInvoice.dueAt || undefined,
      notes: this.newInvoice.notes || undefined,
    }).subscribe({
      next: inv => {
        this.vendorInvoices = [inv, ...this.vendorInvoices];
        this.newInvoice = { invoiceNumber: "", amount: 0, dueAt: "", notes: "" };
        this.savingInvoice = false;
      },
      error: (err: unknown) => {
        this.invoiceError = (err as { error?: { message?: string } })?.error?.message ?? "Failed to add invoice.";
        this.savingInvoice = false;
      },
    });
  }

  markInvoicePaid(inv: { id: string; [key: string]: unknown }) {
    if (!this.vendor) return;
    const paidAt = new Date().toISOString();
    this.vendorService.updateVendorInvoice(this.vendor.id, inv.id, { paidAt }).subscribe({
      next: updated => {
        const idx = this.vendorInvoices.findIndex(i => i.id === inv.id);
        if (idx >= 0) this.vendorInvoices[idx] = { ...this.vendorInvoices[idx], paidAt: updated.paidAt };
      },
      error: () => { this.invoiceError = "Failed to mark as paid."; },
    });
  }

  deleteInvoice(inv: { id: string; invoiceNumber: string }) {
    if (!this.vendor || !confirm(`Delete invoice ${inv.invoiceNumber}?`)) return;
    this.vendorService.deleteVendorInvoice(this.vendor.id, inv.id).subscribe({
      next: () => { this.vendorInvoices = this.vendorInvoices.filter(i => i.id !== inv.id); },
      error: () => { this.invoiceError = "Failed to delete invoice."; },
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
    if (!this.locationContainerRef) return;
    this.mapsService.load().then(() => {
      const pac = new google.maps.places.PlaceAutocompleteElement();
      this.locationContainerRef.nativeElement.appendChild(pac);
      pac.addEventListener("gmp-select", async (event) => {
        const place = event.placePrediction.toPlace();
        await place.fetchFields({ fields: ["formattedAddress", "displayName"] });
        this.form?.patchValue({ location: place.formattedAddress ?? place.displayName ?? "" });
      });
    }).catch(() => {
      // Maps unavailable — existing input handles manual entry
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
