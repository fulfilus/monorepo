import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { AiSuggestedItem, QuotationTemplateResponseDto, QuotationType } from "@fulfilus/shared";
import { FormsModule } from "@angular/forms";
import { Subject, takeUntil } from "rxjs";
import { QuotationService } from "../services/quotation.service";

@Component({
  selector: "app-quotation-form",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  template: `
    <div class="admin-page">
      <div class="admin-header">
        <a [routerLink]="backLink" class="btn-link">← Back</a>
        <h2>{{ isEdit ? 'Edit Quotation' : 'New Quotation' }}</h2>
      </div>

      <form [formGroup]="form" (ngSubmit)="save()" class="vendor-form">

        <section>
          <label>Type *
            <select formControlName="type">
              <option value="RFQ">Request for Quotation (RFQ)</option>
              <option value="PRICE_LIST">Vendor Price List</option>
              <option value="PO_QUOTE">Purchase Order Quote</option>
            </select>
          </label>
          <label>Title *
            <input formControlName="title" placeholder="e.g. Hardware Supply Q3 2026" />
          </label>
          <label>Valid Until
            <input type="date" formControlName="validUntil" />
          </label>
          <label>Notes
            <textarea formControlName="notes" rows="3" placeholder="Terms, conditions, or additional context..."></textarea>
          </label>
        </section>

        <!-- Line Items -->
        <section>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3 style="margin:0;">Line Items</h3>
            <div style="display:flex; gap:8px;">
              <button type="button" (click)="suggestItems()" [disabled]="suggesting" style="padding:6px 14px; background:#7c3aed; color:#fff; border:none; border-radius:6px; font-size:13px; cursor:pointer;">
                {{ suggesting ? 'Suggesting...' : 'AI Suggest Items' }}
              </button>
              <button type="button" (click)="addRow()" style="padding:6px 14px; background:#16a34a; color:#fff; border:none; border-radius:6px; font-size:13px; cursor:pointer;">
                + Add Row
              </button>
            </div>
          </div>
          <div *ngIf="suggestError" class="error" style="margin-bottom:8px;">{{ suggestError }}</div>

          <div *ngIf="lineItemsArray.length === 0" class="empty-state" style="padding:20px;">
            No items yet. Use AI Suggest or add manually.
          </div>

          <div *ngIf="lineItemsArray.length > 0" style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
              <thead>
                <tr style="background:#f3f4f6;">
                  <th style="padding:8px; text-align:left;">Item Name *</th>
                  <th style="padding:8px; text-align:left;">Description</th>
                  <th style="padding:8px; text-align:right;">Qty</th>
                  <th style="padding:8px; text-align:left;">Unit</th>
                  <th style="padding:8px; text-align:right;">Unit Price (₹)</th>
                  <th style="padding:8px; text-align:right;">Total</th>
                  <th style="padding:8px;"></th>
                </tr>
              </thead>
              <tbody formArrayName="lineItems">
                <tr *ngFor="let row of lineItemsArray.controls; let i = index" [formGroupName]="i"
                    [style.background]="aiSuggestedIndices.has(i) ? '#faf5ff' : 'white'">
                  <td style="padding:4px 8px;">
                    <input formControlName="itemName" style="width:140px; padding:4px 6px; border:1px solid #d1d5db; border-radius:4px;" />
                  </td>
                  <td style="padding:4px 8px;">
                    <input formControlName="description" style="width:120px; padding:4px 6px; border:1px solid #d1d5db; border-radius:4px;" />
                  </td>
                  <td style="padding:4px 8px;">
                    <input formControlName="quantity" type="number" min="0" style="width:70px; padding:4px 6px; border:1px solid #d1d5db; border-radius:4px; text-align:right;" />
                  </td>
                  <td style="padding:4px 8px;">
                    <input formControlName="unit" style="width:60px; padding:4px 6px; border:1px solid #d1d5db; border-radius:4px;" />
                  </td>
                  <td style="padding:4px 8px;">
                    <input formControlName="unitPrice" type="number" min="0" style="width:90px; padding:4px 6px; border:1px solid #d1d5db; border-radius:4px; text-align:right;" (input)="recalcTotal(i)" />
                  </td>
                  <td style="padding:4px 8px; text-align:right; color:#374151;">
                    {{ rowTotal(i) != null ? ('₹' + rowTotal(i)!.toFixed(2)) : '—' }}
                  </td>
                  <td style="padding:4px 8px;">
                    <button type="button" (click)="removeRow(i)" style="color:#dc2626; background:none; border:none; cursor:pointer; font-size:16px;">✕</button>
                  </td>
                </tr>
              </tbody>
            </table>

            <div *ngIf="grandTotal != null" style="text-align:right; padding:10px 8px; font-weight:600; font-size:14px;">
              Subtotal: ₹{{ grandTotal.toFixed(2) }}
            </div>
          </div>
        </section>

        <div class="actions" style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <button type="submit" [disabled]="form.invalid || saving">
            {{ saving ? 'Saving...' : 'Save Quotation' }}
          </button>
          <button type="button" (click)="toggleTemplatePicker()" class="btn-secondary">
            Load from Template
          </button>
          <button type="button" (click)="saveAsTemplate()" [disabled]="form.invalid || templateSaving" class="btn-secondary">
            {{ templateSaving ? 'Saving...' : 'Save as Template' }}
          </button>
        </div>

        <!-- Template Picker -->
        <div *ngIf="showTemplatePicker" style="margin-top:16px; padding:12px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h4 style="margin:0; font-size:13px; font-weight:600;">Load from Template</h4>
            <button type="button" (click)="showTemplatePicker=false" style="background:none;border:none;cursor:pointer;color:#6b7280;font-size:16px;">✕</button>
          </div>
          <div *ngIf="templatesLoading" class="empty-state" style="padding:8px;">Loading...</div>
          <div *ngIf="!templatesLoading && templates.length === 0" class="empty-state" style="padding:8px; font-size:12px;">No templates saved yet.</div>
          <div *ngFor="let t of templates" style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid #f3f4f6;">
            <div>
              <span style="font-size:13px; font-weight:500;">{{ t.title }}</span>
              <span class="chip" style="margin-left:8px; font-size:11px;">{{ t.type }}</span>
              <span style="font-size:11px; color:#9ca3af; margin-left:8px;">{{ (t.lineItems?.length ?? 0) }} items</span>
            </div>
            <div style="display:flex; gap:8px;">
              <button type="button" (click)="loadTemplate(t)" style="font-size:12px; padding:4px 10px; background:#2563eb; color:#fff; border:none; border-radius:5px; cursor:pointer;">Load</button>
              <button type="button" (click)="deleteTemplate(t.id)" style="font-size:12px; padding:4px 10px; background:none; border:1px solid #dc2626; color:#dc2626; border-radius:5px; cursor:pointer;">Delete</button>
            </div>
          </div>
        </div>

        <div *ngIf="templateMessage" class="success" style="margin-top:8px;">{{ templateMessage }}</div>
        <div *ngIf="successMessage" class="success">{{ successMessage }}</div>
        <div *ngIf="errorMessage" class="error">{{ errorMessage }}</div>
      </form>
    </div>
  `,
})
export class QuotationFormComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  isEdit = false;
  quotationId = "";
  vendorId = "";
  backLink = "/quotations";

  saving = false;
  suggesting = false;
  suggestError = "";
  successMessage = "";
  errorMessage = "";

  aiSuggestedIndices = new Set<number>();

  templates: QuotationTemplateResponseDto[] = [];
  templatesLoading = false;
  showTemplatePicker = false;
  templateSaving = false;
  templateMessage = "";

  private destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly quotationService: QuotationService,
  ) {}

  ngOnInit() {
    this.quotationId = this.route.snapshot.paramMap.get("id") ?? "";
    this.vendorId = this.route.snapshot.queryParamMap.get("vendorId") ?? "";
    this.isEdit = !!this.quotationId;
    this.backLink = this.vendorId ? `/quotations?vendorId=${this.vendorId}` : "/quotations";

    this.form = this.fb.group({
      type: [QuotationType.RFQ, Validators.required],
      title: ["", Validators.required],
      notes: [""],
      validUntil: [""],
      lineItems: this.fb.array([]),
    });

    if (this.isEdit) {
      this.quotationService.getById(this.quotationId).pipe(takeUntil(this.destroy$)).subscribe({
        next: q => {
          this.vendorId = q.vendorId;
          this.backLink = `/quotations?vendorId=${q.vendorId}`;
          this.form.patchValue({
            type: q.type,
            title: q.title,
            notes: q.notes ?? "",
            validUntil: q.validUntil ? q.validUntil.substring(0, 10) : "",
          });
          (q.lineItems ?? []).forEach(item => this.addRow(item));
        },
        error: () => { this.errorMessage = "Failed to load quotation."; },
      });
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get lineItemsArray(): FormArray {
    return this.form.get("lineItems") as FormArray;
  }

  addRow(item?: { itemName?: string; description?: string | null; quantity?: number | null; unit?: string | null; unitPrice?: number | null }) {
    this.lineItemsArray.push(this.fb.group({
      itemName: [item?.itemName ?? "", Validators.required],
      description: [item?.description ?? ""],
      quantity: [item?.quantity ?? null],
      unit: [item?.unit ?? ""],
      unitPrice: [item?.unitPrice ?? null],
    }));
  }

  removeRow(i: number) {
    this.lineItemsArray.removeAt(i);
    this.aiSuggestedIndices.delete(i);
    const updated = new Set<number>();
    this.aiSuggestedIndices.forEach(idx => { if (idx > i) updated.add(idx - 1); else if (idx < i) updated.add(idx); });
    this.aiSuggestedIndices = updated;
  }

  suggestItems() {
    if (!this.vendorId) { this.suggestError = "No vendor ID — open this form from the vendor page."; return; }
    this.suggesting = true;
    this.suggestError = "";
    const type = this.form.value.type as string;

    this.quotationService.suggestItems(this.vendorId, type).pipe(takeUntil(this.destroy$)).subscribe({
      next: (items: AiSuggestedItem[]) => {
        const startIdx = this.lineItemsArray.length;
        items.forEach((item, i) => {
          this.addRow(item);
          this.aiSuggestedIndices.add(startIdx + i);
        });
        this.suggesting = false;
      },
      error: () => { this.suggestError = "AI suggestion failed."; this.suggesting = false; },
    });
  }

  toggleTemplatePicker() {
    this.showTemplatePicker = !this.showTemplatePicker;
    if (this.showTemplatePicker && this.templates.length === 0) {
      this.templatesLoading = true;
      this.quotationService.listTemplates().pipe(takeUntil(this.destroy$)).subscribe({
        next: t => { this.templates = t; this.templatesLoading = false; },
        error: () => { this.templatesLoading = false; },
      });
    }
  }

  loadTemplate(t: QuotationTemplateResponseDto) {
    this.form.patchValue({ type: t.type, notes: t.notes ?? "" });
    while (this.lineItemsArray.length) this.lineItemsArray.removeAt(0);
    this.aiSuggestedIndices.clear();
    (t.lineItems ?? []).forEach(item => this.addRow(item));
    this.showTemplatePicker = false;
    this.templateMessage = `Loaded template: ${t.title}`;
    setTimeout(() => { this.templateMessage = ""; }, 3000);
  }

  saveAsTemplate() {
    if (this.form.invalid) return;
    const name = prompt("Template name:");
    if (!name?.trim()) return;
    this.templateSaving = true;
    const v = this.form.value as { type: QuotationType; notes: string; lineItems: { itemName: string; description: string; quantity: number | null; unit: string; unitPrice: number | null }[] };
    this.quotationService.saveAsTemplate(name.trim(), v.type, v.notes || null, v.lineItems.map((item, i) => ({ ...item, sortOrder: i }))).pipe(takeUntil(this.destroy$)).subscribe({
      next: t => {
        this.templates = [t, ...this.templates];
        this.templateMessage = `Template "${t.title}" saved.`;
        this.templateSaving = false;
        setTimeout(() => { this.templateMessage = ""; }, 3000);
      },
      error: () => { this.templateSaving = false; },
    });
  }

  deleteTemplate(id: string) {
    if (!confirm("Delete this template?")) return;
    this.quotationService.deleteTemplate(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.templates = this.templates.filter(t => t.id !== id); },
      error: () => {},
    });
  }

  recalcTotal(_i: number) { /* totals are computed live via rowTotal() */ }

  rowTotal(i: number): number | null {
    const row = this.lineItemsArray.at(i) as AbstractControl;
    const qty = row.get("quantity")?.value as number | null;
    const price = row.get("unitPrice")?.value as number | null;
    if (qty != null && price != null) return qty * price;
    return null;
  }

  get grandTotal(): number | null {
    const totals = Array.from({ length: this.lineItemsArray.length }, (_, i) => this.rowTotal(i));
    if (totals.every(t => t == null)) return null;
    return totals.reduce<number>((sum, t) => sum + (t ?? 0), 0);
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    this.successMessage = "";
    this.errorMessage = "";

    const value = this.form.value;
    const lineItems = (value.lineItems as { itemName: string; description: string; quantity: number | null; unit: string; unitPrice: number | null }[])
      .map((item, i) => ({
        itemName: item.itemName,
        description: item.description || undefined,
        quantity: item.quantity,
        unit: item.unit || undefined,
        unitPrice: item.unitPrice,
        aiSuggested: this.aiSuggestedIndices.has(i),
        sortOrder: i,
      }));

    if (this.isEdit) {
      this.quotationService.update(this.quotationId, { ...value, lineItems }).pipe(takeUntil(this.destroy$)).subscribe({
        next: q => {
          this.successMessage = "Saved.";
          this.saving = false;
          void this.router.navigate(["/quotations", q.id]);
        },
        error: () => { this.errorMessage = "Failed to save."; this.saving = false; },
      });
    } else {
      this.quotationService.create({ vendorId: this.vendorId, ...value, lineItems }).pipe(takeUntil(this.destroy$)).subscribe({
        next: q => {
          this.saving = false;
          void this.router.navigate(["/quotations", q.id]);
        },
        error: () => { this.errorMessage = "Failed to create quotation."; this.saving = false; },
      });
    }
  }
}
