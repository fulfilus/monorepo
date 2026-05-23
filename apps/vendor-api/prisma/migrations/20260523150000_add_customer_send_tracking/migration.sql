-- Customer directory
CREATE TABLE "Customer" (
  "id"          TEXT         NOT NULL,
  "name"        TEXT         NOT NULL,
  "companyName" TEXT,
  "phone"       TEXT,
  "email"       TEXT,
  "address"     TEXT,
  "gstNumber"   TEXT,
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- SendMethod enum
CREATE TYPE "SendMethod" AS ENUM ('WHATSAPP', 'EMAIL', 'PDF_HANDOFF');

-- Add customer FK + GST to SourcingQuote
ALTER TABLE "SourcingQuote"
  ADD COLUMN IF NOT EXISTS "customerId"   TEXT,
  ADD COLUMN IF NOT EXISTS "customerGst"  TEXT;

CREATE INDEX IF NOT EXISTS "SourcingQuote_customerId_idx" ON "SourcingQuote"("customerId");

ALTER TABLE "SourcingQuote"
  ADD CONSTRAINT "SourcingQuote_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Send log table
CREATE TABLE "SourcingQuoteSend" (
  "id"        TEXT         NOT NULL,
  "quoteId"   TEXT         NOT NULL,
  "method"    "SendMethod" NOT NULL,
  "sentBy"    TEXT         NOT NULL,
  "notes"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SourcingQuoteSend_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SourcingQuoteSend_quoteId_idx" ON "SourcingQuoteSend"("quoteId");

ALTER TABLE "SourcingQuoteSend"
  ADD CONSTRAINT "SourcingQuoteSend_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "SourcingQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
