import { CommonModule } from "@angular/common";
import { Component, ElementRef, OnDestroy, ViewChild } from "@angular/core";
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { Subject, takeUntil } from "rxjs";
import { ProcurementService } from "../services/procurement.service";

declare class BarcodeDetector {
  constructor(opts: { formats: string[] });
  detect(image: ImageBitmapSource): Promise<Array<{ rawValue: string; format: string }>>;
  static getSupportedFormats(): Promise<string[]>;
}

@Component({
  selector: "app-procurement-form",
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="admin-page">
      <div class="admin-header">
        <a routerLink="/procurement" class="btn-link">← Procurement</a>
        <h2>New Procurement Round</h2>
      </div>

      <form [formGroup]="form" (ngSubmit)="save()" class="vendor-form">
        <section>
          <label>Title *
            <input formControlName="title" placeholder="e.g. Monthly Grocery Restocking — June 2026" />
          </label>
          <label>Notes
            <textarea formControlName="notes" rows="3" placeholder="Any special instructions or context for vendors..."></textarea>
          </label>
        </section>

        <section>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3 style="margin:0;">Items to Source</h3>
            <button type="button" (click)="addItem()" style="padding:6px 14px; background:#16a34a; color:#fff; border:none; border-radius:6px; font-size:13px; cursor:pointer;">
              + Add Item
            </button>
          </div>

          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
              <thead>
                <tr style="background:#f3f4f6;">
                  <th style="padding:8px; text-align:left;">Item Name *</th>
                  <th style="padding:8px; text-align:left;">Description</th>
                  <th style="padding:8px; text-align:right; width:80px;">Qty</th>
                  <th style="padding:8px; text-align:left; width:70px;">Unit</th>
                  <th style="padding:8px; text-align:right; width:120px;">Target Price (₹)</th>
                  <th style="padding:8px; text-align:left; width:100px;">Barcode</th>
                  <th style="padding:8px; width:36px;"></th>
                </tr>
              </thead>
              <tbody formArrayName="items">
                <tr *ngFor="let row of items.controls; let i = index" [formGroupName]="i">
                  <td style="padding:4px 8px;">
                    <input formControlName="itemName" style="width:160px; padding:4px 6px; border:1px solid #d1d5db; border-radius:4px;" placeholder="e.g. Rice 25kg" />
                  </td>
                  <td style="padding:4px 8px;">
                    <input formControlName="description" style="width:140px; padding:4px 6px; border:1px solid #d1d5db; border-radius:4px;" />
                  </td>
                  <td style="padding:4px 8px;">
                    <input formControlName="quantity" type="number" min="0" style="width:70px; padding:4px 6px; border:1px solid #d1d5db; border-radius:4px; text-align:right;" />
                  </td>
                  <td style="padding:4px 8px;">
                    <input formControlName="unit" style="width:60px; padding:4px 6px; border:1px solid #d1d5db; border-radius:4px;" placeholder="kg" />
                  </td>
                  <td style="padding:4px 8px;">
                    <input formControlName="targetPrice" type="number" min="0" style="width:100px; padding:4px 6px; border:1px solid #d1d5db; border-radius:4px; text-align:right;" />
                  </td>
                  <td style="padding:4px 8px;">
                    <div style="display:flex; align-items:center; gap:4px;">
                      <input formControlName="barcode" style="width:72px; padding:4px 6px; border:1px solid #d1d5db; border-radius:4px; font-size:11px;"
                             placeholder="barcode" (keydown.enter)="$event.preventDefault(); lookupBarcode(i)" />
                      <button type="button" (click)="openScanner(i)" title="Scan barcode"
                              style="padding:3px 6px; border:1px solid #d1d5db; border-radius:4px; background:#f9fafb; cursor:pointer; font-size:14px; line-height:1;">&#x1F4F7;</button>
                    </div>
                    <div *ngIf="lookupState[i]" style="font-size:11px; margin-top:2px;"
                         [style.color]="lookupState[i] === 'found' ? '#16a34a' : lookupState[i] === 'not_found' ? '#dc2626' : '#6b7280'">
                      {{ lookupState[i] === 'found' ? 'Auto-filled' : lookupState[i] === 'not_found' ? 'Not found' : 'Looking up...' }}
                    </div>
                  </td>
                  <td style="padding:4px 8px;">
                    <button type="button" (click)="removeItem(i)" [disabled]="items.length === 1"
                            style="color:#dc2626; background:none; border:none; cursor:pointer; font-size:16px; opacity:0.8;" title="Remove">&#x2715;</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <div class="actions">
          <button type="submit" [disabled]="form.invalid || saving">
            {{ saving ? 'Creating...' : 'Create Round' }}
          </button>
          <a routerLink="/procurement" class="btn-secondary">Cancel</a>
        </div>

        <div *ngIf="error" class="error" style="margin-top:8px;">{{ error }}</div>
      </form>

      <!-- Camera scanner modal -->
      <div *ngIf="scannerOpen" style="position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:1000; display:flex; align-items:center; justify-content:center;">
        <div style="background:#fff; border-radius:12px; padding:20px; width:360px; max-width:95vw;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3 style="font-size:14px; font-weight:600; margin:0;">Scan Barcode / QR Code</h3>
            <button (click)="closeScanner()" style="background:none; border:none; cursor:pointer; font-size:18px; color:#6b7280;">&times;</button>
          </div>

          <div *ngIf="!cameraSupported" style="font-size:13px; color:#dc2626; margin-bottom:12px;">
            Camera or BarcodeDetector API not available. Enter barcode manually below.
          </div>

          <video #videoEl *ngIf="cameraSupported && !scanResult"
                 autoplay playsinline muted
                 style="width:100%; border-radius:6px; background:#000; aspect-ratio:4/3; object-fit:cover;"></video>

          <div *ngIf="scanResult" style="margin-top:8px; padding:10px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; font-size:13px;">
            Scanned: <strong>{{ scanResult }}</strong>
            <div *ngIf="scanLookupState === 'loading'" style="margin-top:4px; color:#6b7280;">Looking up...</div>
            <div *ngIf="scanLookupState === 'found'" style="margin-top:4px; color:#16a34a;">Auto-filled row {{ (scanTargetRow ?? 0) + 1 }}</div>
            <div *ngIf="scanLookupState === 'not_found'" style="margin-top:4px; color:#dc2626;">Not found — barcode saved to row.</div>
          </div>

          <div style="margin-top:12px;">
            <label style="font-size:12px; font-weight:500; color:#374151;">Manual entry
              <div style="display:flex; gap:8px; margin-top:4px;">
                <input [(ngModel)]="manualBarcode" placeholder="Enter barcode..." style="flex:1; padding:7px 10px; border:1px solid #d1d5db; border-radius:6px; font-size:13px;" (keydown.enter)="submitManualBarcode()" />
                <button (click)="submitManualBarcode()" style="padding:7px 12px; background:#2563eb; color:#fff; border:none; border-radius:6px; font-size:13px; cursor:pointer;">OK</button>
              </div>
            </label>
          </div>

          <div *ngIf="cameraError" style="margin-top:8px; font-size:12px; color:#dc2626;">{{ cameraError }}</div>
        </div>
      </div>
    </div>
  `,
})
export class ProcurementFormComponent implements OnDestroy {
  @ViewChild("videoEl") videoEl?: ElementRef<HTMLVideoElement>;

  form: FormGroup;
  saving = false;
  error = "";

  lookupState: Record<number, "loading" | "found" | "not_found"> = {};

  scannerOpen = false;
  scanTargetRow: number | null = null;
  cameraSupported = false;
  cameraError = "";
  scanResult = "";
  scanLookupState: "loading" | "found" | "not_found" | null = null;
  manualBarcode = "";

  private stream: MediaStream | null = null;
  private detector: BarcodeDetector | null = null;
  private scanLoopId: ReturnType<typeof requestAnimationFrame> | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly procurementService: ProcurementService,
    private readonly router: Router,
  ) {
    this.form = this.fb.group({
      title: ["", Validators.required],
      notes: [""],
      items: this.fb.array([this.newItemGroup()]),
    });
    this.cameraSupported = typeof BarcodeDetector !== "undefined" && !!navigator.mediaDevices;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopCamera();
  }

  get items(): FormArray { return this.form.get("items") as FormArray; }

  newItemGroup(): FormGroup {
    return this.fb.group({
      itemName: ["", Validators.required],
      description: [""],
      quantity: [null],
      unit: [""],
      targetPrice: [null],
      barcode: [""],
    });
  }

  addItem() { this.items.push(this.newItemGroup()); }

  removeItem(i: number) {
    if (this.items.length > 1) this.items.removeAt(i);
  }

  lookupBarcode(rowIdx: number) {
    const barcode = (this.items.at(rowIdx).get("barcode")?.value as string ?? "").trim();
    if (!barcode) return;
    this.applyBarcodeLookup(barcode, rowIdx);
  }

  openScanner(rowIdx: number) {
    this.scanTargetRow = rowIdx;
    this.scanResult = "";
    this.scanLookupState = null;
    this.manualBarcode = "";
    this.cameraError = "";
    this.scannerOpen = true;

    if (!this.cameraSupported) return;

    setTimeout(() => { void this.startCamera(); }, 100);
  }

  closeScanner() {
    this.scannerOpen = false;
    this.stopCamera();
  }

  private async startCamera() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const video = this.videoEl?.nativeElement;
      if (!video) return;
      video.srcObject = this.stream;
      await video.play();

      this.detector = new BarcodeDetector({ formats: ["qr_code", "ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "data_matrix"] });
      this.scanLoop();
    } catch (err) {
      this.cameraError = `Camera error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  private scanLoop() {
    const video = this.videoEl?.nativeElement;
    if (!video || !this.detector || this.scanResult) return;

    this.detector.detect(video).then(codes => {
      if (codes.length > 0 && !this.scanResult) {
        const code = codes[0].rawValue;
        this.scanResult = code;
        this.stopCamera();
        if (this.scanTargetRow !== null) {
          this.items.at(this.scanTargetRow).patchValue({ barcode: code });
          this.applyBarcodeLookup(code, this.scanTargetRow, true);
        }
      } else {
        this.scanLoopId = requestAnimationFrame(() => this.scanLoop());
      }
    }).catch(() => {
      if (!this.scanResult) {
        this.scanLoopId = requestAnimationFrame(() => this.scanLoop());
      }
    });
  }

  private stopCamera() {
    if (this.scanLoopId !== null) {
      cancelAnimationFrame(this.scanLoopId);
      this.scanLoopId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  }

  submitManualBarcode() {
    const barcode = this.manualBarcode.trim();
    if (!barcode || this.scanTargetRow === null) return;
    this.scanResult = barcode;
    this.items.at(this.scanTargetRow).patchValue({ barcode });
    this.stopCamera();
    this.applyBarcodeLookup(barcode, this.scanTargetRow, true);
  }

  private applyBarcodeLookup(barcode: string, rowIdx: number, isModal = false) {
    if (isModal) this.scanLookupState = "loading";
    else this.lookupState[rowIdx] = "loading";

    this.procurementService.barcodeLookup(barcode).pipe(takeUntil(this.destroy$)).subscribe({
      next: result => {
        if (result.found && result.itemName) {
          this.items.at(rowIdx).patchValue({
            itemName: result.itemName,
            description: result.description ?? "",
            unit: result.unit ?? "",
            targetPrice: result.targetPrice ?? null,
          });
          if (isModal) { this.scanLookupState = "found"; setTimeout(() => this.closeScanner(), 1500); }
          else this.lookupState[rowIdx] = "found";
        } else {
          if (isModal) this.scanLookupState = "not_found";
          else this.lookupState[rowIdx] = "not_found";
        }
        setTimeout(() => { delete this.lookupState[rowIdx]; }, 3000);
      },
      error: () => {
        if (isModal) this.scanLookupState = "not_found";
        else this.lookupState[rowIdx] = "not_found";
        setTimeout(() => { delete this.lookupState[rowIdx]; }, 3000);
      },
    });
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    this.error = "";
    const v = this.form.value as { title: string; notes: string; items: { itemName: string; description: string; quantity: number | null; unit: string; targetPrice: number | null; barcode: string }[] };
    const items = v.items.map(i => ({
      itemName: i.itemName,
      description: i.description || undefined,
      quantity: i.quantity ?? undefined,
      unit: i.unit || undefined,
      targetPrice: i.targetPrice ?? undefined,
      barcode: i.barcode || undefined,
    }));
    this.procurementService.create(v.title, v.notes, items).subscribe({
      next: round => { void this.router.navigate(["/procurement", round.id]); },
      error: () => { this.error = "Failed to create round."; this.saving = false; },
    });
  }
}
