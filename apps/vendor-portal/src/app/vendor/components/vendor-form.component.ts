import { CommonModule } from "@angular/common";
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from "@angular/core";
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { RouterLink } from "@angular/router";
import {
  ContactStatus,
  EnrichmentResult,
  PaymentType,
  VendorCategory,
} from "@fulfilus/shared";
import { Subject, interval, switchMap, takeUntil, takeWhile, tap } from "rxjs";
import { GoogleMapsService } from "../../core/google-maps.service";
import { VendorService } from "../services/vendor.service";

@Component({
  selector: "app-vendor-form",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  template: `
    <div class="page-header">
      <h2>Vendor Onboarding</h2>
      <a routerLink="/admin" class="btn-secondary">Admin View</a>
    </div>

    <!-- Maps URL Auto-fill -->
    <div class="vendor-form" style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;">
      <h3 style="margin: 0 0 12px; font-size: 15px; font-weight: 600; color: #444;">Auto-fill from Google Maps</h3>
      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
        <input
          [value]="mapsUrl"
          (input)="mapsUrl = $any($event.target).value"
          placeholder="Paste a Google Maps place URL..."
          style="flex: 1; min-width: 260px; padding: 8px 10px; border: 1px solid #d0d0d0; border-radius: 6px; font-size: 14px;"
          [disabled]="enriching"
        />
        <button
          type="button"
          (click)="enrichFromUrl()"
          [disabled]="!mapsUrl.trim() || enriching"
          style="padding: 8px 18px; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap;"
        >
          {{ enriching ? 'Fetching...' : 'Auto-fill' }}
        </button>
      </div>
      <div *ngIf="enrichError" class="error" style="margin-top: 8px;">{{ enrichError }}</div>
      <div *ngIf="enrichResult" class="success" style="margin-top: 8px;">
        Fields pre-filled from Google Maps &mdash; confidence: {{ confidencePct }}%
        <span style="display: block; font-size: 11px; color: #15803d; margin-top: 2px;">{{ enrichResult.insight }}</span>
      </div>
    </div>

    <!-- IndiaMART Auto-fill -->
    <div class="vendor-form" style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;">
      <h3 style="margin: 0 0 12px; font-size: 15px; font-weight: 600; color: #444;">Auto-fill from IndiaMART</h3>
      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
        <input
          [value]="indiamartUrl"
          (input)="indiamartUrl = $any($event.target).value"
          placeholder="Paste an IndiaMART company URL..."
          style="flex: 1; min-width: 260px; padding: 8px 10px; border: 1px solid #d0d0d0; border-radius: 6px; font-size: 14px;"
          [disabled]="indiamartEnriching"
        />
        <button
          type="button"
          (click)="enrichFromIndiamart()"
          [disabled]="!indiamartUrl.trim() || indiamartEnriching"
          style="padding: 8px 18px; background: #ea580c; color: #fff; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap;"
        >
          {{ indiamartEnriching ? 'Fetching...' : 'Auto-fill' }}
        </button>
      </div>
      <div *ngIf="indiamartError" class="error" style="margin-top: 8px;">{{ indiamartError }}</div>
      <div *ngIf="indiamartResult" class="success" style="margin-top: 8px;">
        Fields pre-filled from IndiaMART &mdash; confidence: {{ indiamartConfidencePct }}%
        <span style="display: block; font-size: 11px; color: #15803d; margin-top: 2px;">{{ indiamartResult.insight }}</span>
      </div>
    </div>

    <!-- JustDial Auto-fill -->
    <div class="vendor-form" style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb;">
      <h3 style="margin: 0 0 12px; font-size: 15px; font-weight: 600; color: #444;">Auto-fill from JustDial</h3>
      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
        <input
          [value]="justdialUrl"
          (input)="justdialUrl = $any($event.target).value"
          placeholder="Paste a JustDial business URL..."
          style="flex: 1; min-width: 260px; padding: 8px 10px; border: 1px solid #d0d0d0; border-radius: 6px; font-size: 14px;"
          [disabled]="justdialEnriching"
        />
        <button
          type="button"
          (click)="enrichFromJustdial()"
          [disabled]="!justdialUrl.trim() || justdialEnriching"
          style="padding: 8px 18px; background: #7c3aed; color: #fff; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap;"
        >
          {{ justdialEnriching ? 'Fetching...' : 'Auto-fill' }}
        </button>
      </div>
      <div *ngIf="justdialError" class="error" style="margin-top: 8px;">{{ justdialError }}</div>
      <div *ngIf="justdialResult" class="success" style="margin-top: 8px;">
        Fields pre-filled from JustDial &mdash; confidence: {{ justdialConfidencePct }}%
        <span style="display: block; font-size: 11px; color: #15803d; margin-top: 2px;">{{ justdialResult.insight }}</span>
      </div>
    </div>

    <form [formGroup]="form" (ngSubmit)="submit()" class="vendor-form">

      <!-- Basic Info -->
      <section>
        <label>Shop Name *
          <input formControlName="shopName" placeholder="Shop name" />
        </label>
        <label>Shop Details
          <textarea formControlName="shopDetails" placeholder="Additional details"></textarea>
        </label>
        <label>Location *
          <div #locationContainer class="place-container"></div>
          <input type="hidden" formControlName="location" />
        </label>
        <label>WhatsApp Number *
          <input formControlName="whatsappNumber" placeholder="+91XXXXXXXXXX" />
        </label>
        <label>GST Number
          <input formControlName="gstNumber" placeholder="GSTIN" />
        </label>
      </section>

      <!-- Voice Input -->
      <section style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        <select [(ngModel)]="voiceTargetField" [ngModelOptions]="{standalone:true}" style="padding:6px 8px; border:1px solid #d1d5db; border-radius:6px; font-size:13px;">
          <option value="auto">Auto-detect field</option>
          <option value="shopName">Shop Name</option>
          <option value="shopDetails">Shop Details</option>
          <option value="location">Location</option>
          <option value="whatsappNumber">WhatsApp Number</option>
          <option value="gstNumber">GST Number</option>
          <option value="notes">Notes</option>
        </select>
        <button type="button" (click)="toggleVoice()" [style.background]="isListening ? '#dc2626' : ''" [style.color]="isListening ? '#fff' : ''">
          {{ isListening ? 'Stop Listening' : 'Voice Input' }}
        </button>
        <span *ngIf="isListening" class="listening-indicator">Listening for "{{ voiceTargetField === 'auto' ? 'any field' : voiceTargetField }}"...</span>
        <small *ngIf="voiceLastFilled" style="color:var(--green);">Filled: {{ voiceLastFilled }}</small>
        <small *ngIf="voiceError" class="error">{{ voiceError }}</small>
      </section>

      <!-- Categories -->
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

      <!-- Contact Status + Notes -->
      <section>
        <label>Contacted?
          <select formControlName="contactStatus">
            <option [value]="ContactStatus.NOT_CONTACTED">No</option>
            <option [value]="ContactStatus.CONTACTED">Yes</option>
          </select>
        </label>
        <label>Notes
          <textarea formControlName="notes" placeholder="Internal notes (supports voice input)"></textarea>
        </label>
      </section>

      <!-- Shop Photo -->
      <section>
        <label>Shop Photo
          <input type="file" accept="image/*" (change)="onPhotoSelected($event)" />
        </label>
        <img *ngIf="photoPreview" [src]="photoPreview" class="photo-preview" alt="Shop preview" />
      </section>

      <!-- Payment -->
      <section formGroupName="payment">
        <label>Payment Type
          <select formControlName="type">
            <option [value]="PaymentType.QR_CODE">QR Code</option>
            <option [value]="PaymentType.PHONE_NUMBER">Phone Number</option>
            <option [value]="PaymentType.BANK_ACCOUNT">Bank Account</option>
          </select>
        </label>
        <label>Payment Value (UPI ID / Phone / Account No)
          <input formControlName="value" />
        </label>
      </section>

      <!-- Bank Account -->
      <section formGroupName="bankAccount">
        <h3>Bank Account Details</h3>
        <label>Account Number <input formControlName="accountNumber" /></label>
        <label>IFSC Code <input formControlName="ifscCode" /></label>
        <label>Account Holder <input formControlName="accountHolder" /></label>
        <label>Bank Name <input formControlName="bankName" /></label>
      </section>

      <!-- Delivery -->
      <section formGroupName="delivery">
        <h3>Delivery Capability</h3>
        <div style="display:flex; gap:16px; flex-wrap:wrap; margin-bottom:12px;">
          <label style="display:flex; align-items:center; gap:6px; font-weight:normal; cursor:pointer;">
            <input type="checkbox" formControlName="deliversOwn" />
            Has own delivery
          </label>
          <label style="display:flex; align-items:center; gap:6px; font-weight:normal; cursor:pointer;">
            <input type="checkbox" formControlName="thirdPartyPickup" />
            Accepts Rapido / Porter pickup
          </label>
        </div>
        <label>Coverage Area
          <input formControlName="coverageArea" placeholder="e.g. Andheri, Borivali, within 20km" />
        </label>
        <label>Min. Order for Delivery (₹)
          <input formControlName="minOrderAmount" type="number" min="0" placeholder="e.g. 1000" />
        </label>
        <label>Delivery Charge (₹)
          <input formControlName="deliveryCharge" type="number" min="0" placeholder="Flat charge, 0 = free" />
        </label>
        <label>Charge Notes
          <input formControlName="chargeNotes" placeholder="e.g. Free above ₹2000, ₹50 below" />
        </label>
      </section>

      <div class="actions">
        <button type="submit" [disabled]="form.invalid || submitting">
          {{ submitting ? 'Saving...' : 'Save Vendor' }}
        </button>
      </div>

      <div *ngIf="successMessage" class="success">{{ successMessage }}</div>
      <div *ngIf="errorMessage" class="error">{{ errorMessage }}</div>
      <div *ngIf="duplicateVendorId" class="error" style="margin-top: 8px;">
        A vendor with this name or WhatsApp number already exists:
        <a [routerLink]="['/admin/vendors', duplicateVendorId]" style="color: inherit; font-weight: 600; text-decoration: underline;">{{ duplicateVendorName }}</a>
      </div>
    </form>
  `,
})
export class VendorFormComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild("locationContainer") locationContainerRef!: ElementRef<HTMLDivElement>;

  form!: FormGroup;
  allCategories = Object.values(VendorCategory);
  ContactStatus = ContactStatus;
  PaymentType = PaymentType;

  isListening = false;
  voiceTargetField = "auto";
  voiceLastFilled = "";
  voiceError = "";
  photoPreview: string | null = null;
  selectedPhoto: File | null = null;
  submitting = false;
  successMessage = "";
  errorMessage = "";
  duplicateVendorId = "";
  duplicateVendorName = "";

  mapsUrl = "";
  enriching = false;
  enrichError = "";
  enrichResult: EnrichmentResult | null = null;
  get confidencePct(): number { return Math.round((this.enrichResult?.confidence ?? 0) * 100); }

  indiamartUrl = "";
  indiamartEnriching = false;
  indiamartError = "";
  indiamartResult: EnrichmentResult | null = null;
  get indiamartConfidencePct(): number { return Math.round((this.indiamartResult?.confidence ?? 0) * 100); }

  justdialUrl = "";
  justdialEnriching = false;
  justdialError = "";
  justdialResult: EnrichmentResult | null = null;
  get justdialConfidencePct(): number { return Math.round((this.justdialResult?.confidence ?? 0) * 100); }

  private recognition: SpeechRecognition | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly vendorService: VendorService,
    private readonly mapsService: GoogleMapsService,
  ) {}

  ngOnInit() {
    this.form = this.fb.group({
      shopName: ["", Validators.required],
      shopDetails: [""],
      location: ["", Validators.required],
      whatsappNumber: ["", [Validators.required, Validators.pattern(/^\+?[1-9]\d{9,14}$/)]],
      gstNumber: [""],
      contactStatus: [ContactStatus.NOT_CONTACTED, Validators.required],
      notes: [""],
      categories: [[], Validators.minLength(1)],
      payment: this.fb.group({ type: [PaymentType.QR_CODE], value: [""] }),
      bankAccount: this.fb.group({
        accountNumber: [""],
        ifscCode: [""],
        accountHolder: [""],
        bankName: [""],
      }),
      delivery: this.fb.group({
        deliversOwn: [false],
        thirdPartyPickup: [false],
        coverageArea: [""],
        minOrderAmount: [null],
        deliveryCharge: [null],
        chargeNotes: [""],
      }),
    });
  }

  ngAfterViewInit() {
    this.mapsService.load().then(() => {
      const pac = new google.maps.places.PlaceAutocompleteElement();
      this.locationContainerRef.nativeElement.appendChild(pac);
      pac.addEventListener("gmp-select", async (event) => {
        const place = event.placePrediction.toPlace();
        await place.fetchFields({ fields: ["formattedAddress", "displayName"] });
        this.form.patchValue({ location: place.formattedAddress ?? place.displayName ?? "" });
      });
    }).catch(() => {
      // Maps unavailable — show a plain text input as fallback
      const fallback = document.createElement("input");
      fallback.placeholder = "Start typing address...";
      fallback.style.cssText = "width:100%;box-sizing:border-box;";
      fallback.addEventListener("input", () => this.form.patchValue({ location: fallback.value }));
      this.locationContainerRef.nativeElement.appendChild(fallback);
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.recognition?.stop();
  }

  enrichFromUrl() {
    if (!this.mapsUrl.trim()) return;
    this.enriching = true;
    this.enrichError = "";
    this.enrichResult = null;

    this.vendorService.startEnrichment(this.mapsUrl.trim()).pipe(
      takeUntil(this.destroy$),
      switchMap(({ jobId }) =>
        interval(2500).pipe(
          switchMap(() => this.vendorService.pollEnrichmentJob(jobId)),
          tap(job => {
            if (job.status === "FAILED") throw new Error(job.errorMessage ?? "Enrichment failed");
          }),
          takeWhile(job => job.status !== "COMPLETED", true),
          takeUntil(this.destroy$),
        )
      ),
    ).subscribe({
      next: (job) => {
        if (job.status !== "COMPLETED") return;
        const payload = job.rawPayload as EnrichmentResult & { placeData?: unknown };
        const result: EnrichmentResult = {
          jobId: job.id,
          shopName: payload.shopName,
          location: payload.location,
          shopDetails: payload.shopDetails,
          categories: payload.categories,
          notes: payload.notes,
          confidence: job.confidenceScore ?? payload.confidence ?? 0,
          insight: payload.insight,
          placeId: payload.placeId,
          enrichedAt: payload.enrichedAt,
          modelUsed: payload.modelUsed,
          whatsappNumber: payload.whatsappNumber,
        };
        this.enrichResult = result;
        this.form.patchValue({
          shopName: result.shopName,
          location: result.location,
          shopDetails: result.shopDetails,
          notes: result.notes,
          categories: result.categories,
          ...(result.whatsappNumber ? { whatsappNumber: result.whatsappNumber } : {}),
        });
        this.enriching = false;
      },
      error: (err: unknown) => {
        this.enrichError = err instanceof Error ? err.message : "Failed to fetch from Google Maps.";
        this.enriching = false;
      },
    });
  }

  enrichFromIndiamart() {
    if (!this.indiamartUrl.trim()) return;
    this.indiamartEnriching = true;
    this.indiamartError = "";
    this.indiamartResult = null;

    this.vendorService.enrichFromIndiamartUrl(this.indiamartUrl.trim()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result: EnrichmentResult) => {
        this.indiamartResult = result;
        this.form.patchValue({
          shopName: result.shopName,
          location: result.location,
          shopDetails: result.shopDetails,
          notes: result.notes,
          categories: result.categories,
        });
        this.indiamartEnriching = false;
      },
      error: () => {
        this.indiamartError = "Failed to fetch from IndiaMART. The page may be blocked or the URL is invalid.";
        this.indiamartEnriching = false;
      },
    });
  }

  enrichFromJustdial() {
    if (!this.justdialUrl.trim()) return;
    this.justdialEnriching = true;
    this.justdialError = "";
    this.justdialResult = null;

    this.vendorService.enrichFromJustdialUrl(this.justdialUrl.trim()).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result: EnrichmentResult) => {
        this.justdialResult = result;
        this.form.patchValue({
          shopName: result.shopName,
          location: result.location,
          shopDetails: result.shopDetails,
          notes: result.notes,
          categories: result.categories,
        });
        this.justdialEnriching = false;
      },
      error: () => {
        this.justdialError = "Failed to fetch from JustDial. The page may be blocked or the URL is invalid.";
        this.justdialEnriching = false;
      },
    });
  }

  formatCategory(cat: string): string {
    return cat.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  toggleCategory(event: Event, category: VendorCategory) {
    const current: VendorCategory[] = this.form.value.categories ?? [];
    const checked = (event.target as HTMLInputElement).checked;
    this.form.patchValue({
      categories: checked ? [...current, category] : current.filter(c => c !== category),
    });
  }

  isCategorySelected(category: VendorCategory): boolean {
    return (this.form.value.categories ?? []).includes(category);
  }

  onPhotoSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.selectedPhoto = file;
    const reader = new FileReader();
    reader.onload = e => { this.photoPreview = e.target?.result as string; };
    reader.readAsDataURL(file);
  }

  toggleVoice() {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      this.voiceError = "Voice input not supported in this browser.";
      return;
    }
    if (this.isListening) {
      this.recognition?.stop();
      this.isListening = false;
      return;
    }
    const Rec = (typeof SpeechRecognition !== "undefined" ? SpeechRecognition : webkitSpeechRecognition);
    this.recognition = new Rec();
    this.recognition.lang = "en-IN";
    this.recognition.interimResults = false;
    this.recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript.trim();
      const field = this.voiceTargetField === "auto" ? this.detectField(transcript) : this.voiceTargetField;
      this.applyTranscript(field, transcript);
      this.voiceLastFilled = field;
    };
    this.recognition.onerror = () => { this.voiceError = "Voice recognition error."; this.isListening = false; };
    this.recognition.onend = () => { this.isListening = false; };
    this.recognition.start();
    this.isListening = true;
    this.voiceError = "";
    this.voiceLastFilled = "";
  }

  private detectField(transcript: string): string {
    const t = transcript.toLowerCase();
    if (/\b(shop name|store name|business name)\b/.test(t)) return "shopName";
    if (/\b(location|address|place)\b/.test(t)) return "location";
    if (/\b(whatsapp|mobile|phone|number)\b/.test(t)) return "whatsappNumber";
    if (/\b(gst|gstin|tax)\b/.test(t)) return "gstNumber";
    if (/\b(details|description|about)\b/.test(t)) return "shopDetails";
    return "notes";
  }

  private applyTranscript(field: string, transcript: string) {
    const appendFields = new Set(["notes", "shopDetails"]);
    if (appendFields.has(field)) {
      const current: string = (this.form.get(field)?.value as string) ?? "";
      this.form.patchValue({ [field]: `${current} ${transcript}`.trim() });
    } else {
      this.form.patchValue({ [field]: transcript });
    }
  }

  submit() {
    if (this.form.invalid) return;
    this.submitting = true;
    this.successMessage = "";
    this.errorMessage = "";
    this.duplicateVendorId = "";
    this.duplicateVendorName = "";

    const payload = {
      ...this.form.value,
      ...(this.enrichResult?.jobId ? { enrichmentJobId: this.enrichResult.jobId } : {}),
    };
    this.vendorService.create(payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: (vendor) => {
        if (this.selectedPhoto) {
          this.vendorService.uploadPhoto(vendor.id, this.selectedPhoto).pipe(takeUntil(this.destroy$)).subscribe({
            error: () => { this.errorMessage = "Vendor saved but photo upload failed."; },
          });
        }
        this.successMessage = `Vendor "${vendor.shopName}" saved.`;
        this.form.reset();
        this.photoPreview = null;
        this.submitting = false;
      },
      error: (err: unknown) => {
        const httpErr = err as { status?: number; error?: { message?: string; existingId?: string; existingName?: string } };
        if (httpErr.status === 409 && httpErr.error?.existingId) {
          this.duplicateVendorId = httpErr.error.existingId;
          this.duplicateVendorName = httpErr.error.existingName ?? "existing vendor";
        } else {
          this.errorMessage = err instanceof Error ? err.message : "Failed to save vendor.";
        }
        this.submitting = false;
      },
    });
  }
}
