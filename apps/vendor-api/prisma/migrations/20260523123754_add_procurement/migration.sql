-- CreateEnum
CREATE TYPE "ProcurementStatus" AS ENUM ('OPEN', 'COMPARING', 'AWARDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('PENDING', 'SENT', 'RECEIVED', 'DECLINED');

-- CreateTable
CREATE TABLE "ProcurementRound" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ProcurementStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementItem" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "targetPrice" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProcurementItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorBid" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "quotationId" TEXT,
    "status" "BidStatus" NOT NULL DEFAULT 'PENDING',
    "lineItemPrices" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorBid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcurementItem_roundId_idx" ON "ProcurementItem"("roundId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorBid_quotationId_key" ON "VendorBid"("quotationId");

-- CreateIndex
CREATE INDEX "VendorBid_roundId_idx" ON "VendorBid"("roundId");

-- CreateIndex
CREATE UNIQUE INDEX "VendorBid_roundId_vendorId_key" ON "VendorBid"("roundId", "vendorId");

-- AddForeignKey
ALTER TABLE "ProcurementItem" ADD CONSTRAINT "ProcurementItem_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "ProcurementRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBid" ADD CONSTRAINT "VendorBid_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "ProcurementRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBid" ADD CONSTRAINT "VendorBid_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBid" ADD CONSTRAINT "VendorBid_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
