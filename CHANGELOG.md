# Changelog

All notable changes to the Fulfilus monorepo are documented here.
Format: `## [version] YYYY-MM-DD` with sections Added / Changed / Fixed / Removed.

---

## [Unreleased]

> Changes merged into `main` but not yet tagged as a release.

### Added
- JWT authentication system — access tokens (15 min, Bearer) + httpOnly cookie refresh tokens (7 days, DB-stored with rotation); `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/change-password`
- TOTP two-factor authentication — `POST /auth/2fa/setup` generates secret + QR code; `POST /auth/2fa/enable` verifies and activates; `POST /auth/2fa/disable` deactivates; `POST /auth/2fa/confirm` completes login flow
- Account lockout — 5 consecutive failed logins trigger a 15-minute lockout tracked in DB (`failedLoginAttempts`, `lockedUntil`); remaining-attempts feedback on each failure
- Rate limiting — global 200 req/min via `@fastify/rate-limit`; auth credential endpoints throttled to 10 req/min per IP
- `@fastify/helmet` — HTTP security headers with CSP disabled for Angular inline scripts
- `GET /health` — public liveness endpoint; pings DB with `SELECT 1`; returns 503 on DB failure
- Expired token cleanup cron — daily midnight job purges expired `RefreshToken` rows; logged with delete count
- Auth event logging — structured log lines for `[auth:login]`, `[auth:login:fail]`, `[auth:lockout]`, `[auth:logout]`
- Roles system — `@Roles()` decorator + `RolesGuard` (per-controller, not global); `UserRole` enum: ADMIN / STAFF
- User management module — `GET/POST /users`, `PATCH /users/:id/role`, `POST /users/:id/unlock`, `POST /users/:id/reset-password`, `DELETE /users/:id`; admin-only; no self-delete
- Seed admin user — username `admin`, role `ADMIN`; password meets 15-char complexity policy
- Angular auth layer — `AuthService` (signal-based, token in `sessionStorage`), `authInterceptor` (adds Bearer, retries with refresh on 401), `authGuard`, `adminGuard`
- Login page (`/login`) — two-step form: credentials then optional TOTP code; redirects to `/admin` on success
- Logged-in user in navbar — username and role badge (blue ADMIN / grey STAFF); "Users" nav link visible to admins
- User management page (`/admin/users`) — table with role toggle, unlock, inline password reset, delete with confirm

### Changed
- Removed public registration endpoint — system is invite-only; users created by admins via `POST /users`
- All audit log `changedBy` fields now use JWT username from request context instead of hardcoded `"system"` / `"admin"`

### Fixed
- PDFKit constructor error — changed all three PDF services to `import PDFDocument from "pdfkit"` (direct default import with `allowSyntheticDefaultImports`); eliminates tsc error
- Upgraded Angular to 21, all NestJS packages to 11.1.23, Prisma to 6.19.3, Fastify to 5.8.5; all `@fastify/*` plugins updated to match Fastify 5 peer requirements

- Agreed rate contracts module — `AgreedRateContract` model; `GET/POST /contracts`, `PUT/DELETE /contracts/:id`; filter by vendor, item, status; validity window with ACTIVE/EXPIRED/CANCELLED status; HSN code and GST rate per contract; frontend at `/contracts` with inline create form and cancel/delete actions
- GST per-item handling — `hsnCode` and `gstRate` fields on `QuotationLineItem`, `ProcurementItem`, `SourcingQuoteItem`, `AgreedRateContract`; per-row GST breakdown (subtotal, GST amount, total incl. GST) in quotation form; grand totals row showing Subtotal / Total GST / Grand Total
- HSN code lookup endpoint — `GET /quotations/hsn-lookup?code=` resolves HSN code to applicable GST rate using 8→6→4 digit prefix matching against a static HSN→rate map; auto-fills GST % in quotation form on HSN blur
- GST utility (`common/gst.util.ts`) — `gstRateForHsn()`, `gstBreakdown()` (CGST + SGST split for intra-state), `GST_SLABS` constant; used by accounting export and hsn-lookup endpoint
- Accounting export — `GET /quotations/accounting-export?from=&to=` streams a CSV with Date, Reference, Voucher Type, Party, GST Number, Item, HSN Code, Description, Qty, Unit, Rate, Amount, GST%, CGST, SGST, Total; date range picker and download button in admin dashboard
- Barcode/QR scanning in procurement form — camera-based scanning using native BarcodeDetector API with `requestAnimationFrame` scan loop; graceful fallback to manual text entry when API unavailable; `GET /procurement/barcode-lookup?barcode=` matches against past `ProcurementItem` and `QuotationLineItem` records and auto-fills item name, description, unit, HSN, GST rate
- Procurement templates — save round items as reusable template; `GET/POST /procurement/templates`, `DELETE /procurement/templates/:id`, `POST /procurement/templates/:id/use`; `ProcurementRoundTemplate` model with items as JSON column
- Vendor scorecard and spend analytics — `GET /dashboard/spend` aggregates spend by category, vendor, and time period; vendor scorecard view in procurement detail
- Vendor merge — `POST /vendors/merge` merges a secondary vendor record into a primary, re-linking related records; duplicate detection via `GET /vendors/merge-candidates`
- Vendor bulk import — `POST /vendors/bulk-import` accepts CSV payload and creates vendor records in batch
- Inbound WhatsApp order processing — incoming messages from known customers are routed to `InboundService` (text and image types); unknown numbers continue through vendor onboarding; WhatsApp webhook now distinguishes customers from vendors by phone lookup
- Item extraction from WhatsApp messages — text messages parsed by Claude (`claude-sonnet-4-6`) with structured JSON extraction; image messages downloaded from Meta CDN and processed via Claude Vision; extracts item name, quantity, unit, and notes
- Auto-quote from inbound message — extracted items auto-priced from vendor data (`SourcingService.lookup`), a `DRAFT` `SourcingQuote` is created and linked to the inbound message; staff review required before any quote is sent back
- Quote validation service — scores each auto-created inbound quote 0–100 with per-item flags: `NO_PRICE_FOUND` (error, -25), `STALE_PRICE` >90 days (warning, -10), `HIGH_VARIANCE` >30% spread (warning, -10), `SINGLE_SOURCE` (info, -3); quote-level flags: `UNRECOGNIZED_NUMBER` (error, -25), `NEW_CUSTOMER` (warning, -10); result stored in `QuoteValidation`
- Staff review queue (`GET /inbound`, `PATCH /inbound/:quoteId/review`) — lists QUOTED and FAILED messages with customer info, extracted item count, linked quote, validation score, and flags; approve or reject with reviewer name and notes
- Inbound inbox UI (`/inbox`) — Angular page showing full review queue: sender, matched customer, message preview, validation score colour-coded by severity, top flags, approve/reject form with reviewer name and notes; link to sourcing quote for editing before approval
- `InboundMessage` model — stores `waMessageId` (idempotency key), `fromNumber`, `messageType`, `rawText`, `imageMediaId`, `extractedItems` (JSON), `status`, `errorMessage`, `customerId` (FK, nullable), `quoteId` (unique FK, nullable)
- `QuoteValidation` model — `quoteId` (unique), `score`, `flags` (JSON), `status` (`PENDING_REVIEW | APPROVED | REJECTED`), `reviewedBy`, `reviewNotes`
- Customer directory (`Customer` model) — persistent customer records (name, company, phone, email, address, GST, notes); linked to sourcing quotes via FK; `/customers` list with search, `/customers/new` and `/customers/:id` edit with quote history panel
- Sourcing quote customer tracking — search/autocomplete in quote form links a customer; their details auto-fill the form; GST number stored on quote and printed on both PDFs
- Quote send log (`SourcingQuoteSend`) — every "Mark as Sent" action opens a dialog to record delivery method (WhatsApp / Email / PDF hand-off), sent-by name, and optional notes; full send history shown on the quote form
- Smart sourcing and margin quotation builder (`SourcingQuote`, `SourcingQuoteItem`) — `/sourcing` list, `/sourcing/new` form; manual/paste/CSV item entry; vendor price lookup from price lists and historical bids; per-item markup override over global markup %; customer-facing PDF and internal cost sheet PDF generation; `POST /sourcing/lookup` endpoint deduplicates vendor prices keeping lowest per vendor
- Sourcing quote lifecycle — expanded `SourcingStatus` enum (`DRAFT → SENT → ACCEPTED | REJECTED | EXPIRED`); status transition buttons with timestamp tracking (`sentAt`, `acceptedAt`, `rejectedAt`); auto-expire cron job (hourly) flips `DRAFT`/`SENT` quotes past `validUntil` to `EXPIRED`
- Sourcing quote revision history — `SourcingQuoteRevision` table snapshots full quote+items JSON on every update; revision number shown on list and internal PDF; revision history panel in form with item count and total per revision
- Sourcing quote reference number — `SQ-YYYYMM-NNNN` auto-generated on create; shown on list, customer PDF, and internal PDF header
- Sourcing quote duplicate — one-click copy creates a new `DRAFT` with all items and customer info; navigates to new quote
- WhatsApp RFQ blast (`POST /procurement/:id/blast`) — sends item list to all vendors in a round via WhatsApp Business API; auto-updates bid status to SENT; frontend shows sent/skipped/failed counts
- CHANGELOG.md and TODO.md created to track history and roadmap
- IndiaMART URL enrichment (`POST /enrich/indiamart-url`) — fetches company page, LLM-extracts vendor fields
- JustDial URL enrichment (`POST /enrich/justdial-url`) — same pipeline for JustDial business profiles
- Vendor delivery capability tracking — `VendorDelivery` table with own-delivery flag, third-party pickup (Rapido/Porter), coverage area, min order, delivery charge, charge notes
- Delivery section on vendor onboarding form and vendor edit page
- Amazon Business added as a manual vendor for procurement price benchmarking
- Multi-vendor procurement comparison — `ProcurementRound`, `ProcurementItem`, `VendorBid` models; create rounds, add vendors, enter per-item bid prices, comparison matrix (lowest price highlighted), award SPLIT or SINGLE with PO quote generation
- Procurement frontend — `/procurement` list, `/procurement/new` form, `/procurement/:id` detail with inline price entry and comparison matrix
- "Procurement", "Sourcing", "Customers", and "Inbox" nav links in vendor list admin header

---

## [0.7.0] 2026-05-23

### Added
- Quotation templates — save any quotation's line items as a named template; load templates when creating new quotations; delete templates
- Contact log timeline per vendor — log calls, WhatsApp messages, visits, emails with notes and contacted-by; delete entries; rendered as a vertical timeline in vendor edit
- Duplicate vendor detection on creation — 409 conflict with `existingId` + `existingName`; frontend shows warning with link to existing vendor
- Mobile-responsive layout — `@media (max-width: 768px)` breakpoints across admin pages, forms, tables

---

## [0.6.0] 2026-05-23

### Added
- Asynchronous enrichment pipeline — `POST /enrich/maps-url` returns `{jobId, status: "PENDING"}` immediately; frontend polls `GET /enrich/jobs/:id` every 2.5 s until COMPLETED
- Enrichment job model (`EnrichmentJob`) with status, confidenceScore, modelId, rawPayload, errorMessage
- WhatsApp number pre-fill from Google Maps phone data with Indian number normalization (`063009 82850` → `+91XXXXXXXXXX`)
- Re-enrichment button on vendor edit page — re-runs Google Maps enrichment using stored placeId or shop name

### Fixed
- Enrichment job ID mismatch — `startEnrichmentJob` and `enrichFromMapsUrl` now share a single `doEnrich(url, jobId)` private method, preventing job A being created while job B completes
- Enrichment result reconstruction from `rawPayload` now includes `whatsappNumber`

---

## [0.5.0] 2026-05-23

### Added
- Vendor enrichment confidence badge in vendor list and vendor edit (colour-coded: green ≥ 80%, amber ≥ 50%, red < 50%)
- `placeId` and `rating` stored on Vendor from Google Maps enrichment
- Quotation list pagination and search

---

## [0.4.0] 2026-05-23

### Added
- Google Maps Places autocomplete on vendor onboarding location field
- Admin vendor list with search, status filter, category filter, bulk status update, CSV export
- Vendor edit page with full field editing, photo upload, document management, audit log
- Dashboard with KPI cards (total vendors, contacted %, quotation funnel, category breakdown)
- Dashboard `groupBy` quotation status counts

### Fixed
- PDFKit ESM/CJS interop — `import * as PDFDocumentLib` with `.default ?? lib` runtime fallback
- Dashboard `groupBy` cannot run inside Prisma `$transaction` — moved outside transaction

---

## [0.3.0] 2026-05-23

### Added
- Quotation management — create RFQ, Price List, PO Quote; line items with AI suggestion; PDF generation and download
- Quotation status workflow (DRAFT → SENT → RECEIVED → ACCEPTED / REJECTED / EXPIRED)
- AI line item suggestion per vendor using Claude
- Document upload and management per vendor (photos, PDFs, files)
- WhatsApp module scaffold
- Audit logging middleware — every API request logged to `AuditLog`

---

## [0.2.0] 2026-05-10

### Added
- Vendor onboarding form with Google Maps URL auto-fill, voice input, category selection, payment details, bank account
- Vendor enrichment via Google Maps Places API — text search, nearby search, place details, LLM categorisation
- `EnrichmentJob` tracking (source, status, confidenceScore, modelId, rawPayload)
- Industrial vendor categories: RAW_MATERIALS, ELECTRICAL_ELECTRONICS, MECHANICAL_TOOLS, FASTENERS_HARDWARE, CHEMICALS_LUBRICANTS, SAFETY_PPE, HYDRAULICS_PNEUMATICS, PLASTICS_RUBBER, PACKAGING_MATERIALS, CONSTRUCTION_MATERIALS, BEARINGS_TRANSMISSION, INSTRUMENTATION, GENERAL_INDUSTRIAL
- `ContactStatus` enum (CONTACTED / NOT_CONTACTED)

### Changed
- Replaced grocery-oriented categories with industrial materials categories

---

## [0.1.0] 2026-05-10

### Added
- Fulfilus monorepo scaffold — pnpm workspaces, `apps/vendor-api` (NestJS + Fastify + Prisma), `apps/vendor-portal` (Angular 17 standalone), `packages/shared` (TypeScript DTOs and enums)
- PostgreSQL schema: Vendor, VendorPayment, BankAccount, Document, EnrichmentJob, Quotation, QuotationLineItem, AuditLog
- NestJS modules: VendorModule, EnrichmentModule, QuotationModule, WhatsappModule, DashboardModule, DocumentModule
- Angular routing, global styles, proxy config
- Shared DTOs: VendorResponseDto, CreateVendorDto, QuotationDto, EnrichmentResult, PaginatedResponse
- Claude Code configuration, domain docs, AI enrichment rules
