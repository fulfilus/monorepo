ALTER TABLE "QuotationLineItem" ADD COLUMN "hsnCode" TEXT;
ALTER TABLE "QuotationLineItem" ADD COLUMN "gstRate" DOUBLE PRECISION;

ALTER TABLE "ProcurementItem" ADD COLUMN "hsnCode" TEXT;
ALTER TABLE "ProcurementItem" ADD COLUMN "gstRate" DOUBLE PRECISION;

ALTER TABLE "SourcingQuoteItem" ADD COLUMN "hsnCode" TEXT;
ALTER TABLE "SourcingQuoteItem" ADD COLUMN "gstRate" DOUBLE PRECISION;

ALTER TABLE "AgreedRateContract" ADD COLUMN "hsnCode" TEXT;
ALTER TABLE "AgreedRateContract" ADD COLUMN "gstRate" DOUBLE PRECISION;
