-- Add accounting control fields to CompanySettings
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "disallowFutureDates" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "lockPreviousMonths" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "approvalWorkflow" BOOLEAN NOT NULL DEFAULT false;
