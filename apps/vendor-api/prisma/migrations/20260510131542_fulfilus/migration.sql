-- CreateEnum
CREATE TYPE "VendorCategory" AS ENUM ('RAW_MATERIALS', 'ELECTRICAL_ELECTRONICS', 'MECHANICAL_TOOLS', 'FASTENERS_HARDWARE', 'CHEMICALS_LUBRICANTS', 'SAFETY_PPE', 'HYDRAULICS_PNEUMATICS', 'PLASTICS_RUBBER', 'PACKAGING_MATERIALS', 'CONSTRUCTION_MATERIALS', 'BEARINGS_TRANSMISSION', 'INSTRUMENTATION', 'GENERAL_INDUSTRIAL');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('CONTACTED', 'NOT_CONTACTED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('QR_CODE', 'PHONE_NUMBER', 'BANK_ACCOUNT');

-- CreateEnum
CREATE TYPE "EnrichmentSource" AS ENUM ('GOOGLE_MAPS', 'JUSTDIAL', 'INDIAMART', 'OCR', 'LLM', 'MANUAL');

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "shopDetails" TEXT,
    "location" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "gstNumber" TEXT,
    "contactStatus" "ContactStatus" NOT NULL DEFAULT 'NOT_CONTACTED',
    "notes" TEXT,
    "categories" "VendorCategory"[],
    "shopPhotoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorPayment" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "type" "PaymentType" NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "VendorPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifscCode" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrichmentJob" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "source" "EnrichmentSource" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "confidenceScore" DOUBLE PRECISION,
    "modelId" TEXT,
    "rawPayload" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnrichmentJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "diff" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vendor_whatsappNumber_idx" ON "Vendor"("whatsappNumber");

-- CreateIndex
CREATE INDEX "Vendor_contactStatus_idx" ON "Vendor"("contactStatus");

-- CreateIndex
CREATE UNIQUE INDEX "VendorPayment_vendorId_key" ON "VendorPayment"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_vendorId_key" ON "BankAccount"("vendorId");

-- CreateIndex
CREATE INDEX "Document_vendorId_idx" ON "Document"("vendorId");

-- CreateIndex
CREATE INDEX "EnrichmentJob_vendorId_status_idx" ON "EnrichmentJob"("vendorId", "status");

-- CreateIndex
CREATE INDEX "AuditLog_vendorId_idx" ON "AuditLog"("vendorId");

-- AddForeignKey
ALTER TABLE "VendorPayment" ADD CONSTRAINT "VendorPayment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnrichmentJob" ADD CONSTRAINT "EnrichmentJob_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
