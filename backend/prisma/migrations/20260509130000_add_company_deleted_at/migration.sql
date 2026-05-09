-- Add missing deletedAt column to Company
ALTER TABLE "Company" ADD COLUMN "deletedAt" TIMESTAMP(3);