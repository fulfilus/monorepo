import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { CreateSourcingItemRequest, CustomerDto, PriceLookupResult, PriceSuggestion, SourcingQuoteDto, SourcingQuoteRevisionDto, SourcingQuoteSendDto, SourcingStatus } from "@fulfilus/shared";
import { debounceTime, Subject, takeUntil } from "rxjs";
import { CustomerService } from "../../customer/services/customer.service";
import { SourcingService } from "../services/sourcing.service";

type EntryMode = "manual" | "paste" | "csv";

@Component({
  selector: "app-sourcing-form",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, FormsModule],
  styles: [`
    .sourcing-page { max-width: 1100px; margin: 0 auto; padding: 24px 16px; font-size: 14px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .page-header h2 { margin: 0; font-size: 20px; }
    .back-link { font-size: 13px; color: #6b7280; text-decoration: none; display: block; margin-bottom: 4px; }
    .back-link:hover { color: #111; }
    section { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 16px; }
    section h3 { margin: 0 0 16px; font-size: 15px; color: #111; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 600px) { .form-grid { grid-template-columns: 1fr; } }
    label { display: block; font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 4px; }
    input, textarea, select { width: 100%; padding: 7px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; box-sizing: border-box; }
    input:focus, textarea:focus, select:focus { outline: none; border-color: #3b82f6; }
    .mode-tabs { display: flex; gap: 0; margin-bottom: 16px; border: 1px solid #d1d5db; border-radius: 6px; overflow: hidden; width: fit-content; }
    .mode-tab { padding: 7px 16px; font-size: 13px; background: #f9fafb; border: none; cursor: pointer; }
    .mode-tab.active { background: #1d4ed8; color: #fff; font-weight: 600; }
    .paste-area { width: 100%; font-family: monospace; font-size: 12px; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; resize: vertical; box-sizing: border-box; }
    .paste-hint { font-size: 11px; color: #6b7280; margin-top: 4px; }
    .btn { padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; }
    .btn-primary { background: #1d4ed8; color: #fff; }
    .btn-primary:hover { background: #1e40af; }
    .btn-primary:disabled { opacity: 0.5; cursor: default; }
    .btn-success { background: #16a34a; color: #fff; }
    .btn-success:hover { background: #15803d; }
    .btn-outline { background: #fff; border: 1px solid #d1d5db; color: #374151; }
    .btn-outline:hover { background: #f3f4f6; }
    .btn-danger { background: none; border: none; color: #dc2626; cursor: pointer; font-size: 15px; padding: 2px 6px; }
    .items-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .items-table th { background: #f3f4f6; padding: 8px 6px; text-align: left; font-size: 11px; color: #6b7280; white-space: nowrap; }
    .items-table td { padding: 4px 6px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
    .items-table input { padding: 4px 6px; font-size: 12px; }
    .selling-price { font-weight: 700; color: #1d4ed8; }
    .cost-price { color: #374151; }
    .source-badge { font-size: 10px; padding: 2px 6px; border-radius: 10px; font-weight: 600; }
    .source-badge.price_list { background: #dcfce7; color: #15803d; }
    .source-badge.procurement_bid { background: #dbeafe; color: #1d4ed8; }
    .suggestions-panel { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; margin-top: 6px; }
    .suggestion-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
    .suggestion-row:last-child { border-bottom: none; }
    .btn-use { font-size: 11px; padding: 3px 8px; background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; border-radius: 4px; cursor: pointer; }
    .btn-use:hover { background: #dbeafe; }
    .markup-override { width: 60px !important; }
    .global-markup { display: flex; align-items: center; gap: 10px; }
    .global-markup input { width: 80px; }
    .actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 8px; }
    .pdf-section { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .error-msg { color: #dc2626; font-size: 12px; margin-top: 6px; }
    .lookup-btn { font-size: 11px; padding: 3px 8px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; white-space: nowrap; }
    .lookup-btn:hover { background: #e5e7eb; }
    .lookup-btn:disabled { opacity: 0.5; cursor: default; }
    .ocr-note { font-size: 11px; color: #9ca3af; }
  `],
  template: `
    <div class="sourcing-page">
      <div class="page-header">
        <div>
          <a routerLink="/sourcing" class="back-link">← Sourcing Quotes</a>
          <h2>{{ quoteId ? 'Edit' : 'New' }} Sourcing Quote</h2>
        </div>
        <div *ngIf="quoteId" class="pdf-section">
          <button class="btn btn-outline" (click)="downloadPdf('customer')" [disabled]="downloading">
            {{ downloading === 'customer' ? 'Generating...' : 'Customer PDF' }}
          </button>
          <button class="btn btn-outline" (click)="downloadPdf('internal')" [disabled]="downloading">
            {{ downloading === 'internal' ? 'Generating...' : 'Internal PDF' }}
          </button>
        </div>
      </div>

      <form [formGroup]="form" (ngSubmit)="save()">

        <!-- Quote meta -->
        <section>
          <h3>Quote Details</h3>
          <div class="form-grid">
            <label>Title *
              <input formControlName="title" placeholder="e.g. Office Supplies — June 2026" />
            </label>
            <label>Valid Until
              <input formControlName="validUntil" type="date" />
            </label>
          </div>
          <div style="margin-top:12px;">
            <label>Notes
              <textarea formControlName="notes" rows="2" placeholder="Internal notes or special instructions"></textarea>
            </label>
          </div>
        </section>

        <!-- Customer info -->
        <section>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <h3 style="margin:0;">Customer Information</h3>
            <a routerLink="/customers/new" target="_blank" style="font-size:12px; color:#1d4ed8; text-decoration:none;">+ New Customer</a>
          </div>

          <!-- Customer search -->
          <div style="position:relative; margin-bottom:14px;">
            <label style="margin-bottom:4px;">Search existing customer
              <input [(ngModel)]="customerSearch" [ngModelOptions]="{standalone:true}"
                     (ngModelChange)="onCustomerSearch($event)"
                     placeholder="Type name, company or phone..."
                     style="width:100%; padding:7px 10px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; box-sizing:border-box;" />
            </label>
            <div *ngIf="customerResults.length" style="position:absolute; top:100%; left:0; right:0; background:#fff; border:1px solid #d1d5db; border-radius:6px; z-index:50; box-shadow:0 4px 12px rgba(0,0,0,0.1); max-height:200px; overflow-y:auto;">
              <div *ngFor="let c of customerResults"
                   (click)="selectCustomer(c)"
                   style="padding:10px 12px; cursor:pointer; border-bottom:1px solid #f3f4f6; font-size:13px;">
                <strong>{{ c.name }}</strong>
                <span *ngIf="c.companyName" style="color:#6b7280; margin-left:6px;">{{ c.companyName }}</span>
                <span *ngIf="c.phone" style="color:#9ca3af; margin-left:6px; font-size:11px;">{{ c.phone }}</span>
              </div>
            </div>
          </div>

          <div *ngIf="selectedCustomerName" style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:8px 12px; margin-bottom:12px; font-size:12px; display:flex; justify-content:space-between; align-items:center;">
            <span>Linked to: <strong>{{ selectedCustomerName }}</strong></span>
            <button type="button" (click)="clearCustomer()" style="background:none; border:none; color:#dc2626; cursor:pointer; font-size:12px;">Unlink</button>
          </div>

          <div class="form-grid">
            <label>Name
              <input formControlName="customerName" placeholder="Rajesh Kumar" />
            </label>
            <label>Company
              <input formControlName="customerCompany" placeholder="Acme Corp" />
            </label>
            <label>Phone / WhatsApp
              <input formControlName="customerPhone" placeholder="+91 98765 43210" />
            </label>
            <label>Email
              <input formControlName="customerEmail" type="email" placeholder="buyer@company.com" />
            </label>
            <label>GST Number
              <input formControlName="customerGst" placeholder="27AABCU9603R1ZX" />
            </label>
            <label>Address
              <input formControlName="customerAddress" placeholder="123 Main Street, City" />
            </label>
          </div>
        </section>

        <!-- Markup -->
        <section>
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div>
              <h3 style="margin:0 0 4px;">Global Markup</h3>
              <div style="font-size:12px; color:#6b7280;">Applied to all items unless overridden per-row</div>
            </div>
            <div class="global-markup">
              <label style="margin:0;">Markup %
                <input formControlName="globalMarkupPct" type="number" min="0" max="500" (change)="recalcAll()" />
              </label>
              <button type="button" class="btn btn-outline" (click)="lookupAll()" [disabled]="looking">
                {{ looking ? 'Looking up...' : 'Lookup All Prices' }}
              </button>
            </div>
          </div>
        </section>

        <!-- Item entry -->
        <section>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
            <h3 style="margin:0;">Items</h3>
            <div style="display:flex; gap:8px; align-items:center;">
              <div class="mode-tabs">
                <button type="button" class="mode-tab" [class.active]="entryMode==='manual'" (click)="entryMode='manual'">Manual</button>
                <button type="button" class="mode-tab" [class.active]="entryMode==='paste'" (click)="entryMode='paste'">Paste</button>
                <button type="button" class="mode-tab" [class.active]="entryMode==='csv'" (click)="entryMode='csv'">CSV</button>
              </div>
              <button type="button" class="btn btn-success" (click)="addRow()" *ngIf="entryMode==='manual'" style="padding:6px 12px; font-size:13px;">+ Row</button>
            </div>
          </div>

          <!-- Paste mode -->
          <div *ngIf="entryMode==='paste'" style="margin-bottom:14px;">
            <textarea class="paste-area" rows="6" [(ngModel)]="pasteText" [ngModelOptions]="{standalone:true}"
                      placeholder="Paste item names, one per line:&#10;Rice 25kg&#10;Cooking Oil 5L&#10;Sugar 1kg"></textarea>
            <div class="paste-hint">One item name per line. Press "Import" to add them to the table.</div>
            <button type="button" class="btn btn-primary" style="margin-top:8px;" (click)="importPaste()">Import Items</button>
          </div>

          <!-- CSV mode -->
          <div *ngIf="entryMode==='csv'" style="margin-bottom:14px;">
            <label style="display:block; font-size:13px;">Upload CSV file
              <input type="file" accept=".csv,.txt" (change)="onCsvFile($event)" style="margin-top:6px;" />
            </label>
            <div class="paste-hint">CSV format: itemName, description, quantity, unit, costPrice (columns after itemName are optional)</div>
          </div>

          <!-- Items table -->
          <div style="overflow-x:auto;">
            <table class="items-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th style="min-width:160px;">Item Name *</th>
                  <th style="min-width:110px;">Description</th>
                  <th style="width:60px;">Qty</th>
                  <th style="width:55px;">Unit</th>
                  <th style="width:100px;">Cost Price (₹)</th>
                  <th style="width:130px;">Source</th>
                  <th style="width:65px;">Mkp %</th>
                  <th style="width:110px;">Selling Price (₹)</th>
                  <th style="width:80px;">Lookup</th>
                  <th></th>
                </tr>
              </thead>
              <tbody formArrayName="items">
                <ng-container *ngFor="let row of items.controls; let i = index" [formGroupName]="i">
                  <tr>
                    <td style="color:#9ca3af; text-align:center;">{{ i + 1 }}</td>
                    <td><input formControlName="itemName" placeholder="e.g. Rice 25kg" /></td>
                    <td><input formControlName="description" placeholder="optional" /></td>
                    <td><input formControlName="quantity" type="number" min="0" style="text-align:right;" /></td>
                    <td><input formControlName="unit" placeholder="kg" /></td>
                    <td>
                      <input formControlName="costPrice" type="number" min="0" step="0.01" style="text-align:right;"
                             class="cost-price" (change)="recalcRow(i)" placeholder="0.00" />
                    </td>
                    <td style="font-size:11px; color:#6b7280;">
                      <div>{{ row.get('sourceName')?.value || '—' }}</div>
                      <div *ngIf="row.get('sourceType')?.value" style="color:#9ca3af;">{{ row.get('sourceType')?.value }}</div>
                    </td>
                    <td>
                      <input formControlName="markupPct" type="number" min="0" max="500" class="markup-override"
                             (change)="recalcRow(i)" placeholder="{{ form.get('globalMarkupPct')?.value }}" />
                    </td>
                    <td>
                      <span class="selling-price">
                        {{ calcSelling(row.get('costPrice')?.value, row.get('markupPct')?.value) | number:'1.2-2' }}
                      </span>
                    </td>
                    <td>
                      <button type="button" class="lookup-btn" (click)="lookupRow(i)"
                              [disabled]="!row.get('itemName')?.value || looking">
                        {{ looking === i ? '...' : 'Lookup' }}
                      </button>
                    </td>
                    <td>
                      <button type="button" class="btn-danger" (click)="removeRow(i)" [disabled]="items.length === 1">✕</button>
                    </td>
                  </tr>
                  <!-- Suggestions row -->
                  <tr *ngIf="suggestions[i] && suggestions[i].length > 0">
                    <td colspan="11" style="padding:0 6px 8px 32px;">
                      <div class="suggestions-panel">
                        <div style="font-size:11px; color:#6b7280; margin-bottom:6px; font-weight:600;">
                          Price suggestions for "{{ row.get('itemName')?.value }}"
                        </div>
                        <div class="suggestion-row" *ngFor="let s of suggestions[i]">
                          <div>
                            <strong>{{ s.vendorName }}</strong>
                            <span class="source-badge" [ngClass]="s.source.toLowerCase()" style="margin-left:6px;">
                              {{ s.source === 'PRICE_LIST' ? 'Price List' : 'Bid' }}
                            </span>
                            <span *ngIf="s.unit" style="color:#9ca3af; margin-left:4px;">per {{ s.unit }}</span>
                          </div>
                          <div style="display:flex; align-items:center; gap:10px;">
                            <strong style="color:#111;">₹{{ s.price | number:'1.2-2' }}</strong>
                            <span style="color:#9ca3af; font-size:10px;">{{ s.date | date:'dd MMM yy' }}</span>
                            <button type="button" class="btn-use" (click)="useSuggestion(i, s)">Use</button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                  <tr *ngIf="suggestions[i] && suggestions[i].length === 0">
                    <td colspan="11" style="padding:0 6px 8px 32px; font-size:11px; color:#9ca3af;">
                      No matching prices found for "{{ row.get('itemName')?.value }}"
                    </td>
                  </tr>
                </ng-container>
              </tbody>
            </table>
          </div>

          <!-- Totals -->
          <div *ngIf="items.length > 0" style="margin-top:12px; text-align:right; font-size:13px;">
            <div style="color:#6b7280;">Total Cost: <strong style="color:#111;">{{ totalCost | currency:'INR':'symbol':'1.2-2' }}</strong></div>
            <div style="margin-top:4px;">Total Selling: <strong style="color:#1d4ed8; font-size:16px;">{{ totalSelling | currency:'INR':'symbol':'1.2-2' }}</strong></div>
            <div style="color:#15803d; margin-top:2px; font-size:12px;">
              Margin: {{ totalCost > 0 ? ((totalSelling - totalCost) / totalCost * 100 | number:'1.1-1') : 0 }}%
              ({{ totalSelling - totalCost | currency:'INR':'symbol':'1.2-2' }})
            </div>
          </div>
        </section>

        <!-- Actions -->
        <div class="actions">
          <button type="submit" class="btn btn-primary" [disabled]="form.invalid || saving || currentStatus === 'ACCEPTED'">
            {{ saving ? 'Saving...' : (quoteId ? 'Save Changes' : 'Create Quote') }}
          </button>
          <a routerLink="/sourcing" class="btn btn-outline" style="text-decoration:none;">Cancel</a>
          <div *ngIf="quoteId" style="display:flex; gap:8px; flex-wrap:wrap; margin-left:auto;">
            <!-- Status transitions -->
            <button *ngIf="currentStatus === 'DRAFT'" type="button" class="btn btn-outline"
                    (click)="openSendDialog()" [disabled]="statusChanging" style="border-color:#3b82f6; color:#1d4ed8;">
              Mark as Sent
            </button>
            <button *ngIf="currentStatus === 'SENT'" type="button" class="btn btn-outline"
                    (click)="changeStatus('ACCEPTED')" [disabled]="statusChanging" style="border-color:#16a34a; color:#15803d;">
              Mark Accepted
            </button>
            <button *ngIf="currentStatus === 'SENT'" type="button" class="btn btn-outline"
                    (click)="changeStatus('REJECTED')" [disabled]="statusChanging" style="border-color:#dc2626; color:#dc2626;">
              Mark Rejected
            </button>
            <button *ngIf="currentStatus === 'REJECTED'" type="button" class="btn btn-outline"
                    (click)="changeStatus('DRAFT')" [disabled]="statusChanging">
              Reopen as Draft
            </button>
            <!-- Duplicate -->
            <button type="button" class="btn btn-outline" (click)="duplicateQuote()" [disabled]="duplicating">
              {{ duplicating ? 'Copying...' : 'Duplicate' }}
            </button>
            <!-- PDFs -->
            <button type="button" class="btn btn-outline" (click)="downloadPdf('customer')" [disabled]="downloading">
              {{ downloading === 'customer' ? 'Generating...' : 'Customer PDF' }}
            </button>
            <button type="button" class="btn btn-outline" (click)="downloadPdf('internal')" [disabled]="downloading">
              {{ downloading === 'internal' ? 'Generating...' : 'Internal PDF' }}
            </button>
          </div>
        </div>

        <div *ngIf="error" class="error-msg">{{ error }}</div>
      </form>

      <!-- Mark as Sent dialog -->
      <div *ngIf="showSendDialog" style="position:fixed; inset:0; background:rgba(0,0,0,0.4); z-index:100; display:flex; align-items:center; justify-content:center;">
        <div style="background:#fff; border-radius:10px; padding:24px; width:420px; max-width:90vw; box-shadow:0 8px 32px rgba(0,0,0,0.15);">
          <h3 style="margin:0 0 16px; font-size:16px;">Record Quote Send</h3>
          <label style="display:block; font-size:12px; font-weight:600; margin-bottom:4px;">Delivery Method *
            <select [(ngModel)]="sendMethod" style="width:100%; padding:7px 10px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; margin-top:4px;">
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">Email</option>
              <option value="PDF_HANDOFF">PDF Hand-off</option>
            </select>
          </label>
          <label style="display:block; font-size:12px; font-weight:600; margin:12px 0 4px;">Sent By *
            <input [(ngModel)]="sendBy" placeholder="Your name" style="width:100%; padding:7px 10px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; box-sizing:border-box; margin-top:4px;" />
          </label>
          <label style="display:block; font-size:12px; font-weight:600; margin:12px 0 4px;">Notes
            <textarea [(ngModel)]="sendNotes" rows="2" placeholder="e.g. Sent to buyer's personal WhatsApp, awaiting confirmation"
                      style="width:100%; padding:7px 10px; border:1px solid #d1d5db; border-radius:6px; font-size:13px; box-sizing:border-box; resize:vertical; margin-top:4px;"></textarea>
          </label>
          <div style="display:flex; gap:8px; margin-top:16px; justify-content:flex-end;">
            <button type="button" class="btn btn-outline" (click)="showSendDialog=false">Cancel</button>
            <button type="button" class="btn btn-primary" (click)="confirmSend()" [disabled]="!sendMethod || !sendBy || statusChanging">
              {{ statusChanging ? 'Saving...' : 'Confirm Send' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Send history -->
      <div *ngIf="quoteId && sends.length" style="margin-top:16px; background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:16px;">
        <div style="font-size:13px; font-weight:600; margin-bottom:10px; color:#374151;">Send History</div>
        <div *ngFor="let s of sends" style="display:flex; align-items:flex-start; gap:12px; padding:8px 0; border-bottom:1px solid #f3f4f6; font-size:12px;">
          <span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:10px; font-size:10px; font-weight:600; white-space:nowrap;">{{ s.method }}</span>
          <div style="flex:1;">
            <div><strong>{{ s.sentBy }}</strong><span *ngIf="s.notes" style="color:#6b7280; margin-left:6px;">— {{ s.notes }}</span></div>
            <div style="color:#9ca3af; margin-top:2px;">{{ s.createdAt | date:'dd MMM yy, HH:mm' }}</div>
          </div>
        </div>
      </div>

      <!-- Status badge + revision history -->
      <div *ngIf="quoteId" style="margin-top:16px;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
          <span style="font-size:12px; color:#6b7280;">Status:</span>
          <span class="badge" [ngClass]="currentStatus?.toLowerCase()">{{ currentStatus }}</span>
          <span *ngIf="revisionNumber > 1" style="font-size:12px; color:#9ca3af;">Rev {{ revisionNumber }}</span>
          <span *ngIf="sentAt" style="font-size:12px; color:#6b7280;">Sent {{ sentAt | date:'dd MMM yy' }}</span>
          <span *ngIf="acceptedAt" style="font-size:12px; color:#15803d;">Accepted {{ acceptedAt | date:'dd MMM yy' }}</span>
          <span *ngIf="rejectedAt" style="font-size:12px; color:#dc2626;">Rejected {{ rejectedAt | date:'dd MMM yy' }}</span>
          <button *ngIf="revisions.length > 0" type="button" class="btn btn-outline" style="font-size:11px; padding:3px 10px;"
                  (click)="showRevisions = !showRevisions">
            {{ showRevisions ? 'Hide' : 'Show' }} Revision History ({{ revisions.length }})
          </button>
        </div>

        <div *ngIf="showRevisions && revisions.length" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:14px;">
          <div style="font-size:13px; font-weight:600; margin-bottom:10px; color:#374151;">Revision History</div>
          <div *ngFor="let rev of revisions" style="display:flex; align-items:center; gap:12px; padding:6px 0; border-bottom:1px solid #f3f4f6; font-size:12px;">
            <span style="color:#6b7280; min-width:60px;">Rev {{ rev.revisionNumber }}</span>
            <span style="color:#9ca3af;">{{ rev.createdAt | date:'dd MMM yy HH:mm' }}</span>
            <span *ngIf="revisionSnapshot(rev)" style="color:#374151;">
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
    this.quoteId = this.route.snapshot.paramMap.get("id");
    if (this.quoteId) this.loadQuote(this.quoteId);
    this.suggestions = [[]];
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

  loadQuote(id: string) {
    this.sourcingService.getOne(id).pipe(takeUntil(this.destroy$)).subscribe({
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
}
