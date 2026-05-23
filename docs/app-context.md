# Fulfilus App Context

Quick reference for AI sessions. Read this before touching any code.

---

## What This Is

Fulfilus is a B2B procurement and vendor intelligence platform for industrial/grocery supply chains. Staff use it to onboard vendors, run procurement rounds, build customer quotations, and process inbound WhatsApp orders. Customers send purchase requests via WhatsApp; the system extracts items, auto-prices them, and queues quotes for staff review before sending.

---

## Stack

| Layer | Technology |
|---|---|
| API | NestJS 10, Fastify, Prisma 5, PostgreSQL |
| Frontend | Angular 17 standalone components (no NgModules) |
| Shared | `packages/shared` — TypeScript DTOs and enums |
| Package manager | pnpm workspaces |
| AI | Anthropic SDK (`claude-sonnet-4-6`) — enrichment, extraction, line-item suggestions |
| External APIs | Google Maps Places, WhatsApp Business API v19.0, Meta Graph API v19.0 |
| Background jobs | `@nestjs/schedule` cron (auto-expire quotes, enrichment jobs) |

---

## Monorepo Layout

```
fulfilus/
  apps/
    vendor-api/          NestJS backend (port 3000)
      prisma/schema.prisma
      src/
        common/          PrismaModule (global), AuditMiddleware
        vendor/          Vendor CRUD, enrichment trigger
        enrichment/      Google Maps, JustDial, IndiaMart, LLM extraction
        quotation/       RFQ / Price List / PO Quote with PDF
        procurement/     Procurement rounds, vendor bids, RFQ blast
        sourcing/        Customer-facing quotation builder with margins
        customer/        Customer directory
        inbound/         WhatsApp inbound processing, validation queue
        whatsapp/        Webhook handler, message sending
        dashboard/       KPI aggregations
        document/        File upload/download
        contact-log/     Per-vendor interaction timeline
    vendor-portal/       Angular 17 SPA (port 4200, proxies to 3000)
      src/app/
        admin/           vendor-list, vendor-edit, dashboard
        vendor/          vendor-form (public onboarding)
        quotation/       quotation-list, quotation-form, quotation-detail
        procurement/     procurement-list, procurement-form, procurement-detail
        sourcing/        sourcing-list, sourcing-form (create/edit/view)
        customer/        customer-list, customer-form (includes quote history)
        inbound/         inbound-inbox (WhatsApp review queue)
  packages/
    shared/              DTOs, enums shared between API and portal
  docs/                  Guidelines and this file
```

---

## Database Models (summary)

### Vendor domain
- **Vendor** — core record; name, category, contact, address, GST, WhatsApp, enrichment metadata, placeId, rating
- **VendorDelivery** — own delivery flag, 3rd-party (Rapido/Porter), coverage, min order, charges
- **VendorPayment** — payment terms, type (cash/credit/UPI)
- **BankAccount** — bank details per vendor
- **Document** — file uploads (photos, PDFs) linked to vendor
- **EnrichmentJob** — async enrichment pipeline; status PENDING/RUNNING/COMPLETED/FAILED; stores rawPayload, confidenceScore, modelId
- **ContactLog** — interaction timeline per vendor (call, WhatsApp, visit, email)

### Quotation domain (vendor-facing RFQ)
- **Quotation** — type QUOTATION/PRICE_LIST/PO_QUOTE; status DRAFT→SENT→RECEIVED→ACCEPTED/REJECTED/EXPIRED
- **QuotationLineItem** — items with AI-suggested prices
- **QuotationTemplate** — saved line-item sets for reuse

### Procurement domain
- **ProcurementRound** — named round with deadline; status OPEN/CLOSED/AWARDED
- **ProcurementItem** — items in a round
- **VendorBid** — per-vendor per-item prices; status PENDING/SENT/RECEIVED/AWARDED; lineItemPrices JSON

### Customer quotation domain (sourcing)
- **Customer** — name, companyName, phone, email, address, gstNumber, notes; linked to SourcingQuotes
- **SourcingQuote** — customer-facing quote; referenceNumber `SQ-YYYYMM-NNNN`; status DRAFT/SENT/ACCEPTED/REJECTED/EXPIRED; globalMarkupPct, validUntil, sentAt, acceptedAt, rejectedAt, revisionNumber
- **SourcingQuoteItem** — itemName, quantity, unit, costPrice, sellingPrice, markupPct, sourceName, sourceType (PRICE_LIST/PROCUREMENT_BID/manual)
- **SourcingQuoteSend** — delivery record per send: method (WHATSAPP/EMAIL/PDF_HANDOFF), sentBy, notes
- **SourcingQuoteRevision** — full JSON snapshot of quote+items before every update

### Inbound processing
- **InboundMessage** — waMessageId (idempotency), fromNumber, messageType (text/image), rawText, imageMediaId, extractedItems JSON, status PENDING/PROCESSING/QUOTED/FAILED, customerId (nullable FK), quoteId (unique nullable FK)
- **QuoteValidation** — quoteId (unique), score 0-100, flags JSON, status PENDING_REVIEW/APPROVED/REJECTED, reviewedBy, reviewNotes

### System
- **AuditLog** — every API request logged (method, path, statusCode, durationMs, body snapshot)

---

## Key API Endpoints

### Vendors
- `GET/POST /vendors` — list (search, status, category filter, pagination) / create
- `GET/PUT /vendors/:id` — get / update
- `POST /enrich/maps-url` — async Google Maps enrichment → returns jobId
- `GET /enrich/jobs/:id` — poll enrichment job status
- `POST /enrich/justdial-url`, `POST /enrich/indiamart-url` — URL-based enrichment

### Procurement
- `GET/POST /procurement` — rounds list / create
- `GET/PUT/DELETE /procurement/:id` — round detail / update / delete
- `PUT /procurement/:id/bids` — bulk upsert vendor bids
- `POST /procurement/:id/award` — award round
- `POST /procurement/:id/blast` — WhatsApp RFQ blast to all vendors

### Sourcing (customer quotations)
- `GET/POST /sourcing` — list / create (auto-generates referenceNumber)
- `GET/PUT/DELETE /sourcing/:id` — detail / update (saves revision) / delete
- `PATCH /sourcing/:id/status` — transition status; SENT creates SourcingQuoteSend record
- `POST /sourcing/:id/duplicate` — clone as new DRAFT
- `GET /sourcing/:id/revisions` — revision history
- `GET /sourcing/:id/pdf/:type` — type: `customer` or `internal`
- `POST /sourcing/lookup` — price lookup for item names from vendor data

### Customers
- `GET/POST /customers` — list (search) / create
- `GET/PUT/DELETE /customers/:id` — detail (includes last 20 quotes) / update / delete

### Inbound
- `GET /inbound` — pending review queue (QUOTED + FAILED messages)
- `PATCH /inbound/:quoteId/review` — approve or reject with reviewer name + notes

### WhatsApp
- `GET /whatsapp/webhook` — Meta webhook verification
- `POST /whatsapp/webhook` — inbound messages; routes to InboundService (known customers) or WhatsappService (vendor onboarding)

---

## Frontend Routes

| Path | Component | Purpose |
|---|---|---|
| `/` | vendor-form | Public vendor onboarding |
| `/admin` | vendor-list | Vendor management + nav hub |
| `/admin/dashboard` | dashboard | KPI cards |
| `/admin/vendors/:id` | vendor-edit | Edit vendor, enrichment, docs, contact log |
| `/quotations` | quotation-list | RFQ/PO quotation list |
| `/quotations/new` | quotation-form | Create quotation |
| `/quotations/:id` | quotation-detail | View quotation |
| `/quotations/:id/edit` | quotation-form | Edit quotation |
| `/procurement` | procurement-list | Procurement rounds list |
| `/procurement/new` | procurement-form | Create round |
| `/procurement/:id` | procurement-detail | Round detail, bid matrix, blast |
| `/sourcing` | sourcing-list | Customer quotations list |
| `/sourcing/new` | sourcing-form | Create quote, customer autocomplete |
| `/sourcing/:id` | sourcing-form | Edit/view quote, status transitions, send dialog, revisions |
| `/customers` | customer-list | Customer directory |
| `/customers/new` | customer-form | Create customer |
| `/customers/:id` | customer-form | Edit customer + quote history |
| `/inbox` | inbound-inbox | WhatsApp review queue, approve/reject |

---

## Core Workflows

### Vendor onboarding
Staff or vendor fills `/` form. Google Maps autocomplete pre-fills fields. On submit, enrichment job runs async (Claude + Maps API). Staff reviews in `/admin`.

### Procurement round
Staff creates round, adds vendors, blasts RFQ via WhatsApp. Vendors reply with prices (staff enters bids manually). Comparison matrix highlights lowest prices. Staff awards round.

### Customer quotation (sourcing)
Staff creates quote at `/sourcing/new`, searches for customer (autocomplete), adds items. System looks up prices from vendor price lists and historical procurement bids. Staff sets markup, generates PDF (customer or internal view), marks as Sent (records method + name). Status progresses DRAFT→SENT→ACCEPTED/REJECTED. Expired automatically by hourly cron.

### Inbound WhatsApp order
Customer sends text or image to WhatsApp number. Webhook receives message, identifies customer by phone (last 10 digits match). InboundService extracts items via Claude (text) or Claude Vision (image). Items auto-priced from vendor data. DRAFT SourcingQuote created. ValidationService scores quote 0-100 with flags. Staff reviews in `/inbox`, approves or rejects. Staff manually sends quote to customer after approval.

---

## Important Patterns

- **Prisma LSP false positives**: LSP shows "Property X does not exist on PrismaService" after schema changes. Always use `tsc --noEmit` as the authoritative check — it reads generated types correctly.
- **Prisma enum migrations**: Adding enum values requires a separate committed transaction. Split into two migration files: first `ALTER TYPE ... ADD VALUE`, then use the new values.
- **PDFKit ESM/CJS interop**: `import * as PDFDocumentLib from "pdfkit"` then `const PDFDocument = (PDFDocumentLib as { default?: typeof PDFDocumentLib }).default ?? PDFDocumentLib`. Pre-existing tsc error — runtime works correctly.
- **Angular standalone components**: Every component declares its own `imports: [CommonModule, FormsModule, RouterLink, ...]`. No shared NgModule.
- **Circular module dependency**: `WhatsappModule` and `InboundModule` are mutually dependent. Resolved with `forwardRef(() => ...)` in both module `imports` arrays and `@Inject(forwardRef(...))` in `WhatsappController` constructor.
- **Global PrismaModule**: `@Global()` — inject `PrismaService` anywhere without re-importing.
- **Customer phone normalization**: Strip `[\s\-().]+`, match on last 10 digits via `contains`.
- **Reference numbers**: `SQ-YYYYMM-NNNN` — `SourcingService.nextReferenceNumber()` queries last record for the current month and increments.
- **Revision snapshots**: `SourcingService.update()` always calls `saveRevision()` before overwriting — full quote+items JSON stored in `SourcingQuoteRevision`.

---

## Environment Variables

```
DATABASE_URL              PostgreSQL connection string
ANTHROPIC_API_KEY         Claude API key
GOOGLE_MAPS_API_KEY       Places API key
WHATSAPP_API_TOKEN        Meta Graph API Bearer token
WHATSAPP_PHONE_NUMBER_ID  WhatsApp Business phone number ID
WHATSAPP_VERIFY_TOKEN     Webhook verification token (default: fulfilus-verify)
```
