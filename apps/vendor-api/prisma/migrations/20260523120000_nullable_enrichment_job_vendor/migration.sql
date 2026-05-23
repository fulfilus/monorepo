-- AlterTable: make vendorId optional so enrichment jobs can be created before a vendor exists
ALTER TABLE "EnrichmentJob" ALTER COLUMN "vendorId" DROP NOT NULL;
