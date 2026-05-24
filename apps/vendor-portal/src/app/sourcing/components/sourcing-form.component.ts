import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { CreateSourcingItemRequest, CustomerDto, PriceLookupResult, PriceSuggestion, SourcingQuoteDto, SourcingQuoteRevisionDto, SourcingQuoteSendDto, SourcingStatus } from "@fulfilus/shared";
import { debounceTime, EMPTY, Subject, switchMap, takeUntil } from "rxjs";
import { CustomerService } from "../../customer/services/customer.service";
import { SourcingService } from "../services/sourcing.service";

type EntryMode = "manual" | "paste" | "csv";

@Component({
  selector: "app-sourcing-form",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, FormsModule],
  template: `
    <div class="admin-page">
      <div class="admin-header">
        <div>
          <a routerLink="/sourcing" class="back-link">Sourcing Quotes</a>
          <h2>{{ quoteId ? 'Edit' : 'New' }} Sourcing Quote</h2>
        </div>
        <div *ngIf="quoteId" class="admin-header-actions">
          <button class="btn-secondary" (click)="downloadPdf('customer')" [disabled]="downloading">
            {{ downloading === 'customer' ? 'Generating...' : 'Customer PDF' }}
          </button>
          <button class="btn-secondary" (click)="downloadPdf('internal')" [disabled]="downloading">
            {{ downloading === 'internal' ? 'Generating...' : 'Internal PDF' }}
          </button>
        </div>
      </div>

      <form [formGroup]="form" (ngSubmit)="save()">

        <!-- Quote meta -->
        <div class="panel">
          <div class="panel-header"><h3>Quote Details</h3></div>
          <div class="panel-body">
            <div class="two-col">
              <label class="compact-label">Title *
                <input class="inline-input" formControlName="title" placeholder="e.g. Office Supplies — June 2026" />
              </label>
              <label class="compact-label">Valid Until
                <input class="inline-input" formControlName="validUntil" type="date" />
              </label>
            </div>
            <label class="compact-label" style="margin-top:4px;">Notes
              <textarea class="inline-input" formControlName="notes" rows="2" placeholder="Internal notes or special instructions"></textarea>
            </label>
          </div>
        </div>

        <!-- Customer info -->
        <div class="panel">
          <div class="panel-header">
            <h3>Customer Information</h3>
            <a routerLink="/customers/new" target="_blank" class="btn-link" style="font-size:12px;">+ New Customer</a>
          </div>
          <div class="panel-body">
            <!-- Customer search -->
            <div style="position:relative; margin-bottom:16px;">
              <label class="compact-label">Search existing customer
                <input class="inline-input" [(ngModel)]="customerSearch" [ngModelOptions]="{standalone:true}"
                       (ngModelChange)="onCustomerSearch($event)"
                       placeholder="Type name, company or phone..." />
              </label>
              <div *ngIf="customerResults.length" class="dropdown-list">
                <div *ngFor="let c of customerResults" class="dropdown-item" (click)="selectCustomer(c)">
                  <strong>{{ c.name }}</strong>
                  <span *ngIf="c.companyName" style="color:var(--text-muted); margin-left:6px;">{{ c.companyName }}</span>
                  <span *ngIf="c.phone" style="color:var(--text-faint); margin-left:6px; font-size:11px;">{{ c.phone }}</span>
                </div>
              </div>
            </div>

            <div *ngIf="selectedCustomerName" class="alert alert-info" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
              <span>Linked to: <strong>{{ selectedCustomerName }}</strong></span>
              <button type="button" (click)="clearCustomer()" class="btn-link" style="color:var(--red); font-size:12px;">Unlink</button>
            </div>

            <div class="two-col">
              <label class="compact-label">Name
                <input class="inline-input" formControlName="customerName" placeholder="Rajesh Kumar" />
              </label>
              <label class="compact-label">Company
                <input class="inline-input" formControlName="customerCompany" placeholder="Acme Corp" />
              </label>
              <label class="compact-label">Phone / WhatsApp
                <input class="inline-input" formControlName="customerPhone" placeholder="+91 98765 43210" />
              </label>
              <label class="compact-label">Email
                <input class="inline-input" formControlName="customerEmail" type="email" placeholder="buyer@company.com" />
              </label>
              <label class="compact-label">GST Number
                <input class="inline-input" formControlName="customerGst" placeholder="27AABCU9603R1ZX" />
              </label>
              <label class="compact-label">Address
                <input class="inline-input" formControlName="customerAddress" placeholder="123 Main Street, City" />
              </label>
            </div>
          </div>
        </div>

        <!-- Markup -->
        <div class="panel">
          <div class="panel-header">
            <div>
              <h3 style="margin-bottom:2px;">Global Markup</h3>
              <span style="font-size:11px; color:var(--text-muted); font-weight:500; text-transform:none; letter-spacing:0;">Applied to all items unless overridden per-row</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <label class="compact-label" style="margin:0; flex-direction:row; align-items:center; gap:8px;">
                <span>Markup %</span>
                <input class="inline-input" formControlName="globalMarkupPct" type="number" min="0" max="500"
                       style="width:80px;" (change)="recalcAll()" />
              </label>
              <button type="button" class="btn-secondary" (click)="lookupAll()" [disabled]="looking">
                {{ looking ? 'Looking up...' : 'Lookup All Prices' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Item entry -->
        <div class="panel">
          <div class="panel-header">
            <h3>Items</h3>
            <div style="display:flex; gap:8px; align-items:center;">
              <div class="mode-tabs">
                <button type="button" class="mode-tab" [class.active]="entryMode==='manual'" (click)="entryMode='manual'">Manual</button>
                <button type="button" class="mode-tab" [class.active]="entryMode==='paste'" (click)="entryMode='paste'">Paste</button>
                <button type="button" class="mode-tab" [class.active]="entryMode==='csv'" (click)="entryMode='csv'">CSV</button>
              </div>
              <button type="button" class="btn-success" (click)="addRow()" *ngIf="entryMode==='manual'" style="padding:6px 12px; font-size:12.5px;">+ Row</button>
            </div>
          </div>
          <div class="panel-body">

            <!-- Paste mode -->
            <div *ngIf="entryMode==='paste'" style="margin-bottom:14px;">
              <textarea class="inline-input" style="font-family:monospace; font-size:12px;" rows="6"
                        [(ngModel)]="pasteText" [ngModelOptions]="{standalone:true}"
                        placeholder="Paste item names, one per line:&#10;Rice 25kg&#10;Cooking Oil 5L&#10;Sugar 1kg"></textarea>
              <div style="font-size:11px; color:var(--text-faint); margin-top:4px;">One item name per line. Press Import to add to the table.</div>
              <button type="button" class="btn-primary" style="margin-top:8px;" (click)="importPaste()">Import Items</button>
            </div>

            <!-- CSV mode -->
            <div *ngIf="entryMode==='csv'" style="margin-bottom:14px;">
              <label class="compact-label">Upload CSV file
                <input type="file" accept=".csv,.txt" (change)="onCsvFile($event)" style="margin-top:4px;" />
              </label>
              <div style="font-size:11px; color:var(--text-faint); margin-top:4px;">CSV format: itemName, description, quantity, unit, costPrice</div>
            </div>

            <!-- Items table -->
            <div style="overflow-x:auto;">
              <table class="table-compact">
                <thead>
                  <tr>
                    <th class="hide-mobile">#</th>
                    <th style="min-width:160px;">Item Name *</th>
                    <th class="hide-mobile" style="min-width:110px;">Description</th>
                    <th style="width:60px;">Qty</th>
                    <th style="width:55px;">Unit</th>
                    <th class="hide-mobile" style="width:100px;">Cost Price (₹)</th>
                    <th class="hide-mobile" style="width:130px;">Source</th>
                    <th class="hide-mobile" style="width:65px;">Mkp %</th>
                    <th style="width:110px;">Selling Price (₹)</th>
                    <th class="hide-mobile" style="width:80px;">Lookup</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody formArrayName="items">
                  <ng-container *ngFor="let row of items.controls; let i = index" [formGroupName]="i">
                    <tr>
                      <td class="hide-mobile" style="color:var(--text-faint); text-align:center;">{{ i + 1 }}</td>
                      <td><input formControlName="itemName" placeholder="e.g. Rice 25kg" /></td>
                      <td class="hide-mobile"><input formControlName="description" placeholder="optional" /></td>
                      <td><input formControlName="quantity" type="number" min="0" style="text-align:right;" /></td>
                      <td><input formControlName="unit" placeholder="kg" /></td>
                      <td class="hide-mobile">
                        <input formControlName="costPrice" type="number" min="0" step="0.01"
                               style="text-align:right;" (change)="recalcRow(i)" placeholder="0.00" />
                      </td>
                      <td class="hide-mobile" style="font-size:11px; color:var(--text-muted);">
                        <div>{{ row.get('sourceName')?.value || '—' }}</div>
                        <div *ngIf="row.get('sourceType')?.value" style="color:var(--text-faint);">{{ row.get('sourceType')?.value }}</div>
                      </td>
                      <td class="hide-mobile">
                        <input formControlName="markupPct" type="number" min="0" max="500" style="width:56px;"
                               (change)="recalcRow(i)" placeholder="{{ form.get('globalMarkupPct')?.value }}" />
                      </td>
                      <td style="font-weight:700; color:var(--blue);">
                        {{ calcSelling(row.get('costPrice')?.value, row.get('markupPct')?.value) | number:'1.2-2' }}
                      </td>
                      <td class="hide-mobile">
                        <button type="button" class="btn-ghost" style="padding:3px 8px; font-size:11px;"
                                (click)="lookupRow(i)" [disabled]="!row.get('itemName')?.value || looking">
                          {{ looking === i ? '...' : 'Lookup' }}
                        </button>
                      </td>
                      <td>
                        <button type="button" class="btn-link" style="color:var(--red);" (click)="removeRow(i)" [disabled]="items.length === 1">✕</button>
                      </td>
                    </tr>
                    <!-- Suggestions -->
                    <tr *ngIf="suggestions[i] && suggestions[i].length > 0">
                      <td colspan="11" style="padding:0 8px 10px 28px;">
                        <div class="suggestions-panel">
                          <div class="suggestions-header">Price suggestions for "{{ row.get('itemName')?.value }}"</div>
                          <div class="suggestion-row" *ngFor="let s of suggestions[i]">
                            <div>
                              <strong>{{ s.vendorName }}</strong>
                              <span class="source-badge" [ngClass]="s.source.toLowerCase()" style="margin-left:6px;">
                                {{ s.source === 'PRICE_LIST' ? 'Price List' : s.source === 'AGREED_RATE' ? 'Contract' : 'Bid' }}
                              </span>
                              <span *ngIf="s.unit" style="color:var(--text-faint); margin-left:4px; font-size:11px;">per {{ s.unit }}</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:10px;">
                              <strong>₹{{ s.price | number:'1.2-2' }}</strong>
                              <span style="color:var(--text-faint); font-size:10px;">{{ s.date | date:'dd MMM yy' }}</span>
                              <button type="button" class="btn-link" (click)="useSuggestion(i, s)">Use</button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                    <tr *ngIf="suggestions[i] && suggestions[i].length === 0">
                      <td colspan="11" style="padding:0 8px 8px 28px; font-size:11px; color:var(--text-faint);">
                        No matching prices found for "{{ row.get('itemName')?.value }}"
                      </td>
                    </tr>
                  </ng-container>
                </tbody>
              </table>
            </div>

            <!-- Totals -->
            <div *ngIf="items.length > 0" style="margin-top:14px; text-align:right; font-size:13px; padding-top:12px; border-top:1px solid rgba(37,99,235,.08);">
              <div style="color:var(--text-muted);">Total Cost: <strong style="color:var(--text);">{{ totalCost | currency:'INR':'symbol':'1.2-2' }}</strong></div>
              <div style="margin-top:4px;">Total Selling: <strong style="color:var(--blue); font-size:16px;">{{ totalSelling | currency:'INR':'symbol':'1.2-2' }}</strong></div>
              <div style="color:var(--green); margin-top:2px; font-size:12px;">
                Margin: {{ totalCost > 0 ? ((totalSelling - totalCost) / totalCost * 100 | number:'1.1-1') : 0 }}%
                ({{ totalSelling - totalCost | currency:'INR':'symbol':'1.2-2' }})
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="actions">
          <button type="submit" class="btn-primary" [disabled]="form.invalid || saving || currentStatus === 'ACCEPTED'">
            {{ saving ? 'Saving...' : (quoteId ? 'Save Changes' : 'Create Quote') }}
          </button>
          <a routerLink="/sourcing" class="btn-secondary" style="text-decoration:none;">Cancel</a>
          <div *ngIf="quoteId" style="display:flex; gap:8px; flex-wrap:wrap; margin-left:auto;">
            <button *ngIf="currentStatus === 'DRAFT'" type="button" class="btn-secondary"
                    (click)="openSendDialog()" [disabled]="statusChanging"
                    style="border-color:var(--blue); color:var(--blue);">
              Mark as Sent
            </button>
            <button *ngIf="currentStatus === 'SENT'" type="button" class="btn-secondary"
                    (click)="changeStatus('ACCEPTED')" [disabled]="statusChanging"
                    style="border-color:var(--green); color:var(--green);">
              Mark Accepted
            </button>
            <button *ngIf="currentStatus === 'SENT'" type="button" class="btn-secondary"
                    (click)="changeStatus('REJECTED')" [disabled]="statusChanging"
                    style="border-color:var(--red); color:var(--red);">
              Mark Rejected
            </button>
            <button *ngIf="currentStatus === 'REJECTED'" type="button" class="btn-secondary"
                    (click)="changeStatus('DRAFT')" [disabled]="statusChanging">
              Reopen as Draft
            </button>
            <button type="button" class="btn-secondary" (click)="duplicateQuote()" [disabled]="duplicating">
              {{ duplicating ? 'Copying...' : 'Duplicate' }}
            </button>
            <button type="button" class="btn-secondary" (click)="downloadPdf('customer')" [disabled]="downloading">
              {{ downloading === 'customer' ? 'Generating...' : 'Customer PDF' }}
            </button>
            <button type="button" class="btn-secondary" (click)="downloadPdf('internal')" [disabled]="downloading">
              {{ downloading === 'internal' ? 'Generating...' : 'Internal PDF' }}
            </button>
            <button *ngIf="currentStatus === 'ACCEPTED'" type="button" class="btn-primary"
                    (click)="generateInvoice()" [disabled]="generatingInvoice"
                    style="background:var(--green); border-color:var(--green);">
              {{ generatingInvoice ? 'Generating...' : (invoice ? 'Download Invoice' : 'Generate Invoice') }}
            </button>
          </div>
        </div>

        <div *ngIf="error" style="color:var(--red); font-size:12px; margin-top:8px; font-weight:600;">{{ error }}</div>
      </form>

      <!-- Mark as Sent dialog -->
      <div *ngIf="showSendDialog" class="modal-overlay">
        <div class="modal-card" style="width:400px;">
          <h3>Record Quote Send</h3>
          <label class="compact-label" style="margin-bottom:12px;">Delivery Method *
            <select class="inline-input" [(ngModel)]="sendMethod">
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">Email</option>
              <option value="PDF_HANDOFF">PDF Hand-off</option>
            </select>
          </label>
          <label class="compact-label" style="margin-bottom:12px;">Sent By *
            <input class="inline-input" [(ngModel)]="sendBy" placeholder="Your name" />
          </label>
          <label class="compact-label" style="margin-bottom:16px;">Notes
            <textarea class="inline-input" [(ngModel)]="sendNotes" rows="2"
                      placeholder="e.g. Sent to buyer's personal WhatsApp, awaiting confirmation"></textarea>
          </label>
          <div style="display:flex; gap:8px; justify-content:flex-end;">
            <button type="button" class="btn-secondary" (click)="showSendDialog=false">Cancel</button>
            <button type="button" class="btn-primary" (click)="confirmSend()" [disabled]="!sendMethod || !sendBy || statusChanging">
              {{ statusChanging ? 'Saving...' : 'Confirm Send' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Send history -->
      <div *ngIf="quoteId && sends.length" class="panel" style="margin-top:16px;">
        <div class="panel-header"><h3>Send History</h3></div>
        <div class="panel-body" style="padding:0;">
          <div *ngFor="let s of sends" style="display:flex; align-items:flex-start; gap:12px; padding:12px 20px; border-bottom:1px solid rgba(37,99,235,.06); font-size:12px;">
            <span class="chip">{{ s.method }}</span>
            <div style="flex:1;">
              <div><strong>{{ s.sentBy }}</strong><span *ngIf="s.notes" style="color:var(--text-muted); margin-left:6px;">— {{ s.notes }}</span></div>
              <div style="color:var(--text-faint); margin-top:2px;">{{ s.createdAt | date:'dd MMM yy, HH:mm' }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Status + revision history -->
      <div *ngIf="quoteId" style="margin-top:16px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
        <span style="font-size:12px; color:var(--text-muted);">Status:</span>
        <span class="badge" [ngClass]="currentStatus.toLowerCase()">{{ currentStatus }}</span>
        <span *ngIf="revisionNumber > 1" style="font-size:12px; color:var(--text-faint);">Rev {{ revisionNumber }}</span>
        <span *ngIf="sentAt" style="font-size:12px; color:var(--text-muted);">Sent {{ sentAt | date:'dd MMM yy' }}</span>
        <span *ngIf="acceptedAt" style="font-size:12px; color:var(--green);">Accepted {{ acceptedAt | date:'dd MMM yy' }}</span>
        <span *ngIf="rejectedAt" style="font-size:12px; color:var(--red);">Rejected {{ rejectedAt | date:'dd MMM yy' }}</span>
        <button *ngIf="revisions.length > 0" type="button" class="btn-ghost" style="font-size:11px; padding:3px 10px;"
                (click)="showRevisions = !showRevisions">
          {{ showRevisions ? 'Hide' : 'Show' }} Revision History ({{ revisions.length }})
        </button>
      </div>

      <div *ngIf="showRevisions && revisions.length" class="panel" style="margin-top:12px;">
        <div class="panel-header"><h3>Revision History</h3></div>
        <div class="panel-body" style="padding:0;">
          <div *ngFor="let rev of revisions" style="display:flex; align-items:center; gap:16px; padding:10px 20px; border-bottom:1px solid rgba(37,99,235,.06); font-size:12px;">
            <span style="color:var(--text-muted); min-width:52px; font-weight:600;">Rev {{ rev.revisionNumber }}</span>
            <span style="color:var(--text-faint);">{{ rev.createdAt | date:'dd MMM yy HH:mm' }}</span>
            <span *ngIf="revisionSnapshot(rev)">
              {{ revisionItemCount(rev) }} items — Total selling ₹{{ revisionTotal(rev) | number:'1.2-2' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class SourcingFormComponent implements OnInit, OnDestroy {
  form: FormGroup;
  quoteId: string | null = null;
  saving = false;
  error = "";
  entryMode: EntryMode = "manual";
  pasteText = "";
  looking: number | "all" | false = false;
  suggestions: PriceSuggestion[][] = [];
  downloading: "customer" | "internal" | false = false;
  statusChanging = false;
  duplicating = false;
  currentStatus: SourcingStatus = "DRAFT";
  revisionNumber = 1;
  sentAt: string | null = null;
  acceptedAt: string | null = null;
  rejectedAt: string | null = null;
  invoice: { id: string; invoiceNumber: string; issuedAt: string; dueAt: string | null } | null = null;
  generatingInvoice = false;
  revisions: SourcingQuoteRevisionDto[] = [];
  showRevisions = false;
  sends: SourcingQuoteSendDto[] = [];
  // Customer search
  customerSearch = "";
  customerResults: CustomerDto[] = [];
  selectedCustomerId: string | null = null;
  selectedCustomerName = "";
  private readonly customerSearch$ = new Subject<string>();
  // Send dialog
  showSendDialog = false;
  sendMethod: "WHATSAPP" | "EMAIL" | "PDF_HANDOFF" = "WHATSAPP";
  sendBy = "";
  sendNotes = "";
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly sourcingService: SourcingService,
    private readonly customerService: CustomerService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {
    this.form = this.fb.group({
      title: ["", Validators.required],
      customerName: [""],
      customerCompany: [""],
      customerAddress: [""],
      customerPhone: [""],
      customerEmail: [""],
      customerGst: [""],
      validUntil: [""],
      notes: [""],
      globalMarkupPct: [15, [Validators.min(0), Validators.max(500)]],
      items: this.fb.array([this.newItemGroup()]),
    });
  }

  ngOnInit() {
    this.route.paramMap.pipe(
      takeUntil(this.destroy$),
      switchMap(params => {
        const id = params.get("id");
        this.quoteId = id;
        this.suggestions = [[]];
        this.currentStatus = "DRAFT";
        this.revisionNumber = 1;
        this.sentAt = null;
        this.acceptedAt = null;
        this.rejectedAt = null;
        this.revisions = [];
        this.sends = [];
        this.selectedCustomerId = null;
        this.selectedCustomerName = "";
        this.error = "";
        this.form.reset({ title: "", customerName: "", customerCompany: "", customerAddress: "", customerPhone: "", customerEmail: "", customerGst: "", validUntil: "", notes: "", globalMarkupPct: 15 });
        this.items.clear();
        this.items.push(this.newItemGroup());
        if (!id) return EMPTY;
        return this.sourcingService.getOne(id);
      }),
    ).subscribe({
      next: (q: SourcingQuoteDto) => {
        this.form.patchValue({
          title: q.title,
          customerName: q.customerName ?? "",
          customerCompany: q.customer?.companyName ?? "",
          customerAddress: q.customerAddress ?? "",
          customerPhone: q.customerPhone ?? "",
          customerEmail: q.customerEmail ?? "",
          customerGst: q.customerGst ?? "",
          validUntil: q.validUntil ? q.validUntil.substring(0, 10) : "",
          notes: q.notes ?? "",
          globalMarkupPct: q.globalMarkupPct,
        });
        this.currentStatus = q.status;
        this.revisionNumber = q.revisionNumber;
        this.sentAt = q.sentAt;
        this.acceptedAt = q.acceptedAt;
        this.rejectedAt = q.rejectedAt;
        this.revisions = q.revisions ?? [];
        this.sends = q.sends ?? [];
        if (q.customer) {
          this.selectedCustomerId = q.customer.id;
          this.selectedCustomerName = q.customer.companyName
            ? `${q.customer.name} (${q.customer.companyName})`
            : q.customer.name;
        }
        this.invoice = null;
        if (q.status === "ACCEPTED" && this.quoteId) {
          this.sourcingService.getInvoice(this.quoteId).pipe(takeUntil(this.destroy$)).subscribe({
            next: inv => { this.invoice = inv; },
            error: () => {},
          });
        }
        this.items.clear();
        this.suggestions = [];
        q.items.forEach(item => {
          const g = this.newItemGroup();
          g.patchValue({
            itemName: item.itemName,
            description: item.description ?? "",
            quantity: item.quantity,
            unit: item.unit ?? "",
            costPrice: item.costPrice,
            sourceType: item.sourceType ?? "manual",
            sourceName: item.sourceName ?? "",
            markupPct: item.markupPct,
            sellingPrice: item.sellingPrice,
          });
          this.items.push(g);
          this.suggestions.push([]);
        });
      },
    });

    this.customerSearch$.pipe(debounceTime(300), takeUntil(this.destroy$)).subscribe(q => {
      if (!q) { this.customerResults = []; return; }
      this.customerService.list(1, 8, q).subscribe({ next: res => { this.customerResults = res.data; } });
    });
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  onCustomerSearch(val: string) { this.customerSearch$.next(val); }

  selectCustomer(c: CustomerDto) {
    this.selectedCustomerId = c.id;
    this.selectedCustomerName = c.companyName ? `${c.name} (${c.companyName})` : c.name;
    this.customerSearch = "";
    this.customerResults = [];
    this.form.patchValue({
      customerName: c.name,
      customerCompany: c.companyName ?? "",
      customerPhone: c.phone ?? "",
      customerEmail: c.email ?? "",
      customerAddress: c.address ?? "",
      customerGst: c.gstNumber ?? "",
    });
  }

  clearCustomer() {
    this.selectedCustomerId = null;
    this.selectedCustomerName = "";
  }

  openSendDialog() { this.showSendDialog = true; }

  confirmSend() {
    if (!this.quoteId || !this.sendMethod || !this.sendBy) return;
    this.statusChanging = true;
    this.sourcingService.updateStatus(this.quoteId, "SENT", {
      method: this.sendMethod,
      sentBy: this.sendBy,
      sendNotes: this.sendNotes || undefined,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (q: SourcingQuoteDto) => {
        this.currentStatus = q.status;
        this.sentAt = q.sentAt;
        this.sends = q.sends ?? [];
        this.showSendDialog = false;
        this.statusChanging = false;
        this.sendNotes = "";
      },
      error: () => { this.statusChanging = false; },
    });
  }

  get items(): FormArray { return this.form.get("items") as FormArray; }

  get totalCost(): number {
    return this.items.controls.reduce((sum, row) => {
      const cost = Number(row.get("costPrice")?.value) || 0;
      const qty = Number(row.get("quantity")?.value) || 1;
      return sum + cost * qty;
    }, 0);
  }

  get totalSelling(): number {
    return this.items.controls.reduce((sum, row) => {
      const sell = this.calcSelling(row.get("costPrice")?.value, row.get("markupPct")?.value);
      const qty = Number(row.get("quantity")?.value) || 1;
      return sum + sell * qty;
    }, 0);
  }

  newItemGroup(): FormGroup {
    return this.fb.group({
      itemName: ["", Validators.required],
      description: [""],
      quantity: [null],
      unit: [""],
      costPrice: [null],
      sourceType: ["manual"],
      sourceName: [""],
      markupPct: [null],
      sellingPrice: [null],
    });
  }

  addRow() {
    this.items.push(this.newItemGroup());
    this.suggestions.push([]);
  }

  removeRow(i: number) {
    if (this.items.length > 1) {
      this.items.removeAt(i);
      this.suggestions.splice(i, 1);
    }
  }

  calcSelling(cost: number | null | undefined, markupPct: number | null | undefined): number {
    const c = Number(cost) || 0;
    if (c === 0) return 0;
    const mkp = markupPct != null ? Number(markupPct) : Number(this.form.get("globalMarkupPct")?.value) || 15;
    return Math.round(c * (1 + mkp / 100) * 100) / 100;
  }

  recalcRow(i: number) {
    const row = this.items.at(i);
    const sell = this.calcSelling(row.get("costPrice")?.value, row.get("markupPct")?.value);
    row.patchValue({ sellingPrice: sell > 0 ? sell : null }, { emitEvent: false });
  }

  recalcAll() {
    for (let i = 0; i < this.items.length; i++) this.recalcRow(i);
  }

  useSuggestion(i: number, s: PriceSuggestion) {
    this.items.at(i).patchValue({
      costPrice: s.price,
      sourceName: s.vendorName,
      sourceType: s.source,
      unit: this.items.at(i).get("unit")?.value || s.unit || "",
    });
    this.recalcRow(i);
    this.suggestions[i] = [];
  }

  lookupRow(i: number) {
    const name = this.items.at(i).get("itemName")?.value as string;
    if (!name) return;
    this.looking = i;
    this.sourcingService.lookup([name]).pipe(takeUntil(this.destroy$)).subscribe({
      next: res => {
        this.suggestions[i] = res[name] ?? [];
        this.looking = false;
      },
      error: () => { this.looking = false; },
    });
  }

  lookupAll() {
    const names = this.items.controls
      .map(r => r.get("itemName")?.value as string)
      .filter(Boolean);
    if (!names.length) return;
    this.looking = "all";
    this.sourcingService.lookup(names).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: PriceLookupResult) => {
        this.items.controls.forEach((row, i) => {
          const name = row.get("itemName")?.value as string;
          if (name) this.suggestions[i] = res[name] ?? [];
        });
        this.looking = false;
      },
      error: () => { this.looking = false; },
    });
  }

  importPaste() {
    const lines = this.pasteText.split("\n").map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const currentEmpty = this.items.controls.filter(r => !r.get("itemName")?.value).length;
    if (currentEmpty === 1 && this.items.length === 1) this.items.clear();
    lines.forEach(name => {
      this.items.push(this.newItemGroup());
      this.items.at(this.items.length - 1).patchValue({ itemName: name });
      this.suggestions.push([]);
    });
    this.pasteText = "";
    this.entryMode = "manual";
  }

  onCsvFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const rows = text.split("\n").map(l => l.trim()).filter(Boolean);
      const firstIsHeader = rows[0]?.toLowerCase().includes("item");
      const dataRows = firstIsHeader ? rows.slice(1) : rows;
      if (this.items.length === 1 && !this.items.at(0).get("itemName")?.value) {
        this.items.clear();
        this.suggestions = [];
      }
      for (const row of dataRows) {
        const cols = row.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
        const [itemName, description, quantityStr, unit, costPriceStr] = cols;
        if (!itemName) continue;
        const g = this.newItemGroup();
        g.patchValue({
          itemName,
          description: description || "",
          quantity: quantityStr ? Number(quantityStr) || null : null,
          unit: unit || "",
          costPrice: costPriceStr ? Number(costPriceStr) || null : null,
        });
        this.items.push(g);
        this.suggestions.push([]);
      }
      this.entryMode = "manual";
    };
    reader.readAsText(file);
  }


  changeStatus(status: SourcingStatus) {
    if (!this.quoteId) return;
    this.statusChanging = true;
    this.sourcingService.updateStatus(this.quoteId, status).pipe(takeUntil(this.destroy$)).subscribe({
      next: (q: SourcingQuoteDto) => {
        this.currentStatus = q.status;
        this.sentAt = q.sentAt;
        this.acceptedAt = q.acceptedAt;
        this.rejectedAt = q.rejectedAt;
        this.statusChanging = false;
      },
      error: () => { this.statusChanging = false; },
    });
  }

  duplicateQuote() {
    if (!this.quoteId) return;
    this.duplicating = true;
    this.sourcingService.duplicate(this.quoteId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (q: SourcingQuoteDto) => {
        this.duplicating = false;
        void this.router.navigate(["/sourcing", q.id]);
      },
      error: () => { this.duplicating = false; },
    });
  }

  revisionSnapshot(rev: SourcingQuoteRevisionDto): boolean {
    return rev.snapshot != null;
  }

  revisionItemCount(rev: SourcingQuoteRevisionDto): number {
    const snap = rev.snapshot as { items?: unknown[] };
    return snap?.items?.length ?? 0;
  }

  revisionTotal(rev: SourcingQuoteRevisionDto): number {
    const snap = rev.snapshot as { items?: { sellingPrice?: number; quantity?: number }[] };
    return (snap?.items ?? []).reduce((sum, item) => {
      return sum + (item.sellingPrice ?? 0) * (item.quantity ?? 1);
    }, 0);
  }

  buildPayload(status: SourcingStatus) {
    const v = this.form.value as {
      title: string; customerName: string; customerCompany: string; customerAddress: string;
      customerPhone: string; customerEmail: string; customerGst: string; validUntil: string;
      notes: string; globalMarkupPct: number;
      items: { itemName: string; description: string; quantity: number | null; unit: string;
               costPrice: number | null; sourceType: string; sourceName: string;
               markupPct: number | null; sellingPrice: number | null }[];
    };
    const items: CreateSourcingItemRequest[] = v.items.map((item, i) => ({
      itemName: item.itemName,
      description: item.description || undefined,
      quantity: item.quantity ?? undefined,
      unit: item.unit || undefined,
      costPrice: item.costPrice ?? undefined,
      sourceType: item.sourceType || undefined,
      sourceName: item.sourceName || undefined,
      markupPct: item.markupPct ?? undefined,
      sellingPrice: this.calcSelling(item.costPrice, item.markupPct) || undefined,
      sortOrder: i,
    }));
    return {
      title: v.title,
      customerId: this.selectedCustomerId ?? undefined,
      customerName: v.customerName || undefined,
      customerAddress: v.customerAddress || undefined,
      customerPhone: v.customerPhone || undefined,
      customerEmail: v.customerEmail || undefined,
      customerGst: v.customerGst || undefined,
      validUntil: v.validUntil || undefined,
      notes: v.notes || undefined,
      globalMarkupPct: Number(v.globalMarkupPct) || 15,
      status,
      items,
    };
  }

  save() { this.submit("DRAFT"); }

  submit(status: SourcingStatus) {
    if (this.form.invalid) return;
    this.saving = true;
    this.error = "";
    const payload = this.buildPayload(status);
    const req$ = this.quoteId
      ? this.sourcingService.update(this.quoteId, payload)
      : this.sourcingService.create(payload);
    req$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (q: SourcingQuoteDto) => {
        this.saving = false;
        if (!this.quoteId) void this.router.navigate(["/sourcing", q.id]);
      },
      error: () => { this.error = "Failed to save quote."; this.saving = false; },
    });
  }

  downloadPdf(type: "customer" | "internal") {
    if (!this.quoteId) return;
    this.downloading = type;
    this.sourcingService.downloadPdf(this.quoteId, type).pipe(takeUntil(this.destroy$)).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = type === "customer" ? `quote-${this.quoteId}.pdf` : `cost-sheet-${this.quoteId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloading = false;
      },
      error: () => { this.downloading = false; },
    });
  }

  generateInvoice() {
    if (!this.quoteId) return;
    this.generatingInvoice = true;
    if (this.invoice) {
      this.sourcingService.downloadInvoicePdf(this.quoteId).pipe(takeUntil(this.destroy$)).subscribe({
        next: blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `INV-${this.invoice!.invoiceNumber}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
          this.generatingInvoice = false;
        },
        error: () => { this.generatingInvoice = false; },
      });
    } else {
      this.sourcingService.createInvoice(this.quoteId).pipe(takeUntil(this.destroy$)).subscribe({
        next: inv => {
          this.invoice = inv;
          this.sourcingService.downloadInvoicePdf(this.quoteId!).pipe(takeUntil(this.destroy$)).subscribe({
            next: blob => {
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `INV-${inv.invoiceNumber}.pdf`;
              a.click();
              URL.revokeObjectURL(url);
              this.generatingInvoice = false;
            },
            error: () => { this.generatingInvoice = false; },
          });
        },
        error: () => { this.generatingInvoice = false; },
      });
    }
  }
}
