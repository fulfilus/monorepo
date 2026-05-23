-- Step 2: migrate FINALIZED → SENT, remove FINALIZED from enum, add columns, create revision table

-- Migrate existing FINALIZED rows
UPDATE "SourcingQuote" SET "status" = 'SENT' WHERE "status" = 'FINALIZED';

-- Recreate enum without FINALIZED
ALTER TYPE "SourcingStatus" RENAME TO "SourcingStatus_old";
CREATE TYPE "SourcingStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');
ALTER TABLE "SourcingQuote" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "SourcingQuote" ALTER COLUMN "status" TYPE "SourcingStatus" USING "status"::text::"SourcingStatus";
ALTER TABLE "SourcingQuote" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
DROP TYPE "SourcingStatus_old";

-- Add new columns
ALTER TABLE "SourcingQuote"
  ADD COLUMN IF NOT EXISTS "referenceNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "sentAt"          TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "acceptedAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectedAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "revisionNumber"  INTEGER NOT NULL DEFAULT 1;

-- Backfill referenceNumber for any existing rows
UPDATE "SourcingQuote" sq
SET "referenceNumber" = sub.ref
FROM (
  SELECT id,
    'SQ-' || TO_CHAR("createdAt", 'YYYYMM') || '-' ||
    LPAD(ROW_NUMBER() OVER (ORDER BY "createdAt")::text, 4, '0') AS ref
  FROM "SourcingQuote"
  WHERE "referenceNumber" IS NULL
) sub
WHERE sq.id = sub.id;

-- Make referenceNumber NOT NULL + unique
ALTER TABLE "SourcingQuote" ALTER COLUMN "referenceNumber" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "SourcingQuote_referenceNumber_key" ON "SourcingQuote"("referenceNumber");

-- Status index
CREATE INDEX IF NOT EXISTS "SourcingQuote_status_idx" ON "SourcingQuote"("status");

-- SourcingQuoteRevision table
CREATE TABLE IF NOT EXISTS "SourcingQuoteRevision" (
  "id"             TEXT         NOT NULL,
  "quoteId"        TEXT         NOT NULL,
  "revisionNumber" INTEGER      NOT NULL,
  "snapshot"       JSONB        NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SourcingQuoteRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SourcingQuoteRevision_quoteId_idx" ON "SourcingQuoteRevision"("quoteId");

ALTER TABLE "SourcingQuoteRevision"
  ADD CONSTRAINT "SourcingQuoteRevision_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "SourcingQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
