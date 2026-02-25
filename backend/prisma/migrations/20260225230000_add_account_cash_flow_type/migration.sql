-- Migration: Add cashFlowType to Account table
-- This field was defined in schema.prisma but was missing from migrations

ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "cashFlowType" TEXT;
