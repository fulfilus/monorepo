-- CreateTable
CREATE TABLE "VendorDelivery" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "deliversOwn" BOOLEAN NOT NULL DEFAULT false,
    "thirdPartyPickup" BOOLEAN NOT NULL DEFAULT false,
    "coverageArea" TEXT,
    "minOrderAmount" DOUBLE PRECISION,
    "deliveryCharge" DOUBLE PRECISION,
    "chargeNotes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VendorDelivery_vendorId_key" ON "VendorDelivery"("vendorId");

-- AddForeignKey
ALTER TABLE "VendorDelivery" ADD CONSTRAINT "VendorDelivery_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
