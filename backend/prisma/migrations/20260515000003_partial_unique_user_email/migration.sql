-- Create RolePermission table
CREATE TABLE IF NOT EXISTS "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "canCreate" BOOLEAN NOT NULL DEFAULT false,
    "canView" BOOLEAN NOT NULL DEFAULT true,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "canVerify" BOOLEAN NOT NULL DEFAULT false,
    "canApprove" BOOLEAN NOT NULL DEFAULT false,
    "canExport" BOOLEAN NOT NULL DEFAULT false,
    "canPrint" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- Add foreign key
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RolePermission_roleId_fkey') THEN
        ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Create unique index for RolePermission
CREATE UNIQUE INDEX IF NOT EXISTS "RolePermission_roleId_module_key" ON "RolePermission"("roleId", "module");

-- Add deletedAt to User if missing
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Handle User Email Uniqueness (Partial Index)
-- Drop existing unique index
DROP INDEX IF EXISTS "User_email_key";

-- Create partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_active_key" ON "User"("email") WHERE "deletedAt" IS NULL;
