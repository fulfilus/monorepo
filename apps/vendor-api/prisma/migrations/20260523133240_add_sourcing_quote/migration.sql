-- CreateEnum
CREATE TYPE "SourcingStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateTable
CREATE TABLE "SourcingQuote" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "customerName" TEXT,
    "customerAddress" TEXT,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "globalMarkupPct" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "status" "SourcingStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourcingQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourcingQuoteItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "costPrice" DOUBLE PRECISION,
    "sourceType" TEXT,
    "sourceName" TEXT,
    "markupPct" DOUBLE PRECISION,
    "sellingPrice" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourcingQuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourcingQuoteItem_quoteId_idx" ON "SourcingQuoteItem"("quoteId");

-- AddForeignKey
ALTER TABLE "SourcingQuoteItem" ADD CONSTRAINT "SourcingQuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "SourcingQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
