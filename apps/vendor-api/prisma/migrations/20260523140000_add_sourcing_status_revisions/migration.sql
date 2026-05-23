-- Step 1: add new enum values (must be in their own transaction before use)
ALTER TYPE "SourcingStatus" ADD VALUE IF NOT EXISTS 'SENT';
ALTER TYPE "SourcingStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED';
ALTER TYPE "SourcingStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "SourcingStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
