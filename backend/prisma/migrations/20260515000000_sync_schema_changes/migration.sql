-- ============================================================
-- Safe additive migration: add missing columns detected by
-- prisma migrate diff (schema vs production database).
-- NO DROP COLUMN statements. Uses IF NOT EXISTS guards via
-- DO $$ blocks to make this idempotent.
-- ============================================================

-- -------------------------
-- CompanySettings: multi-branch fields
-- -------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'CompanySettings' AND column_name = 'multiBranchEnabled'
  ) THEN
    ALTER TABLE "CompanySettings" ADD COLUMN "multiBranchEnabled" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'CompanySettings' AND column_name = 'defaultBranchId'
  ) THEN
    ALTER TABLE "CompanySettings" ADD COLUMN "defaultBranchId" TEXT;
  END IF;
END $$;

-- -------------------------
-- Branch: new fields
-- -------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Branch' AND column_name = 'isMain'
  ) THEN
    ALTER TABLE "Branch" ADD COLUMN "isMain" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Branch' AND column_name = 'phone'
  ) THEN
    ALTER TABLE "Branch" ADD COLUMN "phone" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Branch' AND column_name = 'email'
  ) THEN
    ALTER TABLE "Branch" ADD COLUMN "email" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Branch' AND column_name = 'address'
  ) THEN
    ALTER TABLE "Branch" ADD COLUMN "address" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Branch' AND column_name = 'deletedAt'
  ) THEN
    ALTER TABLE "Branch" ADD COLUMN "deletedAt" TIMESTAMP(3);
  END IF;
END $$;

-- -------------------------
-- Bill: audit trail + branch + currency fields
-- -------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Bill' AND column_name = 'billDate'
  ) THEN
    ALTER TABLE "Bill" ADD COLUMN "billDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Bill' AND column_name = 'branchId'
  ) THEN
    ALTER TABLE "Bill" ADD COLUMN "branchId" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Bill' AND column_name = 'currency'
  ) THEN
    ALTER TABLE "Bill" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'BDT';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Bill' AND column_name = 'exchangeRate'
  ) THEN
    ALTER TABLE "Bill" ADD COLUMN "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Bill' AND column_name = 'discountAmount'
  ) THEN
    ALTER TABLE "Bill" ADD COLUMN "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Bill' AND column_name = 'createdById'
  ) THEN
    ALTER TABLE "Bill" ADD COLUMN "createdById" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Bill' AND column_name = 'verifiedById'
  ) THEN
    ALTER TABLE "Bill" ADD COLUMN "verifiedById" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Bill' AND column_name = 'verifiedAt'
  ) THEN
    ALTER TABLE "Bill" ADD COLUMN "verifiedAt" TIMESTAMP(3);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Bill' AND column_name = 'approvedById'
  ) THEN
    ALTER TABLE "Bill" ADD COLUMN "approvedById" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Bill' AND column_name = 'approvedAt'
  ) THEN
    ALTER TABLE "Bill" ADD COLUMN "approvedAt" TIMESTAMP(3);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Bill' AND column_name = 'rejectedById'
  ) THEN
    ALTER TABLE "Bill" ADD COLUMN "rejectedById" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Bill' AND column_name = 'rejectionReason'
  ) THEN
    ALTER TABLE "Bill" ADD COLUMN "rejectionReason" TEXT;
  END IF;
END $$;

-- -------------------------
-- Branch-aware entities: branchId columns
-- -------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Invoice' AND column_name = 'branchId'
  ) THEN
    ALTER TABLE "Invoice" ADD COLUMN "branchId" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'GRN' AND column_name = 'branchId'
  ) THEN
    ALTER TABLE "GRN" ADD COLUMN "branchId" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'DN' AND column_name = 'branchId'
  ) THEN
    ALTER TABLE "DN" ADD COLUMN "branchId" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Payment' AND column_name = 'branchId'
  ) THEN
    ALTER TABLE "Payment" ADD COLUMN "branchId" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'DebitNote' AND column_name = 'branchId'
  ) THEN
    ALTER TABLE "DebitNote" ADD COLUMN "branchId" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'CreditNote' AND column_name = 'branchId'
  ) THEN
    ALTER TABLE "CreditNote" ADD COLUMN "branchId" TEXT;
  END IF;
END $$;

-- -------------------------
-- Foreign Keys (add only if not already present)
-- -------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Bill_branchId_fkey'
  ) THEN
    ALTER TABLE "Bill" ADD CONSTRAINT "Bill_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Bill_createdById_fkey'
  ) THEN
    ALTER TABLE "Bill" ADD CONSTRAINT "Bill_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Bill_verifiedById_fkey'
  ) THEN
    ALTER TABLE "Bill" ADD CONSTRAINT "Bill_verifiedById_fkey"
      FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Bill_approvedById_fkey'
  ) THEN
    ALTER TABLE "Bill" ADD CONSTRAINT "Bill_approvedById_fkey"
      FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Bill_rejectedById_fkey'
  ) THEN
    ALTER TABLE "Bill" ADD CONSTRAINT "Bill_rejectedById_fkey"
      FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Invoice_branchId_fkey'
  ) THEN
    ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'GRN_branchId_fkey'
  ) THEN
    ALTER TABLE "GRN" ADD CONSTRAINT "GRN_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'DN_branchId_fkey'
  ) THEN
    ALTER TABLE "DN" ADD CONSTRAINT "DN_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Payment_branchId_fkey'
  ) THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'DebitNote_branchId_fkey'
  ) THEN
    ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CreditNote_branchId_fkey'
  ) THEN
    ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
