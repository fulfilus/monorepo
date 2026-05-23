-- CreateEnum
CREATE TYPE "ContactLogType" AS ENUM ('CALL', 'WHATSAPP', 'VISIT', 'EMAIL');

-- CreateTable
CREATE TABLE "ContactLog" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "type" "ContactLogType" NOT NULL,
    "notes" TEXT,
    "contactedBy" TEXT NOT NULL,
    "contactedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactLog_vendorId_idx" ON "ContactLog"("vendorId");

-- AddForeignKey
ALTER TABLE "ContactLog" ADD CONSTRAINT "ContactLog_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
