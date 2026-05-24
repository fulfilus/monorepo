import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AgreedRateContractDto } from "@fulfilus/shared";
import { VendorResponseDto } from "@fulfilus/shared";
import { VendorService } from "../../vendor/services/vendor.service";
import { ContractsService } from "../services/contracts.service";

const GST_SLABS = [0, 5, 12, 18, 28];

interface NewContractForm {
  vendorId: string;
  itemName: string;
  unitPrice: number | null;
  unit: string;
  minQty: number | null;
  tolerancePct: number;
  hsnCode: string;
  gstRate: number | null;
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
        <div class="admin-header-actions">
          <button (click)="showForm = !showForm" class="btn-primary">+ New Contract</button>
        </div>
      </div>

      <div class="filters">
        <input [(ngModel)]="filterItem" (keyup.enter)="load()" placeholder="Search item..." />
        <select [(ngModel)]="filterStatus" (change)="load()">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="EXPIRED">Expired</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <button (click)="load()" class="btn-secondary">Search</button>
      </div>

      <div *ngIf="showForm" class="panel" style="margin-bottom:20px;">
        <div class="panel-header">
          <h3>New Rate Contract</h3>
          <button (click)="showForm = false; formError = ''" class="btn-ghost">Cancel</button>
        </div>
        <div class="panel-body">
          <div class="contract-form-grid">
            <label class="compact-label">Vendor *
              <select [(ngModel)]="form.vendorId" class="inline-input">
                <option value="">Select vendor...</option>
                <option *ngFor="let v of vendors" [value]="v.id">{{ v.shopName }}</option>
              </select>
            </label>
            <label class="compact-label">Item Name *
              <input [(ngModel)]="form.itemName" class="inline-input" placeholder="e.g. Rice 25kg" />
            </label>
            <label class="compact-label">Unit Price (₹) *
              <input [(ngModel)]="form.unitPrice" type="number" min="0" step="0.01" class="inline-input" />
            </label>
            <label class="compact-label">Unit
              <input [(ngModel)]="form.unit" class="inline-input" placeholder="kg, pcs..." />
            </label>
            <label class="compact-label">Min Qty
              <input [(ngModel)]="form.minQty" type="number" min="0" class="inline-input" />
            </label>
            <label class="compact-label">Tolerance %
              <input [(ngModel)]="form.tolerancePct" type="number" min="0" max="100" class="inline-input" />
            </label>
            <label class="compact-label">HSN Code
              <input [(ngModel)]="form.hsnCode" class="inline-input" placeholder="e.g. 7318" />
            </label>
            <label class="compact-label">GST %
              <select [(ngModel)]="form.gstRate" class="inline-input">
                <option [ngValue]="null">— Select —</option>
                <option *ngFor="let s of gstSlabs" [ngValue]="s">{{ s }}%</option>
              </select>
            </label>
            <label class="compact-label">Valid From
              <input [(ngModel)]="form.validFrom" type="date" class="inline-input" />
            </label>
            <label class="compact-label">Valid Until
              <input [(ngModel)]="form.validUntil" type="date" class="inline-input" />
            </label>
            <label class="compact-label" style="grid-column:1/-1;">Notes
              <input [(ngModel)]="form.notes" class="inline-input" placeholder="Optional notes..." />
            </label>
          </div>
          <div style="display:flex; gap:8px; margin-top:14px;">
            <button (click)="create()" [disabled]="saving || !form.vendorId || !form.itemName || form.unitPrice == null" class="btn-primary">
              {{ saving ? 'Saving...' : 'Create Contract' }}
            </button>
          </div>
          <div *ngIf="formError" class="alert alert-error" style="margin-top:10px;">{{ formError }}</div>
        </div>
      </div>

      <div *ngIf="loading" class="empty-state">Loading...</div>
      <div *ngIf="!loading && contracts.length === 0" class="empty-state">
        No contracts found. Create one to lock negotiated rates with vendors.
      </div>

      <div class="table-wrapper" *ngIf="!loading && contracts.length > 0">
        <table>
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Item</th>
              <th style="text-align:right;">Rate</th>
              <th>HSN / GST</th>
              <th style="text-align:right;">Tolerance</th>
              <th>Validity</th>
              <th style="text-align:center;">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let c of contracts" [style.opacity]="c.status !== 'ACTIVE' ? '0.65' : '1'">
              <td><strong>{{ c.vendor.shopName }}</strong></td>
              <td>
                {{ c.itemName }}
                <span *ngIf="c.unit" style="color:var(--text-faint);"> / {{ c.unit }}</span>
                <span *ngIf="c.minQty" style="color:var(--text-muted); display:block; font-size:11px;">Min: {{ c.minQty }}</span>
              </td>
              <td style="text-align:right; font-weight:700;">₹{{ c.unitPrice }}</td>
              <td style="color:var(--text-muted); font-size:12px;">
                <span *ngIf="c.hsnCode">{{ c.hsnCode }}</span>
                <span *ngIf="c.hsnCode && c.gstRate"> / </span>
                <span *ngIf="c.gstRate != null" style="color:var(--amber);">{{ c.gstRate }}% GST</span>
                <span *ngIf="!c.hsnCode && c.gstRate == null">—</span>
              </td>
              <td style="text-align:right; color:var(--text-muted);">{{ c.tolerancePct }}%</td>
              <td style="font-size:12px; color:var(--text-muted);">
                {{ c.validFrom | date:'dd MMM yy' }}
                <span *ngIf="c.validUntil"> – {{ c.validUntil | date:'dd MMM yy' }}</span>
                <span *ngIf="!c.validUntil"> (no expiry)</span>
              </td>
              <td style="text-align:center;">
                <span class="badge" [ngClass]="c.status.toLowerCase()">{{ c.status }}</span>
              </td>
              <td style="white-space:nowrap;">
                <button *ngIf="c.status === 'ACTIVE'" (click)="cancel(c)" class="btn-ghost" style="font-size:12px; padding:4px 8px;">Cancel</button>
                <button (click)="remove(c)" class="btn-link" style="color:var(--red); font-size:12px;">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
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
  gstSlabs = GST_SLABS;

  form: NewContractForm = {
    vendorId: "", itemName: "", unitPrice: null, unit: "", minQty: null,
    tolerancePct: 0, hsnCode: "", gstRate: null, validFrom: "", validUntil: "", notes: "",
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
      hsnCode: this.form.hsnCode || undefined,
      gstRate: this.form.gstRate ?? undefined,
      validFrom: this.form.validFrom || undefined,
      validUntil: this.form.validUntil || undefined,
      notes: this.form.notes || undefined,
    }).subscribe({
      next: c => {
        this.contracts = [c, ...this.contracts];
        this.saving = false;
        this.showForm = false;
        this.form = { vendorId: "", itemName: "", unitPrice: null, unit: "", minQty: null, tolerancePct: 0, hsnCode: "", gstRate: null, validFrom: "", validUntil: "", notes: "" };
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
