-- Add missing columns to User table for auth functionality
ALTER TABLE "User" ADD COLUMN "forcePasswordReset" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;