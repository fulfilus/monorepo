ALTER TABLE "ProcurementItem" ADD COLUMN "barcode" TEXT;
CREATE INDEX "ProcurementItem_barcode_idx" ON "ProcurementItem"("barcode");
