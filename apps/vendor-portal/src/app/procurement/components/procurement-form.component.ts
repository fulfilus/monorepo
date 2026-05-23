import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { ProcurementService } from "../services/procurement.service";

@Component({
  selector: "app-procurement-form",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
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
                    <button type="button" (click)="removeItem(i)" [disabled]="items.length === 1"
                            style="color:#dc2626; background:none; border:none; cursor:pointer; font-size:16px; opacity:0.8;" title="Remove">✕</button>
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
    </div>
  `,
})
export class ProcurementFormComponent {
  form: FormGroup;
  saving = false;
  error = "";

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
  }

  get items(): FormArray { return this.form.get("items") as FormArray; }

  newItemGroup(): FormGroup {
    return this.fb.group({
      itemName: ["", Validators.required],
      description: [""],
      quantity: [null],
      unit: [""],
      targetPrice: [null],
    });
  }

  addItem() { this.items.push(this.newItemGroup()); }

  removeItem(i: number) {
    if (this.items.length > 1) this.items.removeAt(i);
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    this.error = "";
    const v = this.form.value as { title: string; notes: string; items: { itemName: string; description: string; quantity: number | null; unit: string; targetPrice: number | null }[] };
    const items = v.items.map(i => ({
      itemName: i.itemName,
      description: i.description || undefined,
      quantity: i.quantity ?? undefined,
      unit: i.unit || undefined,
      targetPrice: i.targetPrice ?? undefined,
    }));
    this.procurementService.create(v.title, v.notes, items).subscribe({
      next: round => { void this.router.navigate(["/procurement", round.id]); },
      error: () => { this.error = "Failed to create round."; this.saving = false; },
    });
  }
}
