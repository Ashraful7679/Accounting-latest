-- Add missing columns to production database
-- This migration adds the deletedAt column to LC table and referenceId to Account table

-- Add deletedAt to LC table
ALTER TABLE "LC" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;

-- Add referenceId to Account table  
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "referenceId" TEXT;