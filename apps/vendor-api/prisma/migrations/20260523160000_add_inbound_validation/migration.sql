-- Enums
CREATE TYPE "InboundStatus" AS ENUM ('PENDING', 'PROCESSING', 'QUOTED', 'FAILED');
CREATE TYPE "ValidationReviewStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- Customer: add phone index
CREATE INDEX IF NOT EXISTS "Customer_phone_idx" ON "Customer"("phone");

-- InboundMessage table
CREATE TABLE "InboundMessage" (
  "id"             TEXT         NOT NULL,
  "waMessageId"    TEXT         NOT NULL,
  "fromNumber"     TEXT         NOT NULL,
  "messageType"    TEXT         NOT NULL,
  "rawText"        TEXT,
  "imageMediaId"   TEXT,
  "extractedItems" JSONB,
  "status"         "InboundStatus" NOT NULL DEFAULT 'PENDING',
  "errorMessage"   TEXT,
  "customerId"     TEXT,
  "quoteId"        TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InboundMessage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InboundMessage_waMessageId_key"    ON "InboundMessage"("waMessageId");
CREATE UNIQUE INDEX "InboundMessage_quoteId_key"        ON "InboundMessage"("quoteId");
CREATE INDEX        "InboundMessage_fromNumber_idx"     ON "InboundMessage"("fromNumber");
CREATE INDEX        "InboundMessage_status_idx"         ON "InboundMessage"("status");

ALTER TABLE "InboundMessage"
  ADD CONSTRAINT "InboundMessage_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "InboundMessage_quoteId_fkey"
    FOREIGN KEY ("quoteId") REFERENCES "SourcingQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- QuoteValidation table
CREATE TABLE "QuoteValidation" (
  "id"          TEXT                       NOT NULL,
  "quoteId"     TEXT                       NOT NULL,
  "score"       DOUBLE PRECISION           NOT NULL,
  "flags"       JSONB                      NOT NULL,
  "status"      "ValidationReviewStatus"   NOT NULL DEFAULT 'PENDING_REVIEW',
  "reviewedBy"  TEXT,
  "reviewNotes" TEXT,
  "createdAt"   TIMESTAMP(3)               NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)               NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuoteValidation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "QuoteValidation_quoteId_key" ON "QuoteValidation"("quoteId");

ALTER TABLE "QuoteValidation"
  ADD CONSTRAINT "QuoteValidation_quoteId_fkey"
    FOREIGN KEY ("quoteId") REFERENCES "SourcingQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
