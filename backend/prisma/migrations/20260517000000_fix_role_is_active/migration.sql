-- Fix: Set isActive for existing roles
UPDATE "Role" SET "isActive" = true WHERE "isActive" IS NULL OR "isActive" = false;