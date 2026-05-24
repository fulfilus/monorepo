# Fulfilus App Context

Quick reference for AI sessions. Read this before touching any code.

---

## What This Is

Fulfilus is a B2B procurement and vendor intelligence platform for industrial/grocery supply chains. Staff use it to onboard vendors, run procurement rounds, build customer quotations, and process inbound WhatsApp orders. Customers send purchase requests via WhatsApp; the system extracts items, auto-prices them, and queues quotes for staff review before sending.

---

## Stack

| Layer | Technology |
|---|---|
| API | NestJS 11, Fastify 5, Prisma 6.19.3, PostgreSQL |
| Frontend | Angular 21 standalone components (zoneless, no NgModules) |
| Auth | JWT (access 15 min) + httpOnly cookie refresh tokens (7 days, DB-stored); TOTP 2FA via `otplib` v13 |
| Shared | `packages/shared` — TypeScript DTOs and enums |
| Package manager | pnpm workspaces |
| AI | Anthropic SDK (`claude-sonnet-4-6`) — enrichment, extraction, line-item suggestions |
| External APIs | Google Maps Places, WhatsApp Business API v19.0, Meta Graph API v19.0 |
| Background jobs | `@nestjs/schedule` cron (auto-expire quotes, token cleanup, enrichment jobs) |

---

## Monorepo Layout

```
fulfilus/
  apps/
    vendor-api/          NestJS backend (port 3000)
      prisma/schema.prisma
      src/
        common/          PrismaModule (global), AuditMiddleware, gst.util, roles.decorator, roles.guard
        auth/            JWT login/logout/refresh, TOTP 2FA, account lockout, token cleanup cron
        health/          GET /health (public, DB liveness check)
        users/           User CRUD (admin-only): create, role change, unlock, password reset, delete
        vendor/          Vendor CRUD, enrichment trigger, merge, bulk import
        enrichment/      Google Maps, JustDial, IndiaMart, LLM extraction
        quotation/       RFQ / Price List / PO Quote with PDF; HSN lookup; accounting export
        procurement/     Procurement rounds, vendor bids, RFQ blast, templates, barcode lookup
        contracts/       Agreed rate contract CRUD
        sourcing/        Customer-facing quotation builder with margins
        customer/        Customer directory
        inbound/         WhatsApp inbound processing, validation queue
        whatsapp/        Webhook handler, message sending
        dashboard/       KPI aggregations, spend analytics
        document/        File upload/download
        contact-log/     Per-vendor interaction timeline
    vendor-portal/       Angular 21 SPA (port 4200, proxies to 3000)
      src/app/
        core/            auth.service (signals), auth.interceptor, auth.guard, admin.guard
        auth/            login.component (2-step: credentials + TOTP)
        admin/           vendor-list, vendor-edit, dashboard (with accounting export), users-list
        vendor/          vendor-form (public onboarding)
        quotation/       quotation-list, quotation-form (GST per row), quotation-detail
        procurement/     procurement-list, procurement-form (barcode scan), procurement-detail
        contracts/       contracts-list (agreed rate contracts)
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
- **QuotationLineItem** — items with AI-suggested prices; `hsnCode`, `gstRate`
- **QuotationTemplate** — saved line-item sets for reuse

### Procurement domain
- **ProcurementRound** — named round with deadline; status OPEN/CLOSED/AWARDED; `templateId` (nullable FK)
- **ProcurementRoundTemplate** — title, notes, items JSON; reusable item sets for new rounds
- **ProcurementItem** — items in a round; `barcode` (indexed), `hsnCode`, `gstRate`
- **VendorBid** — per-vendor per-item prices; status PENDING/SENT/RECEIVED/AWARDED; lineItemPrices JSON

### Contract domain
- **AgreedRateContract** — vendorId FK, itemName, unitPrice, unit, minQty, tolerancePct, hsnCode, gstRate, validFrom, validUntil, status (ACTIVE/EXPIRED/CANCELLED), notes; indexed by vendorId, itemName, status

### Customer quotation domain (sourcing)
- **Customer** — name, companyName, phone, email, address, gstNumber, notes; linked to SourcingQuotes
- **SourcingQuote** — customer-facing quote; referenceNumber `SQ-YYYYMM-NNNN`; status DRAFT/SENT/ACCEPTED/REJECTED/EXPIRED; globalMarkupPct, validUntil, sentAt, acceptedAt, rejectedAt, revisionNumber
- **SourcingQuoteItem** — itemName, quantity, unit, costPrice, sellingPrice, markupPct, sourceName, sourceType (PRICE_LIST/PROCUREMENT_BID/manual); `hsnCode`, `gstRate`
- **SourcingQuoteSend** — delivery record per send: method (WHATSAPP/EMAIL/PDF_HANDOFF), sentBy, notes
- **SourcingQuoteRevision** — full JSON snapshot of quote+items before every update

### Inbound processing
- **InboundMessage** — waMessageId (idempotency), fromNumber, messageType (text/image), rawText, imageMediaId, extractedItems JSON, status PENDING/PROCESSING/QUOTED/FAILED, customerId (nullable FK), quoteId (unique nullable FK)
- **QuoteValidation** — quoteId (unique), score 0-100, flags JSON, status PENDING_REVIEW/APPROVED/REJECTED, reviewedBy, reviewNotes

### Auth
- **User** — username, email, passwordHash, role (ADMIN/STAFF), twoFaSecret?, twoFaEnabled, failedLoginAttempts, lockedUntil?
- **RefreshToken** — token (hashed random bytes), userId FK, expiresAt; 2FA pending tokens prefixed `2fa:`

### System
- **AuditLog** — every API request logged (method, path, statusCode, durationMs, body snapshot)

---

## Key API Endpoints

### Auth (all public unless noted)
- `POST /auth/login` — returns `{accessToken}` + sets `rfsh` httpOnly cookie; or `{requiresTwoFa, tempToken}` if 2FA enabled
- `POST /auth/2fa/confirm` — exchanges tempToken + TOTP code for full tokens
- `POST /auth/refresh` — rotates refresh token; reads `rfsh` cookie
- `POST /auth/logout` — clears cookie and deletes DB token (requires auth)
- `GET /auth/me` — current user (requires auth)
- `POST /auth/change-password` — current + new password (requires auth)
- `POST /auth/2fa/setup` — generates secret + QR code (requires auth)
- `POST /auth/2fa/enable` — verifies code, activates 2FA (requires auth)
- `POST /auth/2fa/disable` — verifies code, deactivates 2FA (requires auth)
- `GET /health` — DB liveness; 200 `{status, db, timestamp}` or 503

### User Management (admin only)
- `GET /users` — list all users (no passwordHash)
- `POST /users` — create user with role
- `PATCH /users/:id/role` — change role
- `POST /users/:id/unlock` — reset failedLoginAttempts + lockedUntil
- `POST /users/:id/reset-password` — set new password, revoke all refresh tokens
- `DELETE /users/:id` — delete user

### Vendors
- `GET/POST /vendors` — list (search, status, category filter, pagination) / create
- `GET/PUT /vendors/:id` — get / update
- `POST /vendors/merge` — merge two vendor records (secondary into primary)
- `POST /vendors/bulk-import` — bulk CSV import
- `POST /enrich/maps-url` — async Google Maps enrichment → returns jobId
- `GET /enrich/jobs/:id` — poll enrichment job status
- `POST /enrich/justdial-url`, `POST /enrich/indiamart-url` — URL-based enrichment

### Procurement
- `GET/POST /procurement` — rounds list / create
- `GET /procurement/barcode-lookup?barcode=` — item detail lookup from past procurement items and quotation line items
- `GET/POST /procurement/templates` — list / save template from items
- `DELETE /procurement/templates/:id` — delete template
- `POST /procurement/templates/:id/use` — create round from template
- `GET/PUT/DELETE /procurement/:id` — round detail / update / delete
- `PUT /procurement/:id/bids` — bulk upsert vendor bids
- `POST /procurement/:id/award` — award round
- `POST /procurement/:id/blast` — WhatsApp RFQ blast to all vendors

### Agreed Rate Contracts
- `GET /contracts` — list with `vendorId`, `itemName`, `status` filters
- `POST /contracts` — create agreed rate contract
- `PUT /contracts/:id` — update rate, validity, or status
- `DELETE /contracts/:id` — delete contract

### Quotations (vendor-facing)
- `GET/POST /quotations` — list / create
- `GET /quotations/hsn-lookup?code=` — resolve HSN code to GST rate (prefix-matched: 8→6→4 digits); returns `{code, gstRate, slabs}`
- `GET /quotations/accounting-export?from=&to=` — streaming CSV download for accounting software; includes Date, Reference, Voucher Type, Party, GST Number, Item, HSN Code, Description, Qty, Unit, Rate, Amount, GST%, CGST, SGST, Total
- `GET/PUT/DELETE /quotations/:id` — detail / update / delete
- `POST /quotations/:id/pdf` — generate and download PDF

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

### Dashboard
- `GET /dashboard` — KPI aggregations (vendor counts, quotation funnel, category breakdown)
- `GET /dashboard/spend` — spend analytics by category, vendor, and time period

---

## Frontend Routes

| Path | Component | Purpose |
|---|---|---|
| `/login` | login-component | Credentials + optional TOTP step; public |
| `/` | vendor-form | Public vendor onboarding |
| `/admin` | vendor-list | Vendor management + nav hub (admin guard) |
| `/admin/users` | users-list | User management — create, role, unlock, reset password (admin guard) |
| `/admin/dashboard` | dashboard | KPI cards, accounting export date picker |
| `/admin/vendors/:id` | vendor-edit | Edit vendor, enrichment, docs, contact log |
| `/quotations` | quotation-list | RFQ/PO quotation list |
| `/quotations/new` | quotation-form | Create quotation with GST per row |
| `/quotations/:id` | quotation-detail | View quotation |
| `/quotations/:id/edit` | quotation-form | Edit quotation |
| `/procurement` | procurement-list | Procurement rounds list |
| `/procurement/new` | procurement-form | Create round with barcode scanning |
| `/procurement/:id` | procurement-detail | Round detail, bid matrix, blast |
| `/contracts` | contracts-list | Agreed rate contracts management |
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
Staff creates round (optionally from a saved template), adds vendors, blasts RFQ via WhatsApp. Items can be looked up by barcode scan or manual entry. Vendors reply with prices (staff enters bids manually). Comparison matrix highlights lowest prices. Staff awards round.

### Agreed rate contracts
After negotiating stable rates with a vendor, staff creates an `AgreedRateContract` at `/contracts`. Contract locks in itemName, unitPrice, unit, tolerancePct, HSN code, and GST rate with an optional validity window. Status auto-expires; staff can cancel manually.

### Customer quotation (sourcing)
Staff creates quote at `/sourcing/new`, searches for customer (autocomplete), adds items. System looks up prices from vendor price lists and historical procurement bids. Staff sets markup, generates PDF (customer or internal view), marks as Sent (records method + name). Status progresses DRAFT→SENT→ACCEPTED/REJECTED. Expired automatically by hourly cron.

### GST/HSN accounting
Each quotation line item, procurement item, and sourcing item carries `hsnCode` and `gstRate`. Staff enters the HSN code; `GET /quotations/hsn-lookup` resolves the applicable GST rate (prefix-matched from a static HSN→rate map). The quotation form shows per-row subtotal, GST amount, and total including GST. The accounting export CSV splits GST into CGST and SGST (each 50% of total GST for intra-state transactions).

### Inbound WhatsApp order
Customer sends text or image to WhatsApp number. Webhook receives message, identifies customer by phone (last 10 digits match). InboundService extracts items via Claude (text) or Claude Vision (image). Items auto-priced from vendor data. DRAFT SourcingQuote created. ValidationService scores quote 0-100 with flags. Staff reviews in `/inbox`, approves or rejects. Staff manually sends quote to customer after approval.

---

## Important Patterns

- **JWT global guard**: `JwtGuard` is registered as `APP_GUARD` in `AuthModule`. Routes opt out with `@Public()` which uses `SetMetadata(IS_PUBLIC, true)` — not `Reflect.metadata` (NestJS Reflector requires SetMetadata).
- **Per-route rate limit**: use `@RouteConfig({ rateLimit: { max: N, timeWindow: ms } })` from `@nestjs/platform-fastify` to override the global limit on individual routes (e.g. auth endpoints).
- **Roles guard**: `RolesGuard` is not global — apply it per controller with `@UseGuards(RolesGuard) @Roles('ADMIN')`. The guard reads `request.user.role` which is set by `JwtGuard`.
- **Actor in audit logs**: use `actor(req)` helper — `((req as FastifyRequest & { user?: JwtPayload }).user?.username) ?? "system"` — to capture the JWT username in audit and changedBy fields. Never hardcode "system" or "admin".
- **otplib v13 API**: `authenticator` singleton is removed. Use `new OTP({ strategy: "totp" })`. Verify with `const result = await otp.verify({ token, secret }); if (!result.valid) throw ...`.
- **Prisma LSP false positives**: LSP shows "Property X does not exist on PrismaService" after schema changes. Always use `tsc --noEmit` as the authoritative check — it reads generated types correctly.
- **NestJS static route ordering**: static routes (`/hsn-lookup`, `/barcode-lookup`, `/accounting-export`, `/templates`) must be declared before `/:id` wildcard routes in controllers. NestJS matches routes top-to-bottom; a wildcard declared first will capture all path segments as an ID.
- **Shared package build required**: after editing `packages/shared/src/*.ts`, run `pnpm --filter @fulfilus/shared build` before running `tsc --noEmit` on the backend. The backend imports from the compiled `dist/`, not the source.
- **Local DTO classes vs shared package**: `apps/vendor-api/src/quotation/dto/create-quotation.dto.ts` has its own `LineItemDto` class separate from `packages/shared`. When adding fields to the shared DTO, also add them to the local class or tsc will error.
- **Prisma enum migrations**: adding enum values requires a separate committed transaction. Split into two migration files: first `ALTER TYPE ... ADD VALUE`, then use the new values.
- **Prisma JSON column serialization**: JSON columns (e.g. `ProcurementRoundTemplate.items`) require plain objects. Class instances fail the `InputJsonValue` type check. Fix: `dto.items.map(i => ({ ...i }))` to spread to plain objects.
- **PDFKit import**: use `import PDFDocument from "pdfkit"` with `allowSyntheticDefaultImports: true` in tsconfig. The old `import *` pattern caused a tsc constructor error and has been removed from all three PDF services.
- **GST utility** (`apps/vendor-api/src/common/gst.util.ts`): `gstRateForHsn(code)` resolves an HSN code to a GST rate using 8→6→4 digit prefix matching against a static map. `gstBreakdown(amount, rate)` returns `{cgst, sgst, igst, total}` — CGST and SGST are each half the total GST for intra-state. `GST_SLABS = [0, 5, 12, 18, 28]`.
- **BarcodeDetector API**: native browser API for camera barcode/QR scanning. Not in TypeScript's standard DOM lib — declare with `declare class BarcodeDetector { ... }` in the component file. Check `typeof BarcodeDetector !== "undefined"` at runtime for graceful fallback to manual text entry. Use `requestAnimationFrame` for the scan loop (not `setInterval`) to avoid excessive CPU.
- **Angular standalone components**: every component declares its own `imports: [CommonModule, FormsModule, RouterLink, ...]`. No shared NgModule.
- **Circular module dependency**: `WhatsappModule` and `InboundModule` are mutually dependent. Resolved with `forwardRef(() => ...)` in both module `imports` arrays and `@Inject(forwardRef(...))` in `WhatsappController` constructor.
- **Global PrismaModule**: `@Global()` — inject `PrismaService` anywhere without re-importing.
- **Customer phone normalization**: strip `[\s\-().]+`, match on last 10 digits via `contains`.
- **Reference numbers**: `SQ-YYYYMM-NNNN` — `SourcingService.nextReferenceNumber()` queries last record for the current month and increments.
- **Revision snapshots**: `SourcingService.update()` always calls `saveRevision()` before overwriting — full quote+items JSON stored in `SourcingQuoteRevision`.
- **Accounting export streaming**: uses Fastify `res.raw` to write CSV rows incrementally. Frontend triggers download with `window.open(url, "_blank")`.

---

## Environment Variables

```
# Required
DATABASE_URL              PostgreSQL connection string
ANTHROPIC_API_KEY         Claude API key
JWT_SECRET                Secret for signing JWT access tokens

# Optional (features limited if absent)
GOOGLE_MAPS_SERVER_KEY    Places API key (server-side enrichment)
ALLOWED_ORIGINS           Comma-separated CORS origins (default: http://localhost:4200)
WHATSAPP_API_TOKEN        Meta Graph API Bearer token
WHATSAPP_PHONE_NUMBER_ID  WhatsApp Business phone number ID
WHATSAPP_VERIFY_TOKEN     Webhook verification token
COOKIE_SECRET             Fastify cookie signing secret (falls back to JWT_SECRET)
```
