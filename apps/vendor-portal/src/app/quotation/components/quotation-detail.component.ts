import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { QuotationResponseDto, QuotationStatus, VendorResponseDto } from "@fulfilus/shared";
import { Subject, takeUntil } from "rxjs";
import { VendorService } from "../../vendor/services/vendor.service";
import { QuotationService } from "../services/quotation.service";

interface StatusTransition {
  label: string;
  target: QuotationStatus;
  style: string;
}

@Component({
  selector: "app-quotation-detail",
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="admin-page" *ngIf="quotation; else loading">
      <div class="admin-header">
        <a [routerLink]="['/quotations']" [queryParams]="{ vendorId: quotation.vendorId }" class="btn-link">← Back to list</a>
        <h2>{{ quotation.referenceNumber }}</h2>
        <div style="display:flex; gap:8px; margin-left:auto;">
          <a *ngIf="quotation.status === 'DRAFT'" [routerLink]="['/quotations', quotation.id, 'edit']" class="btn-secondary">Edit</a>
          <button *ngIf="quotation.status === 'DRAFT'" type="button" (click)="deleteQuotation()"
            style="background:#dc2626;color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px;">
            Delete
          </button>
          <button type="button" (click)="downloadPdf()" [disabled]="downloading" class="btn-secondary">
            {{ downloading ? 'Generating...' : 'Download PDF' }}
          </button>
          <button type="button" (click)="shareWhatsApp()" class="btn-secondary" style="background:#16a34a; color:#fff; border:none;">
            Share on WhatsApp
          </button>
          <button type="button" (click)="saveAsTemplate()" [disabled]="templateSaving" class="btn-secondary">
            {{ templateSaving ? 'Saving...' : 'Save as Template' }}
          </button>
        </div>
      </div>
      <div *ngIf="templateMessage" class="success" style="margin-bottom:8px;">{{ templateMessage }}</div>

      <!-- Status transitions -->
      <div *ngIf="statusTransitions.length" style="display:flex; gap:8px; padding:12px 0; border-bottom:1px solid #e5e7eb; margin-bottom:16px;">
        <button
          *ngFor="let t of statusTransitions"
          type="button"
          (click)="transitionStatus(t.target)"
          [disabled]="transitioning"
          [style]="t.style"
          class="btn-secondary">
          {{ transitioning ? 'Updating...' : t.label }}
        </button>
      </div>

      <!-- Meta -->
      <div class="vendor-form" style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px;">
        <div>
          <div style="font-size:11px; color:#6b7280; text-transform:uppercase; margin-bottom:4px;">Type</div>
          <div>{{ formatType(quotation.type) }}</div>
        </div>
        <div>
          <div style="font-size:11px; color:#6b7280; text-transform:uppercase; margin-bottom:4px;">Status</div>
          <span class="badge" [class.contacted]="quotation.status === 'ACCEPTED'">{{ quotation.status }}</span>
        </div>
        <div>
          <div style="font-size:11px; color:#6b7280; text-transform:uppercase; margin-bottom:4px;">Title</div>
          <div>{{ quotation.title }}</div>
        </div>
        <div>
          <div style="font-size:11px; color:#6b7280; text-transform:uppercase; margin-bottom:4px;">Valid Until</div>
          <div>{{ quotation.validUntil ? (quotation.validUntil | date:'dd MMM yyyy') : '—' }}</div>
        </div>
        <div *ngIf="quotation.notes" style="grid-column:1/-1;">
          <div style="font-size:11px; color:#6b7280; text-transform:uppercase; margin-bottom:4px;">Notes</div>
          <div style="white-space:pre-wrap;">{{ quotation.notes }}</div>
        </div>
      </div>

      <!-- Line items -->
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>Description</th>
              <th style="text-align:right;">Qty</th>
              <th>Unit</th>
              <th style="text-align:right;">Unit Price</th>
              <th style="text-align:right;">Total</th>
              <th>AI</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of quotation.lineItems; let i = index">
              <td>{{ i + 1 }}</td>
              <td>{{ item.itemName }}</td>
              <td class="truncate">{{ item.description || '—' }}</td>
              <td style="text-align:right;">{{ item.quantity ?? '—' }}</td>
              <td>{{ item.unit || '—' }}</td>
              <td style="text-align:right;">{{ item.unitPrice != null ? ('₹' + item.unitPrice.toFixed(2)) : '—' }}</td>
              <td style="text-align:right;">{{ item.totalPrice != null ? ('₹' + item.totalPrice.toFixed(2)) : '—' }}</td>
              <td>{{ item.aiSuggested ? '✓' : '' }}</td>
            </tr>
          </tbody>
          <tfoot *ngIf="quotation.totalAmount != null">
            <tr>
              <td colspan="6" style="text-align:right; font-weight:600; padding:8px;">TOTAL</td>
              <td style="text-align:right; font-weight:600; padding:8px;">₹{{ quotation.totalAmount.toFixed(2) }}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div *ngIf="errorMessage" class="error" style="margin-top:12px;">{{ errorMessage }}</div>
    </div>

    <ng-template #loading>
      <div class="admin-page"><p class="empty-state">{{ loadError || 'Loading...' }}</p></div>
    </ng-template>
  `,
})
export class QuotationDetailComponent implements OnInit, OnDestroy {
  quotation: QuotationResponseDto | null = null;
  vendor: VendorResponseDto | null = null;
  downloading = false;
  transitioning = false;
  loadError = "";
  errorMessage = "";
  templateSaving = false;
  templateMessage = "";
  QuotationStatus = QuotationStatus;

  get statusTransitions(): StatusTransition[] {
    if (!this.quotation) return [];
    switch (this.quotation.status) {
      case QuotationStatus.DRAFT:
        return [{ label: "Mark as Sent", target: QuotationStatus.SENT, style: "background:#2563eb;color:#fff;border:none;" }];
      case QuotationStatus.SENT:
        return [{ label: "Mark as Received", target: QuotationStatus.RECEIVED, style: "background:#7c3aed;color:#fff;border:none;" }];
      case QuotationStatus.RECEIVED:
        return [
          { label: "Accept", target: QuotationStatus.ACCEPTED, style: "background:#16a34a;color:#fff;border:none;" },
          { label: "Reject", target: QuotationStatus.REJECTED, style: "background:#dc2626;color:#fff;border:none;" },
        ];
      default:
        return [];
    }
  }

  private destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly quotationService: QuotationService,
    private readonly vendorService: VendorService,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get("id")!;
    this.quotationService.getById(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: q => {
        this.quotation = q;
        this.vendorService.getById(q.vendorId).pipe(takeUntil(this.destroy$)).subscribe({
          next: v => { this.vendor = v; },
        });
      },
      error: () => { this.loadError = "Quotation not found."; },
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  downloadPdf() {
    if (!this.quotation) return;
    this.downloading = true;
    this.quotationService.downloadPdf(this.quotation.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${this.quotation!.referenceNumber}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloading = false;
      },
      error: () => { this.errorMessage = "PDF generation failed."; this.downloading = false; },
    });
  }

  transitionStatus(target: QuotationStatus) {
    if (!this.quotation) return;
    this.transitioning = true;
    this.errorMessage = "";
    this.quotationService.update(this.quotation.id, { status: target }).pipe(takeUntil(this.destroy$)).subscribe({
      next: updated => {
        this.quotation = updated;
        this.transitioning = false;
      },
      error: () => {
        this.errorMessage = "Failed to update status.";
        this.transitioning = false;
      },
    });
  }

  shareWhatsApp() {
    if (!this.quotation) return;
    if (!this.vendor) {
      this.errorMessage = "Vendor data not loaded yet. Try again.";
      return;
    }
    const link = this.quotationService.buildWhatsAppLink(this.quotation, this.vendor.whatsappNumber);
    window.open(link, "_blank");
  }

  deleteQuotation() {
    if (!this.quotation) return;
    if (!confirm(`Delete quotation ${this.quotation.referenceNumber}? This cannot be undone.`)) return;
    this.quotationService.remove(this.quotation.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.router.navigate(["/quotations"], { queryParams: { vendorId: this.quotation!.vendorId } }),
      error: () => { this.errorMessage = "Failed to delete quotation."; },
    });
  }

  saveAsTemplate() {
    if (!this.quotation) return;
    const name = prompt("Template name:", this.quotation.title);
    if (!name?.trim()) return;
    this.templateSaving = true;
    this.quotationService.saveAsTemplate(
      name.trim(),
      this.quotation.type,
      this.quotation.notes,
      (this.quotation.lineItems ?? []).map((item, i) => ({
        itemName: item.itemName,
        description: item.description ?? undefined,
        quantity: item.quantity ?? undefined,
        unit: item.unit ?? undefined,
        unitPrice: item.unitPrice ?? undefined,
        sortOrder: i,
      })),
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: t => {
        this.templateMessage = `Saved as template: ${t.title}`;
        this.templateSaving = false;
        setTimeout(() => { this.templateMessage = ""; }, 3000);
      },
      error: () => { this.errorMessage = "Failed to save template."; this.templateSaving = false; },
    });
  }

  formatType(type: string): string {
    return type === "RFQ" ? "Request for Quotation" : type === "PRICE_LIST" ? "Vendor Price List" : "Purchase Order Quote";
  }
}
