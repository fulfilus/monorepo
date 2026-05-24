# Feature Roadmap

Priority tiers: **P0** (core workflow), **P1** (high value), **P2** (nice to have).
Status: `[ ]` todo · `[~]` in progress · `[x]` done

---

## P0 — Security and Access Control

- [x] **JWT authentication** — access + refresh token rotation, httpOnly cookie, global guard
- [x] **TOTP two-factor authentication** — setup, enable, disable, confirm at login
- [x] **Account lockout** — 5 failed attempts → 15-minute lock; remaining-attempts feedback
- [x] **Rate limiting** — global 200/min; auth endpoints 10/min per IP
- [x] **Roles (ADMIN / STAFF)** — `@Roles()` decorator + `RolesGuard`; admin-only user management
- [x] **User management** — create, role change, unlock, password reset, delete; admin-only
- [x] **Invite-only system** — registration endpoint removed; users provisioned by admins
- [x] **Angular auth layer** — interceptor, guards, login page, admin guard on `/admin/*`
- [ ] **Role-based field visibility** — hide destructive actions (delete, merge, bulk import) from STAFF users in the frontend
- [ ] **Audit log actor** — `AuditLog.changedBy` currently stores username string; consider linking to `userId` FK for traceability

---

## P0 — Core Workflow Gaps

- [x] **Smart sourcing and margin quotation builder** — add items manually / paste / CSV; lookup vendor prices from price lists and historical bids; apply global markup % with per-item override; generate customer-facing PDF and internal cost sheet PDF
- [x] **WhatsApp RFQ blast** — when a procurement round is OPEN, send the item list to all invited vendors via WhatsApp Business API; vendors reply with prices; message log stored against the procurement round
- [x] **OCR price list import** — upload a photo or PDF of a vendor's printed price list; extract item names and prices using OCR + LLM; pre-fill the bid entry form in the procurement round
- [x] **PDF purchase orders** — proper PO PDF format (PO number, Fulfilus header, delivery address, payment terms, line items, signature line, terms and conditions); generated at award time alongside PO quote
- [x] **Recurring procurement rounds** — save a round as a template (item list + vendor list); one-click creates the next cycle pre-populated with the same vendors and items

---

## P1 — Intelligence and Analytics

- [x] **Price history per item** — across procurement rounds, track each vendor's bid price per item over time; show a trend sparkline in the comparison matrix; surface price increases automatically
- [x] **Vendor performance scorecard** — composite score per vendor: price competitiveness (rank vs. average across rounds), bid response rate (bids submitted / rounds invited), delivery reliability (manually logged); shown as a badge in vendor list
- [x] **Spend analytics dashboard** — total spend by vendor, by category, by month; chart of award splits over time; which vendors are being awarded vs. only compared
- [x] **Agreed rate contracts** — lock in a negotiated rate per item per vendor with a validity date and tolerance %; if a bid comes in above contracted rate, flag it in the comparison matrix

---

## P2 — Data Operations

- [x] **Bulk vendor CSV import** — upload a spreadsheet (name, phone, location, category) and onboard multiple vendors at once; show import summary with success/error rows
- [x] **Vendor merge** — when two duplicate vendors are detected, merge their quotations, contact logs, procurement bids, and documents into one record
- [x] **Accounting export** — export awarded POs as a CSV or JSON compatible with Tally / Zoho Books / QuickBooks; include vendor GST, line items, totals
- [x] **Barcode / QR item lookup** — scan a product barcode in the procurement item entry form; auto-fill item name, description, and standard unit from a product database or previous rounds

---

## Completed (cross-reference CHANGELOG.md)

- [x] Customer directory — persistent records linked to sourcing quotes; list, create, edit with quote history
- [x] Sourcing quote lifecycle — DRAFT→SENT→ACCEPTED/REJECTED/EXPIRED; revision snapshots; reference numbers; auto-expire; duplicate
- [x] Quote send tracking — delivery method, sent-by, notes per send; send history panel
- [x] Inbound WhatsApp order processing — customer routing from webhook; Claude text + Vision item extraction; auto-price + DRAFT quote
- [x] Quote validation service — score 0–100 with per-item and quote-level flags
- [x] Staff review inbox (`/inbox`) — approve/reject inbound quotes with reviewer name and notes
- [x] Vendor onboarding with Google Maps auto-fill, voice input
- [x] AI enrichment with confidence scoring (Google Maps → LLM)
- [x] IndiaMART URL enrichment
- [x] JustDial URL enrichment
- [x] Async enrichment job pipeline with frontend polling
- [x] Vendor admin list, edit, bulk status, CSV export
- [x] Duplicate vendor detection (409 conflict + frontend warning)
- [x] Vendor contact log timeline (call, WhatsApp, visit, email)
- [x] Document upload and management per vendor
- [x] Quotation management (RFQ, Price List, PO Quote)
- [x] Quotation templates (save/load)
- [x] AI line item suggestion per vendor
- [x] PDF quotation generation and download
- [x] Multi-vendor procurement comparison rounds
- [x] Procurement comparison matrix (lowest price highlighted)
- [x] Award SPLIT / SINGLE with PO quote generation
- [x] Delivery capability tracking per vendor
- [x] Amazon Business as manual procurement vendor
- [x] Dashboard with KPI cards and quotation funnel
- [x] Mobile-responsive layout
