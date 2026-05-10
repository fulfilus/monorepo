import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import {
  ContactStatus,
  PaymentType,
  VendorCategory,
} from "@fulfilus/shared";
import { Subject, takeUntil } from "rxjs";
import { VendorService } from "../services/vendor.service";

@Component({
  selector: "app-vendor-form",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="vendor-form">
      <h2>Vendor Onboarding</h2>

      <!-- Basic Info -->
      <section>
        <label>Shop Name *
          <input formControlName="shopName" placeholder="Shop name" />
        </label>
        <label>Shop Details
          <textarea formControlName="shopDetails" placeholder="Additional details"></textarea>
        </label>
        <label>Location *
          <input formControlName="location" placeholder="Full address" />
        </label>
        <label>WhatsApp Number *
          <input formControlName="whatsappNumber" placeholder="+91XXXXXXXXXX" />
        </label>
        <label>GST Number
          <input formControlName="gstNumber" placeholder="GSTIN" />
        </label>
      </section>

      <!-- Voice Input -->
      <section>
        <button type="button" (click)="toggleVoice()">
          {{ isListening ? 'Stop Voice' : 'Voice Input' }}
        </button>
        <span *ngIf="isListening" class="listening-indicator">Listening...</span>
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
            {{ cat }}
          </label>
        </div>
      </section>

      <!-- Contact Status -->
      <section>
        <label>Contacted?
          <select formControlName="contactStatus">
            <option [value]="ContactStatus.NOT_CONTACTED">No</option>
            <option [value]="ContactStatus.CONTACTED">Yes</option>
          </select>
        </label>
        <label>Notes
          <textarea formControlName="notes" placeholder="Internal notes"></textarea>
        </label>
      </section>

      <!-- Shop Photo -->
      <section>
        <label>Shop Photo
          <input type="file" accept="image/*" (change)="onPhotoSelected($event)" />
        </label>
        <img *ngIf="photoPreview" [src]="photoPreview" class="photo-preview" alt="Shop preview" />
      </section>

      <!-- Payment Details -->
      <section formGroupName="payment">
        <label>Payment Type
          <select formControlName="type">
            <option [value]="PaymentType.QR_CODE">QR Code</option>
            <option [value]="PaymentType.PHONE_NUMBER">Phone Number</option>
            <option [value]="PaymentType.BANK_ACCOUNT">Bank Account</option>
          </select>
        </label>
        <label>Payment Value
          <input formControlName="value" placeholder="UPI ID / Phone / Account No" />
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

      <div class="actions">
        <button type="submit" [disabled]="form.invalid || submitting">
          {{ submitting ? 'Saving...' : 'Save Vendor' }}
        </button>
      </div>

      <div *ngIf="successMessage" class="success">{{ successMessage }}</div>
      <div *ngIf="errorMessage" class="error">{{ errorMessage }}</div>
    </form>
  `,
})
export class VendorFormComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  allCategories = Object.values(VendorCategory);
  ContactStatus = ContactStatus;
  PaymentType = PaymentType;

  isListening = false;
  voiceError = "";
  photoPreview: string | null = null;
  selectedPhoto: File | null = null;
  submitting = false;
  successMessage = "";
  errorMessage = "";

  private recognition: SpeechRecognition | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly vendorService: VendorService,
  ) {}

  ngOnInit() {
    this.form = this.fb.group({
      shopName: ["", Validators.required],
      shopDetails: [""],
      location: ["", Validators.required],
      whatsappNumber: [
        "",
        [Validators.required, Validators.pattern(/^\+?[1-9]\d{9,14}$/)],
      ],
      gstNumber: [""],
      contactStatus: [ContactStatus.NOT_CONTACTED, Validators.required],
      notes: [""],
      categories: [[], Validators.required],
      payment: this.fb.group({
        type: [PaymentType.QR_CODE],
        value: [""],
      }),
      bankAccount: this.fb.group({
        accountNumber: [""],
        ifscCode: [""],
        accountHolder: [""],
        bankName: [""],
      }),
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.recognition?.stop();
  }

  toggleCategory(event: Event, category: VendorCategory) {
    const current: VendorCategory[] = this.form.value.categories ?? [];
    const checked = (event.target as HTMLInputElement).checked;
    const updated = checked
      ? [...current, category]
      : current.filter((c) => c !== category);
    this.form.patchValue({ categories: updated });
  }

  isCategorySelected(category: VendorCategory): boolean {
    return (this.form.value.categories ?? []).includes(category);
  }

  onPhotoSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.selectedPhoto = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.photoPreview = e.target?.result as string;
    };
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
    const Rec = (window as unknown as Record<string, unknown>)["SpeechRecognition"] as typeof SpeechRecognition
      ?? (window as unknown as Record<string, unknown>)["webkitSpeechRecognition"] as typeof SpeechRecognition;
    this.recognition = new Rec();
    this.recognition.lang = "en-IN";
    this.recognition.interimResults = false;
    this.recognition.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript;
      const current = this.form.value.notes ?? "";
      this.form.patchValue({ notes: `${current} ${transcript}`.trim() });
    };
    this.recognition.onerror = () => {
      this.voiceError = "Voice recognition error.";
      this.isListening = false;
    };
    this.recognition.onend = () => {
      this.isListening = false;
    };
    this.recognition.start();
    this.isListening = true;
    this.voiceError = "";
  }

  submit() {
    if (this.form.invalid) return;
    this.submitting = true;
    this.successMessage = "";
    this.errorMessage = "";

    this.vendorService
      .create(this.form.value)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (vendor) => {
          if (this.selectedPhoto) {
            this.vendorService
              .uploadPhoto(vendor.id, this.selectedPhoto)
              .pipe(takeUntil(this.destroy$))
              .subscribe();
          }
          this.successMessage = `Vendor "${vendor.shopName}" saved.`;
          this.form.reset();
          this.photoPreview = null;
          this.submitting = false;
        },
        error: (err: unknown) => {
          this.errorMessage =
            err instanceof Error ? err.message : "Failed to save vendor.";
          this.submitting = false;
        },
      });
  }
}
