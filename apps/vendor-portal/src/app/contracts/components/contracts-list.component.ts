import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AgreedRateContractDto } from "@fulfilus/shared";
import { VendorResponseDto } from "@fulfilus/shared";
import { VendorService } from "../../vendor/services/vendor.service";
import { ContractsService } from "../services/contracts.service";

interface NewContractForm {
  vendorId: string;
  itemName: string;
  unitPrice: number | null;
  unit: string;
  minQty: number | null;
  tolerancePct: number;
  validFrom: string;
  validUntil: string;
  notes: string;
}

@Component({
  selector: "app-contracts-list",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-page">
      <div class="admin-header">
        <h2>Agreed Rate Contracts</h2>
      </div>

      <!-- Filters -->
      <div style="display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap; align-items:center;">
        <input [(ngModel)]="filterItem" (keyup.enter)="load()" placeholder="Search item..."
               style="padding:6px 10px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; width:200px;" />
        <select [(ngModel)]="filterStatus" (change)="load()"
                style="padding:6px 10px; border:1px solid #d1d5db; border-radius:6px; font-size:13px;">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="EXPIRED">Expired</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <button (click)="load()" style="padding:6px 14px; background:#2563eb; color:#fff; border:none; border-radius:6px; font-size:13px; cursor:pointer;">Search</button>
        <button (click)="showForm = !showForm"
                style="padding:6px 14px; background:#16a34a; color:#fff; border:none; border-radius:6px; font-size:13px; cursor:pointer; margin-left:auto;">
          + New Contract
        </button>
      </div>

      <!-- New contract form -->
      <div *ngIf="showForm" style="padding:16px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; margin-bottom:20px;">
        <h3 style="font-size:13px; font-weight:600; margin-bottom:14px;">New Rate Contract</h3>
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px; margin-bottom:12px;">
          <label style="font-size:12px; font-weight:500;">Vendor *
            <select [(ngModel)]="form.vendorId" style="width:100%; margin-top:4px; padding:6px 8px; border:1px solid #d1d5db; border-radius:5px; font-size:13px;">
              <option value="">Select vendor...</option>
              <option *ngFor="let v of vendors" [value]="v.id">{{ v.shopName }}</option>
            </select>
          </label>
          <label style="font-size:12px; font-weight:500;">Item Name *
            <input [(ngModel)]="form.itemName" style="width:100%; margin-top:4px; padding:6px 8px; border:1px solid #d1d5db; border-radius:5px; font-size:13px;" placeholder="e.g. Rice 25kg" />
          </label>
          <label style="font-size:12px; font-weight:500;">Unit Price (₹) *
            <input [(ngModel)]="form.unitPrice" type="number" min="0" step="0.01" style="width:100%; margin-top:4px; padding:6px 8px; border:1px solid #d1d5db; border-radius:5px; font-size:13px;" />
          </label>
          <label style="font-size:12px; font-weight:500;">Unit
            <input [(ngModel)]="form.unit" style="width:100%; margin-top:4px; padding:6px 8px; border:1px solid #d1d5db; border-radius:5px; font-size:13px;" placeholder="kg, pcs..." />
          </label>
          <label style="font-size:12px; font-weight:500;">Min Qty
            <input [(ngModel)]="form.minQty" type="number" min="0" style="width:100%; margin-top:4px; padding:6px 8px; border:1px solid #d1d5db; border-radius:5px; font-size:13px;" />
          </label>
          <label style="font-size:12px; font-weight:500;">Tolerance %
            <input [(ngModel)]="form.tolerancePct" type="number" min="0" max="100" style="width:100%; margin-top:4px; padding:6px 8px; border:1px solid #d1d5db; border-radius:5px; font-size:13px;" />
          </label>
          <label style="font-size:12px; font-weight:500;">Valid From
            <input [(ngModel)]="form.validFrom" type="date" style="width:100%; margin-top:4px; padding:6px 8px; border:1px solid #d1d5db; border-radius:5px; font-size:13px;" />
          </label>
          <label style="font-size:12px; font-weight:500;">Valid Until
            <input [(ngModel)]="form.validUntil" type="date" style="width:100%; margin-top:4px; padding:6px 8px; border:1px solid #d1d5db; border-radius:5px; font-size:13px;" />
          </label>
          <label style="font-size:12px; font-weight:500; grid-column:1/-1;">Notes
            <input [(ngModel)]="form.notes" style="width:100%; margin-top:4px; padding:6px 8px; border:1px solid #d1d5db; border-radius:5px; font-size:13px;" placeholder="Optional notes..." />
          </label>
        </div>
        <div style="display:flex; gap:8px;">
          <button (click)="create()" [disabled]="saving || !form.vendorId || !form.itemName || form.unitPrice == null"
                  style="padding:7px 18px; background:#2563eb; color:#fff; border:none; border-radius:6px; font-size:13px; cursor:pointer;">
            {{ saving ? 'Saving...' : 'Create Contract' }}
          </button>
          <button (click)="showForm = false; formError = ''"
                  style="padding:7px 14px; background:none; border:1px solid #d1d5db; border-radius:6px; font-size:13px; cursor:pointer;">
            Cancel
          </button>
        </div>
        <div *ngIf="formError" class="error" style="margin-top:6px; font-size:12px;">{{ formError }}</div>
      </div>

      <!-- Contracts table -->
      <div *ngIf="loading" class="empty-state">Loading...</div>

      <div *ngIf="!loading && contracts.length === 0" class="empty-state">
        No contracts found. Create one to lock negotiated rates with vendors.
      </div>

      <div *ngIf="!loading && contracts.length > 0" style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:8px 10px; text-align:left;">Vendor</th>
              <th style="padding:8px 10px; text-align:left;">Item</th>
              <th style="padding:8px 10px; text-align:right;">Rate</th>
              <th style="padding:8px 10px; text-align:right;">Tolerance</th>
              <th style="padding:8px 10px; text-align:left;">Validity</th>
              <th style="padding:8px 10px; text-align:center;">Status</th>
              <th style="padding:8px 10px;"></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let c of contracts" style="border-bottom:1px solid #f3f4f6;"
                [style.opacity]="c.status !== 'ACTIVE' ? '0.6' : '1'">
              <td style="padding:8px 10px; font-weight:500;">{{ c.vendor.shopName }}</td>
              <td style="padding:8px 10px;">
                {{ c.itemName }}
                <span *ngIf="c.unit" style="font-size:11px; color:#9ca3af;"> / {{ c.unit }}</span>
                <span *ngIf="c.minQty" style="font-size:11px; color:#6b7280; display:block;">Min: {{ c.minQty }}</span>
              </td>
              <td style="padding:8px 10px; text-align:right; font-weight:600;">₹{{ c.unitPrice }}</td>
              <td style="padding:8px 10px; text-align:right; color:#6b7280;">{{ c.tolerancePct }}%</td>
              <td style="padding:8px 10px; font-size:12px; color:#6b7280;">
                {{ c.validFrom | date:'dd MMM yy' }}
                <span *ngIf="c.validUntil"> – {{ c.validUntil | date:'dd MMM yy' }}</span>
                <span *ngIf="!c.validUntil"> (no expiry)</span>
              </td>
              <td style="padding:8px 10px; text-align:center;">
                <span class="badge" [ngClass]="c.status.toLowerCase()">{{ c.status }}</span>
              </td>
              <td style="padding:8px 10px; text-align:right; white-space:nowrap;">
                <button *ngIf="c.status === 'ACTIVE'" (click)="cancel(c)"
                        style="font-size:12px; padding:3px 8px; background:none; border:1px solid #d1d5db; border-radius:4px; cursor:pointer; color:#374151;">
                  Cancel
                </button>
                <button (click)="remove(c)"
                        style="font-size:12px; padding:3px 8px; background:none; border:1px solid #dc2626; color:#dc2626; border-radius:4px; cursor:pointer; margin-left:4px;">
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .badge.active { background:#d1fae5; color:#065f46; }
    .badge.expired { background:#fef3c7; color:#92400e; }
    .badge.cancelled { background:#fee2e2; color:#b91c1c; }
  `],
})
export class ContractsListComponent implements OnInit {
  contracts: AgreedRateContractDto[] = [];
  vendors: VendorResponseDto[] = [];
  loading = true;
  saving = false;
  showForm = false;
  formError = "";
  filterItem = "";
  filterStatus = "ACTIVE";

  form: NewContractForm = {
    vendorId: "", itemName: "", unitPrice: null, unit: "", minQty: null,
    tolerancePct: 0, validFrom: "", validUntil: "", notes: "",
  };

  constructor(
    private readonly contractsService: ContractsService,
    private readonly vendorService: VendorService,
  ) {}

  ngOnInit() {
    this.load();
    this.vendorService.list(1, 200).subscribe({ next: r => { this.vendors = r.data; } });
  }

  load() {
    this.loading = true;
    this.contractsService.list(undefined, this.filterItem || undefined, this.filterStatus || undefined).subscribe({
      next: c => { this.contracts = c; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  create() {
    if (!this.form.vendorId || !this.form.itemName || this.form.unitPrice == null) return;
    this.saving = true;
    this.formError = "";
    this.contractsService.create({
      vendorId: this.form.vendorId,
      itemName: this.form.itemName,
      unitPrice: this.form.unitPrice,
      unit: this.form.unit || undefined,
      minQty: this.form.minQty ?? undefined,
      tolerancePct: this.form.tolerancePct,
      validFrom: this.form.validFrom || undefined,
      validUntil: this.form.validUntil || undefined,
      notes: this.form.notes || undefined,
    }).subscribe({
      next: c => {
        this.contracts = [c, ...this.contracts];
        this.saving = false;
        this.showForm = false;
        this.form = { vendorId: "", itemName: "", unitPrice: null, unit: "", minQty: null, tolerancePct: 0, validFrom: "", validUntil: "", notes: "" };
      },
      error: () => { this.formError = "Failed to create contract."; this.saving = false; },
    });
  }

  cancel(c: AgreedRateContractDto) {
    this.contractsService.update(c.id, { status: "CANCELLED" }).subscribe({
      next: updated => { this.contracts = this.contracts.map(x => x.id === updated.id ? updated : x); },
    });
  }

  remove(c: AgreedRateContractDto) {
    if (!confirm(`Delete contract for "${c.itemName}" with ${c.vendor.shopName}?`)) return;
    this.contractsService.remove(c.id).subscribe({
      next: () => { this.contracts = this.contracts.filter(x => x.id !== c.id); },
    });
  }
}
