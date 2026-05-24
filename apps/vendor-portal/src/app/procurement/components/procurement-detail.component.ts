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
        <div>
          <a routerLink="/procurement" class="back-link">Procurement</a>
          <h2 *ngIf="round">{{ round.title }}</h2>
        </div>
        <div *ngIf="round" class="admin-header-actions">
          <span class="badge" [ngClass]="round.status.toLowerCase()">{{ round.status }}</span>
          <button (click)="saveAsTemplate()" [disabled]="savingTemplate" class="btn-secondary">
            {{ savingTemplate ? 'Saving...' : 'Save as Template' }}
          </button>
          <span *ngIf="savedTemplateMsg" class="alert alert-success" style="padding:4px 10px; margin:0;">{{ savedTemplateMsg }}</span>
        </div>
      </div>

      <div *ngIf="loading" class="empty-state">Loading...</div>

      <ng-container *ngIf="round && !loading">

        <div *ngIf="round.notes" class="alert alert-info" style="margin-bottom:16px;">{{ round.notes }}</div>

        <div class="panel" style="margin-bottom:20px;">
          <div class="panel-header">
            <h3>Items ({{ round.items.length }})</h3>
          </div>
          <div class="table-wrapper" style="border-radius:0 0 var(--r-xl) var(--r-xl);">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item</th>
                  <th style="text-align:right;">Qty</th>
                  <th>Unit</th>
                  <th style="text-align:right;">Target Price</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of round.items; let i = index">
                  <td style="color:var(--text-faint);">{{ i + 1 }}</td>
                  <td style="font-weight:600;">{{ item.itemName }}<span *ngIf="item.description" style="font-size:11px; color:var(--text-faint); margin-left:6px;">{{ item.description }}</span></td>
                  <td style="text-align:right;">{{ item.quantity ?? '—' }}</td>
                  <td style="color:var(--text-muted);">{{ item.unit ?? '—' }}</td>
                  <td style="text-align:right; color:var(--text-muted);">{{ item.targetPrice != null ? ('₹' + item.targetPrice) : '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div *ngIf="round.status === 'OPEN'" class="panel" style="margin-bottom:20px;">
          <div class="panel-header"><h3>Add Vendor to Round</h3></div>
          <div class="panel-body" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <select [(ngModel)]="selectedVendorId" class="inline-input" style="flex:1; min-width:200px;">
              <option value="">Select vendor...</option>
              <option *ngFor="let v of vendorList" [value]="v.id">{{ v.shopName }}</option>
            </select>
            <button (click)="addVendor()" [disabled]="!selectedVendorId || addingVendor" class="btn-primary">
              {{ addingVendor ? 'Adding...' : 'Add Vendor' }}
            </button>
            <div *ngIf="addVendorError" class="alert alert-error" style="margin:0; width:100%;">{{ addVendorError }}</div>
          </div>
        </div>

        <section style="margin-bottom:24px;">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px; flex-wrap:wrap;">
            <h3 style="font-size:14px; font-weight:800; margin:0; color:var(--primary);">Vendor Bids ({{ round.vendorBids.length }})</h3>
            <button *ngIf="round.status === 'OPEN' && round.vendorBids.length > 0"
                    (click)="blastRfq()" [disabled]="blasting" class="btn-primary">
              {{ blasting ? 'Sending...' : 'Send RFQ via WhatsApp' }}
            </button>
          </div>
          <div *ngIf="blastResult" class="alert" style="margin-bottom:10px;"
               [class.alert-success]="!blastResult.failed.length" [class.alert-error]="blastResult.failed.length > 0">
            Sent: {{ blastResult.sent.length }} &nbsp;|&nbsp;
            Skipped: {{ blastResult.skipped.length }} &nbsp;|&nbsp;
            Failed: {{ blastResult.failed.length }}
          </div>

          <div *ngIf="round.vendorBids.length === 0" class="empty-state" style="padding:16px;">
            No vendors added yet. Add vendors above to start collecting prices.
          </div>

          <div *ngFor="let bid of round.vendorBids" style="margin-bottom:8px;">
            <div class="bid-card" [class.active]="activeBidId === bid.id">
              <span class="bid-vendor-name">{{ bid.vendor.shopName }}</span>
              <span class="badge" [ngClass]="bid.status.toLowerCase()">{{ bid.status }}</span>
              <span style="font-size:12px; color:var(--text-muted);">{{ priceCount(bid) }}/{{ round.items.length }} prices</span>
              <div style="display:flex; gap:6px; margin-left:auto;">
                <button *ngIf="round.status === 'OPEN'" (click)="openPriceEntry(bid)" class="btn-primary" style="font-size:12px; padding:5px 12px;">
                  {{ activeBidId === bid.id ? 'Close' : 'Enter Prices' }}
                </button>
                <button *ngIf="round.status === 'OPEN'" (click)="removeVendor(bid)" class="btn-danger" style="font-size:12px; padding:5px 10px;">Remove</button>
              </div>
            </div>

            <div *ngIf="activeBidId === bid.id" class="price-entry-panel">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
                <strong>Prices from {{ bid.vendor.shopName }}</strong>
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                  <label style="cursor:pointer;">
                    <input type="file" accept="image/*,.pdf" style="display:none;" (change)="onOcrFileSelected($event)" [disabled]="ocrLoading" />
                    <button type="button" class="btn-secondary" style="font-size:12px; padding:5px 12px;" [disabled]="ocrLoading" (click)="triggerPrecedingSibling($event)">
                      {{ ocrLoading ? 'Extracting...' : 'Import Price List' }}
                    </button>
                  </label>
                  <span *ngIf="ocrResult" style="font-size:12px; color:var(--green);">{{ ocrResult.matched }}/{{ ocrResult.total }} matched</span>
                  <span *ngIf="ocrError" style="font-size:12px; color:var(--red);">{{ ocrError }}</span>
                  <span style="font-size:12px; color:var(--text-muted);">Status:</span>
                  <select [(ngModel)]="entryStatus" class="inline-input" style="width:auto;">
                    <option value="PENDING">PENDING</option>
                    <option value="SENT">SENT</option>
                    <option value="RECEIVED">RECEIVED</option>
                    <option value="DECLINED">DECLINED</option>
                  </select>
                </div>
              </div>

              <div class="table-wrapper" style="margin-bottom:12px;">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th style="text-align:right; width:80px;">Qty</th>
                      <th style="width:60px;">Unit</th>
                      <th style="text-align:right; width:130px;">Target (₹)</th>
                      <th style="text-align:right; width:150px;">Vendor Price (₹) *</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let item of round.items">
                      <td style="font-weight:600;">{{ item.itemName }}</td>
                      <td style="text-align:right; color:var(--text-muted);">{{ item.quantity ?? '—' }}</td>
                      <td style="color:var(--text-muted);">{{ item.unit ?? '' }}</td>
                      <td style="text-align:right; color:var(--text-faint);">{{ item.targetPrice != null ? ('₹' + item.targetPrice) : '—' }}</td>
                      <td>
                        <input type="number" min="0" step="0.01"
                               [(ngModel)]="priceEntry[item.id]"
                               class="inline-input" style="text-align:right; width:120px;"
                               placeholder="0.00" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <input [(ngModel)]="entryNotes" class="inline-input" placeholder="Notes (optional)" style="flex:1; min-width:200px;" />
                <button (click)="savePrices(bid)" [disabled]="savingPrices" class="btn-primary">
                  {{ savingPrices ? 'Saving...' : 'Save Prices' }}
                </button>
              </div>

              <div *ngIf="priceEntryError" class="alert alert-error" style="margin-top:8px;">{{ priceEntryError }}</div>
              <div *ngIf="priceEntrySuccess" class="alert alert-success" style="margin-top:8px;">{{ priceEntrySuccess }}</div>
            </div>
          </div>
        </section>

        <div *ngIf="round.vendorBids.length > 0" class="panel" style="margin-bottom:24px;">
          <div class="panel-header">
            <h3>Price Comparison</h3>
            <button (click)="loadComparison()" [disabled]="loadingComparison" class="btn-secondary" style="font-size:12px; padding:5px 12px;">
              {{ loadingComparison ? 'Loading...' : (comparison ? 'Refresh' : 'Load Comparison') }}
            </button>
          </div>
          <div *ngIf="comparison" class="table-wrapper" style="border-radius:0 0 var(--r-xl) var(--r-xl);">
            <table>
              <thead>
                <tr>
                  <th style="min-width:150px;">Item</th>
                  <th style="text-align:right; min-width:80px; color:var(--text-faint);">Target</th>
                  <th *ngFor="let v of comparison.vendors"
                      style="text-align:right; min-width:110px;"
                      [style.background]="awardType === 'SINGLE' && awardVendorId === v.vendorId ? 'var(--green-bg)' : ''">
                    <div>{{ v.shopName }}</div>
                    <div style="font-size:10px; color:var(--text-faint); font-weight:500;">{{ v.coverage }}% covered</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of comparison.items">
                  <td style="font-weight:600;">{{ row.itemName }}</td>
                  <td style="text-align:right; color:var(--text-faint);">{{ row.targetPrice != null ? ('₹' + row.targetPrice) : '—' }}</td>
                  <td *ngFor="let v of comparison.vendors" style="text-align:right;"
                      [style.background]="row.lowestVendorId === v.vendorId && row.lowestPrice != null ? 'var(--green-bg)' : ''"
                      [style.color]="row.lowestVendorId === v.vendorId && row.lowestPrice != null ? 'var(--green)' : 'var(--text)'"
                      [style.fontWeight]="row.lowestVendorId === v.vendorId && row.lowestPrice != null ? '700' : 'normal'">
                    <span *ngIf="row.prices[v.vendorId] != null">
                      ₹{{ row.prices[v.vendorId] }}
                      <span *ngIf="row.lowestVendorId === v.vendorId && row.lowestPrice != null" title="Lowest price" style="font-size:11px;">&#9660;</span>
                    </span>
                    <span *ngIf="row.prices[v.vendorId] == null" style="color:var(--text-faint);">—</span>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr style="background:var(--surface-raised); font-weight:700;">
                  <td>Total</td>
                  <td></td>
                  <td *ngFor="let v of comparison.vendors" style="text-align:right;">
                    {{ v.total > 0 ? ('₹' + v.total.toFixed(2)) : '—' }}
                  </td>
                </tr>
              </tfoot>
            </table>
            <div *ngIf="comparison.suggestedSplit && hasSuggestedSplit()" class="alert alert-warn" style="margin:12px; border-radius:var(--r-md);">
              <strong>Suggested Split:</strong>
              <span *ngFor="let v of comparison.vendors; let last = last">
                {{ v.shopName }} gets {{ itemsForVendor(v.vendorId).join(', ') }}<span *ngIf="!last">; </span>
              </span>
            </div>
          </div>
        </div>

        <div *ngIf="round.status === 'OPEN' || round.status === 'COMPARING'" class="panel" style="margin-bottom:24px;">
          <div class="panel-header"><h3>Award Round</h3></div>
          <div class="panel-body">
            <div style="display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap; margin-bottom:12px;">
              <label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer; font-weight:500;">
                <input type="radio" [(ngModel)]="awardType" value="SPLIT" />
                Split Award <span style="font-size:11px; color:var(--text-muted);">(cheapest per item)</span>
              </label>
              <label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer; font-weight:500;">
                <input type="radio" [(ngModel)]="awardType" value="SINGLE" />
                Single Vendor
              </label>
            </div>

            <div *ngIf="awardType === 'SINGLE'" style="margin-bottom:14px;">
              <select [(ngModel)]="awardVendorId" class="inline-input" style="min-width:220px;">
                <option value="">Select vendor to award...</option>
                <option *ngFor="let bid of round.vendorBids" [value]="bid.vendorId">{{ bid.vendor.shopName }}</option>
              </select>
            </div>

            <button (click)="award()" [disabled]="awarding || (awardType === 'SINGLE' && !awardVendorId)" class="btn-primary">
              {{ awarding ? 'Awarding...' : 'Award & Generate PO Quotes' }}
            </button>

            <div *ngIf="awardError" class="alert alert-error" style="margin-top:10px;">{{ awardError }}</div>

            <div *ngIf="awardResult" class="alert alert-success" style="margin-top:12px;">
              <strong>Round awarded.</strong> {{ awardResult.quotations.length }} PO quote(s) generated.
              <div *ngFor="let q of awardResult.quotations" style="margin-top:6px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                <a [routerLink]="['/quotations', q.id]" class="btn-link">{{ q.referenceNumber }}</a>
                <span>{{ vendorName(q.vendorId) }} — ₹{{ q.totalAmount.toFixed(2) }}</span>
                <button (click)="downloadPo(q.id)" class="btn-secondary" style="font-size:11px; padding:4px 10px;">Download PO</button>
              </div>
            </div>
          </div>
        </div>

        <div *ngIf="round.status === 'AWARDED'" class="panel" style="margin-bottom:24px;">
          <div class="panel-header"><h3>Delivery Confirmation</h3></div>
          <div *ngFor="let bid of awardedBids()" style="padding:14px 16px; border-bottom:1px solid var(--border);">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px; flex-wrap:wrap;">
              <strong style="font-size:14px;">{{ bid.vendor.shopName }}</strong>
              <span class="badge" [ngClass]="deliveryStatus(bid)">{{ deliveryStatus(bid) }}</span>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:10px; margin-bottom:10px;">
              <div>
                <div style="font-size:11px; color:var(--text-muted); margin-bottom:4px;">Expected Delivery</div>
                <input type="date" class="inline-input"
                       [value]="deliveryDraft[bid.id]?.expectedDeliveryAt ?? (bid.expectedDeliveryAt ? bid.expectedDeliveryAt.substring(0,10) : '')"
                       (change)="setDeliveryField(bid.id, 'expectedDeliveryAt', $event)" />
              </div>
              <div>
                <div style="font-size:11px; color:var(--text-muted); margin-bottom:4px;">Delivered At</div>
                <input type="date" class="inline-input"
                       [value]="deliveryDraft[bid.id]?.deliveredAt ?? (bid.deliveredAt ? bid.deliveredAt.substring(0,10) : '')"
                       (change)="setDeliveryField(bid.id, 'deliveredAt', $event)" />
              </div>
              <div>
                <div style="font-size:11px; color:var(--text-muted); margin-bottom:4px;">Received Qty</div>
                <input type="number" min="0" class="inline-input" style="width:100%;"
                       [value]="deliveryDraft[bid.id]?.receivedQty ?? (bid.receivedQty ?? '')"
                       (input)="setDeliveryField(bid.id, 'receivedQty', $event)" />
              </div>
              <div>
                <div style="font-size:11px; color:var(--text-muted); margin-bottom:4px;">Discrepancy Notes</div>
                <input type="text" class="inline-input" placeholder="Optional"
                       [value]="deliveryDraft[bid.id]?.discrepancyNotes ?? (bid.discrepancyNotes ?? '')"
                       (input)="setDeliveryField(bid.id, 'discrepancyNotes', $event)" />
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
              <button (click)="saveDelivery(bid)" [disabled]="savingDelivery === bid.id" class="btn-primary" style="font-size:12px; padding:5px 14px;">
                {{ savingDelivery === bid.id ? 'Saving...' : 'Save Delivery' }}
              </button>
              <span *ngIf="deliverySaved === bid.id" class="alert alert-success" style="padding:4px 10px; margin:0; font-size:12px;">Saved</span>
              <span *ngIf="deliveryError === bid.id" class="alert alert-error" style="padding:4px 10px; margin:0; font-size:12px;">Save failed</span>
            </div>
          </div>
          <div *ngIf="awardedBids().length === 0" class="empty-state" style="padding:16px;">No awarded vendors found.</div>
        </div>

      </ng-container>

      <div *ngIf="pageError" class="error" style="margin-top:12px;">{{ pageError }}</div>
    </div>
  `,
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

  deliveryDraft: Record<string, { expectedDeliveryAt?: string; deliveredAt?: string; receivedQty?: number; discrepancyNotes?: string }> = {};
  savingDelivery = "";
  deliverySaved = "";
  deliveryError = "";

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

  awardedBids(): VendorBidDto[] {
    if (!this.round) return [];
    return this.round.vendorBids.filter(b => b.quotationId != null);
  }

  deliveryStatus(bid: VendorBidDto): string {
    if (bid.deliveredAt) return "received";
    if (bid.expectedDeliveryAt) return "pending";
    return "awaiting";
  }

  setDeliveryField(bidId: string, field: string, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (!this.deliveryDraft[bidId]) this.deliveryDraft[bidId] = {};
    if (field === "receivedQty") {
      this.deliveryDraft[bidId][field] = value ? Number(value) : undefined;
    } else {
      (this.deliveryDraft[bidId] as Record<string, string | undefined>)[field] = value || undefined;
    }
  }

  saveDelivery(bid: VendorBidDto) {
    const draft = this.deliveryDraft[bid.id] ?? {};
    const payload: { expectedDeliveryAt?: string; deliveredAt?: string; receivedQty?: number; discrepancyNotes?: string } = {};
    const expDelivery = draft.expectedDeliveryAt ?? (bid.expectedDeliveryAt ? bid.expectedDeliveryAt.substring(0, 10) : undefined);
    const deliveredAt = draft.deliveredAt ?? (bid.deliveredAt ? bid.deliveredAt.substring(0, 10) : undefined);
    if (expDelivery) payload.expectedDeliveryAt = expDelivery;
    if (deliveredAt) payload.deliveredAt = deliveredAt;
    if (draft.receivedQty != null) payload.receivedQty = draft.receivedQty;
    else if (bid.receivedQty != null) payload.receivedQty = bid.receivedQty;
    const discrepancy = draft.discrepancyNotes ?? bid.discrepancyNotes ?? undefined;
    if (discrepancy) payload.discrepancyNotes = discrepancy;

    this.savingDelivery = bid.id;
    this.deliverySaved = "";
    this.deliveryError = "";
    this.procurementService.updateDelivery(this.roundId, bid.id, payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: updated => {
        this.savingDelivery = "";
        this.deliverySaved = bid.id;
        delete this.deliveryDraft[bid.id];
        if (this.round) {
          const idx = this.round.vendorBids.findIndex(b => b.id === bid.id);
          if (idx >= 0) this.round.vendorBids[idx] = updated;
        }
        setTimeout(() => { if (this.deliverySaved === bid.id) this.deliverySaved = ""; }, 3000);
      },
      error: () => {
        this.savingDelivery = "";
        this.deliveryError = bid.id;
        setTimeout(() => { if (this.deliveryError === bid.id) this.deliveryError = ""; }, 3000);
      },
    });
  }

  triggerPrecedingSibling(event: MouseEvent) {
    (event.currentTarget as HTMLElement).previousElementSibling?.dispatchEvent(new MouseEvent("click"));
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
