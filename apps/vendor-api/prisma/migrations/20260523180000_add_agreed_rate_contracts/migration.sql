CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

CREATE TABLE "AgreedRateContract" (
    "id"           TEXT NOT NULL,
    "vendorId"     TEXT NOT NULL,
    "itemName"     TEXT NOT NULL,
    "unitPrice"    DOUBLE PRECISION NOT NULL,
    "unit"         TEXT,
    "minQty"       DOUBLE PRECISION,
    "tolerancePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "validFrom"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil"   TIMESTAMP(3),
    "notes"        TEXT,
    "status"       "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgreedRateContract_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgreedRateContract_vendorId_idx"  ON "AgreedRateContract"("vendorId");
CREATE INDEX "AgreedRateContract_itemName_idx"  ON "AgreedRateContract"("itemName");
CREATE INDEX "AgreedRateContract_status_idx"    ON "AgreedRateContract"("status");

ALTER TABLE "AgreedRateContract"
    ADD CONSTRAINT "AgreedRateContract_vendorId_fkey"
    FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
