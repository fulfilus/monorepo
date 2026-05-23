import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { ComparisonResultDto, ProcurementRoundDto, VendorBidDto } from "@fulfilus/shared";
import { Subject, takeUntil } from "rxjs";
import { VendorResponseDto } from "@fulfilus/shared";
import { VendorService } from "../../vendor/services/vendor.service";
import { ProcurementService } from "../services/procurement.service";

@Component({
  selector: "app-procurement-detail",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="admin-page">
      <div class="admin-header">
        <a routerLink="/procurement" class="btn-link">← Procurement</a>
        <h2 *ngIf="round">{{ round.title }}</h2>
        <div *ngIf="round" style="margin-left:auto; display:flex; align-items:center; gap:8px;">
          <span class="badge" [ngClass]="round.status.toLowerCase()">{{ round.status }}</span>
          <button (click)="saveAsTemplate()" [disabled]="savingTemplate"
                  style="font-size:12px; padding:4px 12px; background:#6d28d9; color:#fff; border:none; border-radius:5px; cursor:pointer;">
            {{ savingTemplate ? 'Saving...' : 'Save as Template' }}
          </button>
          <span *ngIf="savedTemplateMsg" style="font-size:12px; color:#15803d;">{{ savedTemplateMsg }}</span>
        </div>
      </div>

      <div *ngIf="loading" class="empty-state">Loading...</div>

      <ng-container *ngIf="round && !loading">

        <!-- Notes -->
        <div *ngIf="round.notes" style="padding:10px 14px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; margin-bottom:16px; font-size:13px; color:#4b5563;">
          {{ round.notes }}
        </div>

        <!-- Items Summary -->
        <section style="margin-bottom:20px;">
          <h3 style="font-size:14px; font-weight:600; margin-bottom:8px;">Items ({{ round.items.length }})</h3>
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
              <thead>
                <tr style="background:#f3f4f6;">
                  <th style="padding:6px 10px; text-align:left;">#</th>
                  <th style="padding:6px 10px; text-align:left;">Item</th>
                  <th style="padding:6px 10px; text-align:right;">Qty</th>
                  <th style="padding:6px 10px; text-align:left;">Unit</th>
                  <th style="padding:6px 10px; text-align:right;">Target Price</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of round.items; let i = index" style="border-bottom:1px solid #f3f4f6;">
                  <td style="padding:6px 10px; color:#9ca3af;">{{ i + 1 }}</td>
                  <td style="padding:6px 10px; font-weight:500;">{{ item.itemName }}<span *ngIf="item.description" style="font-size:11px; color:#9ca3af; margin-left:6px;">{{ item.description }}</span></td>
                  <td style="padding:6px 10px; text-align:right; color:#374151;">{{ item.quantity ?? '—' }}</td>
                  <td style="padding:6px 10px; color:#6b7280;">{{ item.unit ?? '—' }}</td>
                  <td style="padding:6px 10px; text-align:right; color:#374151;">{{ item.targetPrice != null ? ('₹' + item.targetPrice) : '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Add Vendor -->
        <section *ngIf="round.status === 'OPEN'" style="margin-bottom:20px; padding:14px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px;">
          <h3 style="font-size:14px; font-weight:600; margin-bottom:10px;">Add Vendor to Round</h3>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <select [(ngModel)]="selectedVendorId" style="flex:1; min-width:200px; padding:7px 10px; border:1px solid #d1d5db; border-radius:6px; font-size:13px;">
              <option value="">Select vendor...</option>
              <option *ngFor="let v of vendorList" [value]="v.id">{{ v.shopName }}</option>
            </select>
            <button (click)="addVendor()" [disabled]="!selectedVendorId || addingVendor" style="padding:7px 16px; background:#2563eb; color:#fff; border:none; border-radius:6px; font-size:13px; cursor:pointer;">
              {{ addingVendor ? 'Adding...' : 'Add Vendor' }}
            </button>
          </div>
          <div *ngIf="addVendorError" class="error" style="margin-top:6px; font-size:12px;">{{ addVendorError }}</div>
        </section>

        <!-- Vendor Bids -->
        <section style="margin-bottom:24px;">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px; flex-wrap:wrap;">
            <h3 style="font-size:14px; font-weight:600; margin:0;">Vendor Bids ({{ round.vendorBids.length }})</h3>
            <button *ngIf="round.status === 'OPEN' && round.vendorBids.length > 0"
                    (click)="blastRfq()" [disabled]="blasting"
                    style="padding:5px 14px; background:#16a34a; color:#fff; border:none; border-radius:6px; font-size:12px; cursor:pointer; font-weight:500;">
              {{ blasting ? 'Sending...' : 'Send RFQ via WhatsApp' }}
            </button>
          </div>
          <div *ngIf="blastResult" style="padding:8px 12px; border-radius:6px; font-size:12px; margin-bottom:10px;"
               [style.background]="blastResult.failed.length ? '#fef2f2' : '#f0fdf4'"
               [style.border]="blastResult.failed.length ? '1px solid #fecaca' : '1px solid #bbf7d0'">
            Sent: {{ blastResult.sent.length }} &nbsp;|&nbsp;
            Skipped: {{ blastResult.skipped.length }} &nbsp;|&nbsp;
            <span [style.color]="blastResult.failed.length ? '#dc2626' : 'inherit'">Failed: {{ blastResult.failed.length }}</span>
          </div>

          <div *ngIf="round.vendorBids.length === 0" class="empty-state" style="padding:16px;">
            No vendors added yet. Add vendors above to start collecting prices.
          </div>

          <div *ngFor="let bid of round.vendorBids" style="margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:10px; padding:10px 14px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; flex-wrap:wrap;">
              <span style="font-weight:500; font-size:13px; flex:1; min-width:140px;">{{ bid.vendor.shopName }}</span>
              <span class="badge" [ngClass]="bid.status.toLowerCase()" style="font-size:11px;">{{ bid.status }}</span>
              <span style="font-size:12px; color:#6b7280;">
                {{ priceCount(bid) }}/{{ round.items.length }} prices entered
              </span>
              <div style="display:flex; gap:6px; margin-left:auto;">
                <button *ngIf="round.status === 'OPEN'" (click)="openPriceEntry(bid)"
                        style="font-size:12px; padding:4px 10px; background:#2563eb; color:#fff; border:none; border-radius:5px; cursor:pointer;">
                  {{ activeBidId === bid.id ? 'Close' : 'Enter Prices' }}
                </button>
                <button *ngIf="round.status === 'OPEN'" (click)="removeVendor(bid)"
                        style="font-size:12px; padding:4px 10px; background:none; border:1px solid #dc2626; color:#dc2626; border-radius:5px; cursor:pointer;">
                  Remove
                </button>
              </div>
            </div>

            <!-- Inline Price Entry Panel -->
            <div *ngIf="activeBidId === bid.id"
                 style="margin-top:2px; padding:14px; background:#fafbff; border:1px solid #bfdbfe; border-radius:0 0 8px 8px; border-top:none;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
                <strong style="font-size:13px;">Prices from {{ bid.vendor.shopName }}</strong>
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                  <!-- OCR import -->
                  <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-weight:normal;">
                    <input type="file" accept="image/*,.pdf" style="display:none;" (change)="onOcrFileSelected($event)" [disabled]="ocrLoading" />
                    <button type="button"
                            style="font-size:12px; padding:4px 10px; background:#7c3aed; color:#fff; border:none; border-radius:5px; cursor:pointer;"
                            [disabled]="ocrLoading"
                            (click)="$event.currentTarget.previousElementSibling?.click()">
                      {{ ocrLoading ? 'Extracting...' : 'Import Price List' }}
                    </button>
                  </label>
                  <span *ngIf="ocrResult" style="font-size:12px; color:#15803d;">
                    {{ ocrResult.matched }}/{{ ocrResult.total }} items matched
                  </span>
                  <span *ngIf="ocrError" style="font-size:12px; color:#dc2626;">{{ ocrError }}</span>
                  <span style="font-size:12px; color:#6b7280;">Status:</span>
                  <select [(ngModel)]="entryStatus" style="font-size:12px; padding:3px 6px; border:1px solid #d1d5db; border-radius:4px;">
                    <option value="PENDING">PENDING</option>
                    <option value="SENT">SENT</option>
                    <option value="RECEIVED">RECEIVED</option>
                    <option value="DECLINED">DECLINED</option>
                  </select>
                </div>
              </div>

              <table style="width:100%; border-collapse:collapse; font-size:13px; margin-bottom:10px;">
                <thead>
                  <tr style="background:#eff6ff;">
                    <th style="padding:6px 8px; text-align:left;">Item</th>
                    <th style="padding:6px 8px; text-align:right; width:80px;">Qty</th>
                    <th style="padding:6px 8px; text-align:left; width:60px;">Unit</th>
                    <th style="padding:6px 8px; text-align:right; width:130px;">Target (₹)</th>
                    <th style="padding:6px 8px; text-align:right; width:130px;">Vendor Price (₹) *</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let item of round.items" style="border-bottom:1px solid #e5e7eb;">
                    <td style="padding:6px 8px; font-weight:500;">{{ item.itemName }}</td>
                    <td style="padding:6px 8px; text-align:right; color:#6b7280;">{{ item.quantity ?? '—' }}</td>
                    <td style="padding:6px 8px; color:#6b7280;">{{ item.unit ?? '' }}</td>
                    <td style="padding:6px 8px; text-align:right; color:#9ca3af; font-size:12px;">{{ item.targetPrice != null ? ('₹' + item.targetPrice) : '—' }}</td>
                    <td style="padding:4px 8px;">
                      <input type="number" min="0" step="0.01"
                             [(ngModel)]="priceEntry[item.id]"
                             style="width:110px; padding:4px 6px; border:1px solid #d1d5db; border-radius:4px; text-align:right; font-size:13px;"
                             placeholder="0.00" />
                    </td>
                  </tr>
                </tbody>
              </table>

              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <label style="font-size:12px; color:#6b7280; font-weight:normal; display:flex; align-items:center; gap:6px; flex:1; min-width:200px;">
                  Notes
                  <input [(ngModel)]="entryNotes" style="flex:1; padding:4px 8px; border:1px solid #d1d5db; border-radius:4px; font-size:12px;" placeholder="Optional notes..." />
                </label>
                <button (click)="savePrices(bid)" [disabled]="savingPrices" style="padding:6px 16px; background:#2563eb; color:#fff; border:none; border-radius:6px; font-size:13px; cursor:pointer;">
                  {{ savingPrices ? 'Saving...' : 'Save Prices' }}
                </button>
              </div>

              <div *ngIf="priceEntryError" class="error" style="margin-top:6px; font-size:12px;">{{ priceEntryError }}</div>
              <div *ngIf="priceEntrySuccess" class="success" style="margin-top:6px; font-size:12px;">{{ priceEntrySuccess }}</div>
            </div>
          </div>
        </section>

        <!-- Comparison Matrix -->
        <section *ngIf="round.vendorBids.length > 0" style="margin-bottom:24px;">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">
            <h3 style="font-size:14px; font-weight:600; margin:0;">Price Comparison</h3>
            <button (click)="loadComparison()" [disabled]="loadingComparison"
                    style="font-size:12px; padding:4px 12px; background:#7c3aed; color:#fff; border:none; border-radius:5px; cursor:pointer;">
              {{ loadingComparison ? 'Loading...' : (comparison ? 'Refresh' : 'Load Comparison') }}
            </button>
          </div>

          <div *ngIf="comparison" style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
              <thead>
                <tr style="background:#f3f4f6;">
                  <th style="padding:8px 10px; text-align:left; min-width:150px;">Item</th>
                  <th style="padding:8px 10px; text-align:right; min-width:80px; color:#9ca3af;">Target</th>
                  <th *ngFor="let v of comparison.vendors"
                      style="padding:8px 10px; text-align:right; min-width:110px;"
                      [style.background]="awardType === 'SINGLE' && awardVendorId === v.vendorId ? '#f0fdf4' : ''">
                    <div style="font-weight:600;">{{ v.shopName }}</div>
                    <div style="font-size:11px; color:#6b7280;">{{ v.coverage }}% covered</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of comparison.items" style="border-bottom:1px solid #f3f4f6;">
                  <td style="padding:8px 10px; font-weight:500;">{{ row.itemName }}</td>
                  <td style="padding:8px 10px; text-align:right; color:#9ca3af; font-size:12px;">
                    {{ row.targetPrice != null ? ('₹' + row.targetPrice) : '—' }}
                  </td>
                  <td *ngFor="let v of comparison.vendors" style="padding:8px 10px; text-align:right;"
                      [style.background]="row.lowestVendorId === v.vendorId && row.lowestPrice != null ? '#f0fdf4' : ''"
                      [style.color]="row.lowestVendorId === v.vendorId && row.lowestPrice != null ? '#16a34a' : '#374151'"
                      [style.fontWeight]="row.lowestVendorId === v.vendorId && row.lowestPrice != null ? '600' : 'normal'">
                    <span *ngIf="row.prices[v.vendorId] != null">
                      ₹{{ row.prices[v.vendorId] }}
                      <span *ngIf="row.lowestVendorId === v.vendorId && row.lowestPrice != null" title="Lowest price" style="font-size:11px;">&#9660;</span>
                    </span>
                    <span *ngIf="row.prices[v.vendorId] == null" style="color:#d1d5db;">—</span>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr style="background:#f9fafb; font-weight:600;">
                  <td style="padding:8px 10px;">Total</td>
                  <td style="padding:8px 10px;"></td>
                  <td *ngFor="let v of comparison.vendors" style="padding:8px 10px; text-align:right;">
                    {{ v.total > 0 ? ('₹' + v.total.toFixed(2)) : '—' }}
                  </td>
                </tr>
              </tfoot>
            </table>

            <div *ngIf="comparison.suggestedSplit && hasSuggestedSplit()" style="margin-top:10px; padding:10px 14px; background:#fefce8; border:1px solid #fde68a; border-radius:6px; font-size:12px;">
              <strong>Suggested Split:</strong>
              <span *ngFor="let v of comparison.vendors; let last = last">
                {{ v.shopName }} gets {{ itemsForVendor(v.vendorId).join(', ') }}<span *ngIf="!last">; </span>
              </span>
            </div>
          </div>
        </section>

        <!-- Award Section -->
        <section *ngIf="round.status === 'OPEN' || round.status === 'COMPARING'" style="padding:16px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; margin-bottom:24px;">
          <h3 style="font-size:14px; font-weight:600; margin-bottom:12px;">Award Round</h3>

          <div style="display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap;">
            <label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer; font-weight:normal;">
              <input type="radio" [(ngModel)]="awardType" value="SPLIT" />
              Split Award <span style="font-size:11px; color:#6b7280;">(cheapest vendor per item)</span>
            </label>
            <label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer; font-weight:normal;">
              <input type="radio" [(ngModel)]="awardType" value="SINGLE" />
              Single Vendor
            </label>
          </div>

          <div *ngIf="awardType === 'SINGLE'" style="margin-top:10px;">
            <select [(ngModel)]="awardVendorId" style="padding:7px 10px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; min-width:220px;">
              <option value="">Select vendor to award...</option>
              <option *ngFor="let bid of round.vendorBids" [value]="bid.vendorId">{{ bid.vendor.shopName }}</option>
            </select>
          </div>

          <div style="margin-top:14px; display:flex; gap:8px; align-items:center;">
            <button (click)="award()" [disabled]="awarding || (awardType === 'SINGLE' && !awardVendorId)"
                    style="padding:8px 20px; background:#16a34a; color:#fff; border:none; border-radius:6px; font-size:13px; cursor:pointer; font-weight:500;">
              {{ awarding ? 'Awarding...' : 'Award & Generate PO Quotes' }}
            </button>
          </div>

          <div *ngIf="awardError" class="error" style="margin-top:8px;">{{ awardError }}</div>

          <!-- Award result -->
          <div *ngIf="awardResult" style="margin-top:12px; padding:12px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px;">
            <div style="font-size:13px; font-weight:600; color:#15803d; margin-bottom:8px;">
              Round awarded. {{ awardResult.quotations.length }} PO quote(s) generated.
            </div>
            <div *ngFor="let q of awardResult.quotations" style="font-size:12px; color:#374151; margin-bottom:6px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
              <a [routerLink]="['/quotations', q.id]" style="color:#2563eb;">{{ q.referenceNumber }}</a>
              <span>— {{ vendorName(q.vendorId) }} — ₹{{ q.totalAmount.toFixed(2) }}</span>
              <button (click)="downloadPo(q.id)"
                      style="font-size:11px; padding:3px 10px; background:#1d4ed8; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:500;">
                Download PO
              </button>
            </div>
          </div>
        </section>

        <!-- Already awarded -->
        <section *ngIf="round.status === 'AWARDED'" style="padding:12px 16px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; font-size:13px; color:#15803d; margin-bottom:16px;">
          This round has been awarded. View PO quotes in the Quotations section.
        </section>

      </ng-container>

      <div *ngIf="pageError" class="error" style="margin-top:12px;">{{ pageError }}</div>
    </div>
  `,
  styles: [`
    .badge.open { background:#dbeafe; color:#1d4ed8; }
    .badge.comparing { background:#fef3c7; color:#92400e; }
    .badge.awarded { background:#d1fae5; color:#065f46; }
    .badge.closed { background:#f3f4f6; color:#374151; }
    .badge.pending { background:#f3f4f6; color:#6b7280; }
    .badge.sent { background:#dbeafe; color:#1d4ed8; }
    .badge.received { background:#d1fae5; color:#065f46; }
    .badge.declined { background:#fee2e2; color:#b91c1c; }
  `],
})
export class ProcurementDetailComponent implements OnInit, OnDestroy {
  round: ProcurementRoundDto | null = null;
  loading = true;
  pageError = "";

  vendorList: VendorResponseDto[] = [];

  selectedVendorId = "";
  addingVendor = false;
  addVendorError = "";

  activeBidId = "";
  priceEntry: Record<string, number | null> = {};
  entryStatus = "RECEIVED";
  entryNotes = "";
  savingPrices = false;
  priceEntryError = "";
  priceEntrySuccess = "";

  ocrLoading = false;
  ocrResult: { matched: number; total: number } | null = null;
  ocrError = "";

  savingTemplate = false;
  savedTemplateMsg = "";

  comparison: ComparisonResultDto | null = null;
  loadingComparison = false;

  blasting = false;
  blastResult: { sent: string[]; skipped: string[]; failed: string[] } | null = null;

  awardType: "SPLIT" | "SINGLE" = "SPLIT";
  awardVendorId = "";
  awarding = false;
  awardError = "";
  awardResult: { type: string; quotations: { id: string; referenceNumber: string; vendorId: string; totalAmount: number }[] } | null = null;

  private readonly roundId: string;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly procurementService: ProcurementService,
    private readonly vendorService: VendorService,
  ) {
    this.roundId = this.route.snapshot.paramMap.get("id") ?? "";
  }

  ngOnInit() {
    this.loadRound();
    this.vendorService.list(1, 100).pipe(takeUntil(this.destroy$)).subscribe({
      next: res => { this.vendorList = res.data; },
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadRound() {
    this.loading = true;
    this.procurementService.getOne(this.roundId).pipe(takeUntil(this.destroy$)).subscribe({
      next: r => { this.round = r; this.loading = false; },
      error: () => { this.pageError = "Failed to load round."; this.loading = false; },
    });
  }

  priceCount(bid: VendorBidDto): number {
    if (!bid.lineItemPrices) return 0;
    return Object.values(bid.lineItemPrices).filter(v => v != null).length;
  }

  addVendor() {
    if (!this.selectedVendorId) return;
    this.addingVendor = true;
    this.addVendorError = "";
    this.procurementService.addVendor(this.roundId, this.selectedVendorId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.addingVendor = false;
        this.selectedVendorId = "";
        this.loadRound();
      },
      error: err => {
        this.addVendorError = (err?.error?.message as string) ?? "Failed to add vendor.";
        this.addingVendor = false;
      },
    });
  }

  removeVendor(bid: VendorBidDto) {
    if (!confirm(`Remove ${bid.vendor.shopName} from this round?`)) return;
    this.procurementService.removeVendor(this.roundId, bid.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.loadRound(); },
      error: () => {},
    });
  }

  openPriceEntry(bid: VendorBidDto) {
    if (this.activeBidId === bid.id) {
      this.activeBidId = "";
      return;
    }
    this.activeBidId = bid.id;
    this.priceEntryError = "";
    this.priceEntrySuccess = "";
    this.entryStatus = bid.status;
    this.entryNotes = bid.notes ?? "";
    this.priceEntry = {};
    if (bid.lineItemPrices) {
      Object.assign(this.priceEntry, bid.lineItemPrices);
    }
  }

  savePrices(bid: VendorBidDto) {
    this.savingPrices = true;
    this.priceEntryError = "";
    this.priceEntrySuccess = "";
    const prices: Record<string, number> = {};
    for (const [k, v] of Object.entries(this.priceEntry)) {
      if (v != null) prices[k] = v;
    }
    this.procurementService.updateBid(this.roundId, bid.id, {
      lineItemPrices: prices,
      status: this.entryStatus,
      notes: this.entryNotes || undefined,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.savingPrices = false;
        this.priceEntrySuccess = "Prices saved.";
        this.loadRound();
        setTimeout(() => { this.priceEntrySuccess = ""; }, 3000);
      },
      error: () => { this.priceEntryError = "Failed to save prices."; this.savingPrices = false; },
    });
  }

  blastRfq() {
    this.blasting = true;
    this.blastResult = null;
    this.procurementService.blastRfq(this.roundId).pipe(takeUntil(this.destroy$)).subscribe({
      next: result => {
        this.blastResult = result;
        this.blasting = false;
        this.loadRound();
      },
      error: () => { this.blasting = false; },
    });
  }

  loadComparison() {
    this.loadingComparison = true;
    this.procurementService.getComparison(this.roundId).pipe(takeUntil(this.destroy$)).subscribe({
      next: c => { this.comparison = c; this.loadingComparison = false; },
      error: () => { this.loadingComparison = false; },
    });
  }

  hasSuggestedSplit(): boolean {
    return this.comparison != null && Object.keys(this.comparison.suggestedSplit).length > 0;
  }

  itemsForVendor(vendorId: string): string[] {
    if (!this.comparison) return [];
    return this.comparison.items
      .filter(row => this.comparison!.suggestedSplit[row.itemId] === vendorId)
      .map(row => row.itemName);
  }

  award() {
    this.awarding = true;
    this.awardError = "";
    this.procurementService.award(
      this.roundId,
      this.awardType,
      this.awardType === "SINGLE" ? this.awardVendorId : undefined,
    ).pipe(takeUntil(this.destroy$)).subscribe({
      next: result => {
        this.awardResult = result;
        this.awarding = false;
        this.loadRound();
      },
      error: err => {
        this.awardError = (err?.error?.message as string) ?? "Award failed.";
        this.awarding = false;
      },
    });
  }

  vendorName(vendorId: string): string {
    return this.round?.vendorBids.find(b => b.vendorId === vendorId)?.vendor.shopName ?? vendorId;
  }

  downloadPo(quotationId: string) {
    window.open(this.procurementService.poPdfUrl(this.roundId, quotationId), "_blank");
  }

  saveAsTemplate() {
    this.savingTemplate = true;
    this.savedTemplateMsg = "";
    this.procurementService.saveAsTemplate(this.roundId).pipe(takeUntil(this.destroy$)).subscribe({
      next: t => {
        this.savingTemplate = false;
        this.savedTemplateMsg = `Saved as "${t.title}"`;
        setTimeout(() => { this.savedTemplateMsg = ""; }, 4000);
      },
      error: () => { this.savingTemplate = false; },
    });
  }

  onOcrFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.ocrLoading = true;
    this.ocrError = "";
    this.ocrResult = null;
    this.procurementService.ocrPriceList(file).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ items }) => {
        if (!this.round) return;
        let matched = 0;
        for (const ocrItem of items) {
          const normalised = ocrItem.itemName.toLowerCase().trim();
          const roundItem = this.round.items.find(ri =>
            ri.itemName.toLowerCase().trim() === normalised ||
            ri.itemName.toLowerCase().includes(normalised) ||
            normalised.includes(ri.itemName.toLowerCase().trim()),
          );
          if (roundItem && ocrItem.price != null) {
            this.priceEntry[roundItem.id] = ocrItem.price;
            matched++;
          }
        }
        this.ocrResult = { matched, total: items.length };
        this.ocrLoading = false;
        input.value = "";
      },
      error: (err: unknown) => {
        this.ocrError = (err as { error?: { message?: string } })?.error?.message ?? "OCR extraction failed.";
        this.ocrLoading = false;
        input.value = "";
      },
    });
  }
}
