-- Add templateId to ProcurementRound for traceability
ALTER TABLE "ProcurementRound" ADD COLUMN "templateId" TEXT;

-- Create ProcurementRoundTemplate table
CREATE TABLE "ProcurementRoundTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementRoundTemplate_pkey" PRIMARY KEY ("id")
);
