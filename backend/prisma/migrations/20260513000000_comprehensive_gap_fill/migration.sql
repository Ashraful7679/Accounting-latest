-- =====================================================================
-- Comprehensive Gap-Fill Migration
-- Adds ALL tables, columns, indexes, and unique constraints defined in
-- schema.prisma that are missing from the cumulative migration history.
-- ALL statements use IF [NOT] EXISTS for safe re-execution.
-- =====================================================================

-- =====================================================================
-- SECTION 1: NEW TABLES (CREATE TABLE IF NOT EXISTS)
-- Models that have NO CREATE TABLE in any previous migration.
-- =====================================================================

-- SystemAuditLog (lines 71-82 of schema.prisma)
CREATE TABLE IF NOT EXISTS "SystemAuditLog" (
    "id"             TEXT NOT NULL,
    "adminId"        TEXT NOT NULL,
    "action"         TEXT NOT NULL,
    "targetResource" TEXT NOT NULL,
    "targetId"       TEXT NOT NULL,
    "ipAddress"      TEXT NOT NULL,
    "details"        JSONB,
    "timestamp"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SystemAuditLog_pkey" PRIMARY KEY ("id")
);

-- DocumentSequence (lines 179-189 of schema.prisma)
CREATE TABLE IF NOT EXISTS "DocumentSequence" (
    "id"        TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type"      TEXT NOT NULL,
    "year"      INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("id")
);

-- PaymentInvoice (lines 1251-1265 of schema.prisma)
CREATE TABLE IF NOT EXISTS "PaymentInvoice" (
    "id"              TEXT NOT NULL,
    "paymentId"       TEXT NOT NULL,
    "invoiceId"       TEXT NOT NULL,
    "allocatedAmount" DOUBLE PRECISION NOT NULL,
    "deletedAt"       TIMESTAMP(3),
    CONSTRAINT "PaymentInvoice_pkey" PRIMARY KEY ("id")
);

-- SalesOrder (lines 621-659 of schema.prisma)
CREATE TABLE IF NOT EXISTS "SalesOrder" (
    "id"                   TEXT NOT NULL,
    "soNumber"             TEXT NOT NULL,
    "companyId"            TEXT NOT NULL,
    "customerId"           TEXT NOT NULL,
    "lcId"                 TEXT,
    "soDate"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDeliveryDate" TIMESTAMP(3),
    "currency"             TEXT NOT NULL DEFAULT 'BDT',
    "exchangeRate"         DOUBLE PRECISION NOT NULL DEFAULT 1,
    "totalForeign"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalBDT"             DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status"               TEXT NOT NULL DEFAULT 'DRAFT',
    "deletedAt"            TIMESTAMP(3),
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- SalesOrderLine (lines 661-674 of schema.prisma)
CREATE TABLE IF NOT EXISTS "SalesOrderLine" (
    "id"                TEXT NOT NULL,
    "salesOrderId"      TEXT NOT NULL,
    "productId"         TEXT,
    "itemDescription"   TEXT NOT NULL,
    "quantity"          DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice"         DOUBLE PRECISION NOT NULL,
    "total"             DOUBLE PRECISION NOT NULL,
    "deliveredQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "invoicedQuantity"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    CONSTRAINT "SalesOrderLine_pkey" PRIMARY KEY ("id")
);

-- GRN (lines 700-723 of schema.prisma)
CREATE TABLE IF NOT EXISTS "GRN" (
    "id"              TEXT NOT NULL,
    "grnNumber"       TEXT NOT NULL,
    "companyId"       TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "invoiceId"       TEXT,
    "receivedDate"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status"          TEXT NOT NULL DEFAULT 'RECEIVED',
    "isJournaled"     BOOLEAN NOT NULL DEFAULT false,
    "journalId"       TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GRN_pkey" PRIMARY KEY ("id")
);

-- GRNLine (lines 725-734 of schema.prisma)
CREATE TABLE IF NOT EXISTS "GRNLine" (
    "id"        TEXT NOT NULL,
    "grnId"     TEXT NOT NULL,
    "productId" TEXT,
    "quantity"  DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION,
    CONSTRAINT "GRNLine_pkey" PRIMARY KEY ("id")
);

-- DN (lines 736-759 of schema.prisma)
CREATE TABLE IF NOT EXISTS "DN" (
    "id"           TEXT NOT NULL,
    "dnNumber"     TEXT NOT NULL,
    "companyId"    TEXT NOT NULL,
    "salesOrderId" TEXT,
    "invoiceId"    TEXT,
    "shipmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status"       TEXT NOT NULL DEFAULT 'SHIPPED',
    "isJournaled"  BOOLEAN NOT NULL DEFAULT false,
    "journalId"    TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DN_pkey" PRIMARY KEY ("id")
);

-- DNLine (lines 761-769 of schema.prisma)
CREATE TABLE IF NOT EXISTS "DNLine" (
    "id"        TEXT NOT NULL,
    "dnId"      TEXT NOT NULL,
    "productId" TEXT,
    "quantity"  DOUBLE PRECISION NOT NULL,
    CONSTRAINT "DNLine_pkey" PRIMARY KEY ("id")
);

-- DebitNote (lines 1407-1463 of schema.prisma)
CREATE TABLE IF NOT EXISTS "DebitNote" (
    "id"              TEXT NOT NULL,
    "debitNoteNumber" TEXT NOT NULL,
    "companyId"       TEXT NOT NULL,
    "vendorId"        TEXT NOT NULL,
    "billId"          TEXT,
    "purchaseOrderId" TEXT,
    "debitNoteDate"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate"         TIMESTAMP(3),
    "currency"        TEXT NOT NULL DEFAULT 'BDT',
    "exchangeRate"    DOUBLE PRECISION NOT NULL DEFAULT 1,
    "subtotal"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalForeign"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalBDT"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status"          TEXT NOT NULL DEFAULT 'DRAFT',
    "reason"          TEXT,
    "notes"           TEXT,
    "returnToStock"   BOOLEAN NOT NULL DEFAULT false,
    "createdById"     TEXT,
    "approvedById"    TEXT,
    "isJournaled"     BOOLEAN NOT NULL DEFAULT false,
    "journalId"       TEXT,
    "deletedAt"       TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DebitNote_pkey" PRIMARY KEY ("id")
);

-- DebitNoteLine (lines 1465-1484 of schema.prisma)
CREATE TABLE IF NOT EXISTS "DebitNoteLine" (
    "id"          TEXT NOT NULL,
    "debitNoteId" TEXT NOT NULL,
    "productId"   TEXT,
    "description" TEXT NOT NULL,
    "quantity"    DOUBLE PRECISION NOT NULL,
    "unitPrice"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRate"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount"      DOUBLE PRECISION NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DebitNoteLine_pkey" PRIMARY KEY ("id")
);

-- CreditNote (lines 1537-1593 of schema.prisma)
CREATE TABLE IF NOT EXISTS "CreditNote" (
    "id"               TEXT NOT NULL,
    "creditNoteNumber" TEXT NOT NULL,
    "companyId"        TEXT NOT NULL,
    "customerId"       TEXT NOT NULL,
    "invoiceId"        TEXT,
    "salesOrderId"     TEXT,
    "creditNoteDate"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate"          TIMESTAMP(3),
    "currency"         TEXT NOT NULL DEFAULT 'BDT',
    "exchangeRate"     DOUBLE PRECISION NOT NULL DEFAULT 1,
    "subtotal"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalForeign"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalBDT"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status"           TEXT NOT NULL DEFAULT 'DRAFT',
    "reason"           TEXT,
    "notes"            TEXT,
    "returnToStock"    BOOLEAN NOT NULL DEFAULT false,
    "createdById"      TEXT,
    "approvedById"     TEXT,
    "isJournaled"      BOOLEAN NOT NULL DEFAULT false,
    "journalId"        TEXT,
    "deletedAt"        TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

-- CreditNoteLine (lines 1595-1614 of schema.prisma)
CREATE TABLE IF NOT EXISTS "CreditNoteLine" (
    "id"           TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "productId"    TEXT,
    "description"  TEXT NOT NULL,
    "quantity"     DOUBLE PRECISION NOT NULL,
    "unitPrice"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRate"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount"       DOUBLE PRECISION NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreditNoteLine_pkey" PRIMARY KEY ("id")
);

-- PayrollRun (lines 1490-1510 of schema.prisma)
CREATE TABLE IF NOT EXISTS "PayrollRun" (
    "id"              TEXT NOT NULL,
    "runNumber"       TEXT NOT NULL,
    "companyId"       TEXT NOT NULL,
    "period"          TEXT NOT NULL,
    "runDate"         TIMESTAMP(3) NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'DRAFT',
    "totalGross"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalNet"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- PayrollPayslip (lines 1512-1535 of schema.prisma)
CREATE TABLE IF NOT EXISTS "PayrollPayslip" (
    "id"               TEXT NOT NULL,
    "payrollRunId"     TEXT NOT NULL,
    "employeeId"       TEXT NOT NULL,
    "basicSalary"      DOUBLE PRECISION NOT NULL,
    "allowances"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtime"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossSalary"      DOUBLE PRECISION NOT NULL,
    "taxDeduction"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "advanceDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "loanDeduction"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherDeductions"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeductions"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netSalary"        DOUBLE PRECISION NOT NULL,
    "paymentMethod"    TEXT NOT NULL DEFAULT 'BANK',
    "status"           TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "PayrollPayslip_pkey" PRIMARY KEY ("id")
);

-- FixedAsset (lines 1650-1692 of schema.prisma)
CREATE TABLE IF NOT EXISTS "FixedAsset" (
    "id"                               TEXT NOT NULL,
    "companyId"                         TEXT NOT NULL,
    "assetNumber"                      TEXT NOT NULL,
    "assetName"                        TEXT NOT NULL,
    "description"                      TEXT,
    "category"                         TEXT,
    "purchaseDate"                     TIMESTAMP(3) NOT NULL,
    "purchaseValue"                    DOUBLE PRECISION NOT NULL,
    "salvageValue"                     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usefulLife"                       INTEGER NOT NULL DEFAULT 5,
    "depreciationMethod"               TEXT NOT NULL DEFAULT 'STRAIGHT_LINE',
    "depreciationRate"                 DOUBLE PRECISION,
    "depreciationAccountId"            TEXT,
    "accumulatedDepreciationAccountId" TEXT,
    "accumulatedDepreciation"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentValue"                     DOUBLE PRECISION NOT NULL,
    "lastDepreciationDate"             TIMESTAMP(3),
    "depreciationStartDate"            TIMESTAMP(3),
    "isDepreciated"                    BOOLEAN NOT NULL DEFAULT false,
    "status"                           TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdById"                      TEXT,
    "createdAt"                        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);

-- RecurringInvoice (lines 1620-1644 of schema.prisma)
CREATE TABLE IF NOT EXISTS "RecurringInvoice" (
    "id"            TEXT NOT NULL,
    "companyId"     TEXT NOT NULL,
    "customerId"    TEXT NOT NULL,
    "productId"     TEXT,
    "description"   TEXT,
    "amount"        DOUBLE PRECISION NOT NULL,
    "currency"      TEXT NOT NULL DEFAULT 'BDT',
    "taxRate"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "frequency"     TEXT NOT NULL DEFAULT 'MONTHLY',
    "paymentTerms"  INTEGER NOT NULL DEFAULT 30,
    "nextRunDate"   TIMESTAMP(3) NOT NULL,
    "lastRunDate"   TIMESTAMP(3),
    "isActive"      BOOLEAN NOT NULL DEFAULT true,
    "createdById"   TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecurringInvoice_pkey" PRIMARY KEY ("id")
);

-- =====================================================================
-- SECTION 2: MISSING COLUMNS ON EXISTING TABLES
-- For each table that already exists, add columns defined in schema
-- but missing from all migration history.
-- =====================================================================

-- LC: marginPercentage, commissionRate, LC unique constraint changed
ALTER TABLE "LC" ADD COLUMN IF NOT EXISTS "marginPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "LC" ADD COLUMN IF NOT EXISTS "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- PI: deletedAt
ALTER TABLE "PI" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- PILine: landedCostAmount, totalLandedCost, customerId, vendorId, deletedAt
ALTER TABLE "PILine" ADD COLUMN IF NOT EXISTS "landedCostAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PILine" ADD COLUMN IF NOT EXISTS "totalLandedCost" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PILine" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "PILine" ADD COLUMN IF NOT EXISTS "vendorId" TEXT;
ALTER TABLE "PILine" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Loan: deletedAt
ALTER TABLE "Loan" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Project: deletedAt
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- CostCenter: deletedAt
ALTER TABLE "CostCenter" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Customer: exchangeRate, portalEnabled
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "portalEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Vendor: exchangeRate, portalEnabled
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "portalEnabled" BOOLEAN NOT NULL DEFAULT false;

-- PurchaseOrderLine: receivedQuantity, billedQuantity, customerId, vendorId
ALTER TABLE "PurchaseOrderLine" ADD COLUMN IF NOT EXISTS "receivedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseOrderLine" ADD COLUMN IF NOT EXISTS "billedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseOrderLine" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "PurchaseOrderLine" ADD COLUMN IF NOT EXISTS "vendorId" TEXT;

-- Product: stockAmount, type
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "stockAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'Sales';

-- Invoice: salesOrderId, purchaseOrderId, otherExpenses, isProforma, originalInvoiceId, isJournaled, journalId
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "salesOrderId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "purchaseOrderId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "otherExpenses" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "isProforma" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "originalInvoiceId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "isJournaled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "journalId" TEXT;

-- InvoiceLine: taxAmount, returnQuantity, damagedQuantity
ALTER TABLE "InvoiceLine" ADD COLUMN IF NOT EXISTS "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "InvoiceLine" ADD COLUMN IF NOT EXISTS "returnQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "InvoiceLine" ADD COLUMN IF NOT EXISTS "damagedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- JournalEntry: originalJournalId
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "originalJournalId" TEXT;

-- JournalEntryLine: productId, deletedAt
ALTER TABLE "JournalEntryLine" ADD COLUMN IF NOT EXISTS "productId" TEXT;
ALTER TABLE "JournalEntryLine" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Bill: isJournaled, journalId
ALTER TABLE "Bill" ADD COLUMN IF NOT EXISTS "isJournaled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Bill" ADD COLUMN IF NOT EXISTS "journalId" TEXT;

-- BackupLog: filePath, error
ALTER TABLE "BackupLog" ADD COLUMN IF NOT EXISTS "filePath" TEXT;
ALTER TABLE "BackupLog" ADD COLUMN IF NOT EXISTS "error" TEXT;

-- Payment: customerId, vendorId
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "vendorId" TEXT;

-- PaymentPI: deletedAt
ALTER TABLE "PaymentPI" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- EmployeeExpense: approvedById
ALTER TABLE "EmployeeExpense" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;

-- ActivityLog: deletedAt
ALTER TABLE "ActivityLog" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- CompanySettings: lastUsedRate (schema replaced old columns)
ALTER TABLE "CompanySettings" ADD COLUMN IF NOT EXISTS "lastUsedRate" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- Account: currencyId
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "currencyId" TEXT;

-- User: update maxCompanies default to 5 (schema has @default(5))
ALTER TABLE "User" ALTER COLUMN "maxCompanies" SET DEFAULT 5;

-- =====================================================================
-- SECTION 3: FOREIGN KEY CONSTRAINTS (missing FK relationships)
-- Add foreign keys for new columns and new tables.
-- =====================================================================

-- SystemAuditLog foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SystemAuditLog_adminId_fkey') THEN
    ALTER TABLE "SystemAuditLog" ADD CONSTRAINT "SystemAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- DocumentSequence foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DocumentSequence_companyId_fkey') THEN
    ALTER TABLE "DocumentSequence" ADD CONSTRAINT "DocumentSequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- PaymentInvoice foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentInvoice_paymentId_fkey') THEN
    ALTER TABLE "PaymentInvoice" ADD CONSTRAINT "PaymentInvoice_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentInvoice_invoiceId_fkey') THEN
    ALTER TABLE "PaymentInvoice" ADD CONSTRAINT "PaymentInvoice_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- SalesOrder foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalesOrder_companyId_fkey') THEN
    ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalesOrder_customerId_fkey') THEN
    ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalesOrder_lcId_fkey') THEN
    ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_lcId_fkey" FOREIGN KEY ("lcId") REFERENCES "LC"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- SalesOrderLine foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalesOrderLine_salesOrderId_fkey') THEN
    ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalesOrderLine_productId_fkey') THEN
    ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- GRN foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRN_companyId_fkey') THEN
    ALTER TABLE "GRN" ADD CONSTRAINT "GRN_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRN_purchaseOrderId_fkey') THEN
    ALTER TABLE "GRN" ADD CONSTRAINT "GRN_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRN_invoiceId_fkey') THEN
    ALTER TABLE "GRN" ADD CONSTRAINT "GRN_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- GRNLine foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRNLine_grnId_fkey') THEN
    ALTER TABLE "GRNLine" ADD CONSTRAINT "GRNLine_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GRN"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRNLine_productId_fkey') THEN
    ALTER TABLE "GRNLine" ADD CONSTRAINT "GRNLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- DN foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DN_companyId_fkey') THEN
    ALTER TABLE "DN" ADD CONSTRAINT "DN_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DN_salesOrderId_fkey') THEN
    ALTER TABLE "DN" ADD CONSTRAINT "DN_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DN_invoiceId_fkey') THEN
    ALTER TABLE "DN" ADD CONSTRAINT "DN_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- DNLine foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DNLine_dnId_fkey') THEN
    ALTER TABLE "DNLine" ADD CONSTRAINT "DNLine_dnId_fkey" FOREIGN KEY ("dnId") REFERENCES "DN"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DNLine_productId_fkey') THEN
    ALTER TABLE "DNLine" ADD CONSTRAINT "DNLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- DebitNote foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DebitNote_companyId_fkey') THEN
    ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DebitNote_vendorId_fkey') THEN
    ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DebitNote_billId_fkey') THEN
    ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DebitNote_purchaseOrderId_fkey') THEN
    ALTER TABLE "DebitNote" ADD CONSTRAINT "DebitNote_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- DebitNoteLine foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DebitNoteLine_debitNoteId_fkey') THEN
    ALTER TABLE "DebitNoteLine" ADD CONSTRAINT "DebitNoteLine_debitNoteId_fkey" FOREIGN KEY ("debitNoteId") REFERENCES "DebitNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DebitNoteLine_productId_fkey') THEN
    ALTER TABLE "DebitNoteLine" ADD CONSTRAINT "DebitNoteLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreditNote foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CreditNote_companyId_fkey') THEN
    ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CreditNote_customerId_fkey') THEN
    ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CreditNote_invoiceId_fkey') THEN
    ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CreditNote_salesOrderId_fkey') THEN
    ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreditNoteLine foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CreditNoteLine_creditNoteId_fkey') THEN
    ALTER TABLE "CreditNoteLine" ADD CONSTRAINT "CreditNoteLine_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "CreditNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CreditNoteLine_productId_fkey') THEN
    ALTER TABLE "CreditNoteLine" ADD CONSTRAINT "CreditNoteLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- PayrollRun foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PayrollRun_companyId_fkey') THEN
    ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- PayrollPayslip foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PayrollPayslip_payrollRunId_fkey') THEN
    ALTER TABLE "PayrollPayslip" ADD CONSTRAINT "PayrollPayslip_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PayrollPayslip_employeeId_fkey') THEN
    ALTER TABLE "PayrollPayslip" ADD CONSTRAINT "PayrollPayslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- FixedAsset foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FixedAsset_companyId_fkey') THEN
    ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FixedAsset_depreciationAccountId_fkey') THEN
    ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_depreciationAccountId_fkey" FOREIGN KEY ("depreciationAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FixedAsset_accumulatedDepreciationAccountId_fkey') THEN
    ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_accumulatedDepreciationAccountId_fkey" FOREIGN KEY ("accumulatedDepreciationAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- RecurringInvoice: no FK constraints defined in the schema (just @@index)

-- New FK for existing columns that were added
DO $$
BEGIN
  -- Invoice.salesOrderId -> SalesOrder
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_salesOrderId_fkey') THEN
    ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  -- Invoice.purchaseOrderId -> PurchaseOrder
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_purchaseOrderId_fkey') THEN
    ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  -- PILine.customerId -> Customer
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PILine_customerId_fkey') THEN
    ALTER TABLE "PILine" ADD CONSTRAINT "PILine_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  -- PILine.vendorId -> Vendor
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PILine_vendorId_fkey') THEN
    ALTER TABLE "PILine" ADD CONSTRAINT "PILine_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  -- PurchaseOrderLine.customerId -> Customer
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrderLine_customerId_fkey') THEN
    ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  -- PurchaseOrderLine.vendorId -> Vendor
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrderLine_vendorId_fkey') THEN
    ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  -- JournalEntryLine.productId -> Product
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'JournalEntryLine_productId_fkey') THEN
    ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  -- Payment.customerId -> Customer
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_customerId_fkey') THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  -- Payment.vendorId -> Vendor
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_vendorId_fkey') THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  -- Account.currencyId -> Currency
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Account_currencyId_fkey') THEN
    ALTER TABLE "Account" ADD CONSTRAINT "Account_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  -- EmployeeExpense.approvedById -> User
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmployeeExpense_approvedById_fkey') THEN
    ALTER TABLE "EmployeeExpense" ADD CONSTRAINT "EmployeeExpense_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- =====================================================================
-- SECTION 4: UNIQUE CONSTRAINTS
-- Replace old single-column unique indexes with composite ones
-- as defined by @@unique annotations.
-- =====================================================================

-- Account: was UNIQUE(code) -> now @@unique([companyId, code])
DROP INDEX IF EXISTS "Account_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Account_companyId_code_key" ON "Account"("companyId", "code");

-- Customer: was UNIQUE(code) -> now @@unique([companyId, code])
DROP INDEX IF EXISTS "Customer_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_companyId_code_key" ON "Customer"("companyId", "code");

-- Vendor: was UNIQUE(code) -> now @@unique([companyId, code])
DROP INDEX IF EXISTS "Vendor_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Vendor_companyId_code_key" ON "Vendor"("companyId", "code");

-- LC: was UNIQUE(lcNumber) -> now @@unique([companyId, lcNumber])
DROP INDEX IF EXISTS "LC_lcNumber_key";
CREATE UNIQUE INDEX IF NOT EXISTS "LC_companyId_lcNumber_key" ON "LC"("companyId", "lcNumber");

-- PI: was UNIQUE(piNumber) -> now @@unique([companyId, piNumber])
DROP INDEX IF EXISTS "PI_piNumber_key";
CREATE UNIQUE INDEX IF NOT EXISTS "PI_companyId_piNumber_key" ON "PI"("companyId", "piNumber");

-- Loan: was UNIQUE(loanNumber) -> now @@unique([companyId, loanNumber])
DROP INDEX IF EXISTS "Loan_loanNumber_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Loan_companyId_loanNumber_key" ON "Loan"("companyId", "loanNumber");

-- PurchaseOrder: was UNIQUE(poNumber) -> now @@unique([companyId, poNumber])
DROP INDEX IF EXISTS "PurchaseOrder_poNumber_key";
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrder_companyId_poNumber_key" ON "PurchaseOrder"("companyId", "poNumber");

-- Invoice: was UNIQUE(invoiceNumber) -> now @@unique([companyId, invoiceNumber])
DROP INDEX IF EXISTS "Invoice_invoiceNumber_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_companyId_invoiceNumber_key" ON "Invoice"("companyId", "invoiceNumber");

-- JournalEntry: was UNIQUE(entryNumber) -> now @@unique([companyId, entryNumber])
DROP INDEX IF EXISTS "JournalEntry_entryNumber_key";
CREATE UNIQUE INDEX IF NOT EXISTS "JournalEntry_companyId_entryNumber_key" ON "JournalEntry"("companyId", "entryNumber");

-- Bill: was UNIQUE(billNumber) -> now @@unique([companyId, billNumber])
DROP INDEX IF EXISTS "Bill_billNumber_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Bill_companyId_billNumber_key" ON "Bill"("companyId", "billNumber");

-- Payment: was UNIQUE(paymentNumber) -> now @@unique([companyId, paymentNumber])
DROP INDEX IF EXISTS "Payment_paymentNumber_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_companyId_paymentNumber_key" ON "Payment"("companyId", "paymentNumber");

-- Employee: was UNIQUE(employeeCode) -> now @@unique([companyId, employeeCode])
DROP INDEX IF EXISTS "Employee_employeeCode_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_companyId_employeeCode_key" ON "Employee"("companyId", "employeeCode");

-- Product: @@unique([companyId, code]) with name "companyId_code" already created in 20260306232333

-- SalesOrder: @@unique([companyId, soNumber])
CREATE UNIQUE INDEX IF NOT EXISTS "SalesOrder_companyId_soNumber_key" ON "SalesOrder"("companyId", "soNumber");

-- GRN: @@unique([companyId, grnNumber])
CREATE UNIQUE INDEX IF NOT EXISTS "GRN_companyId_grnNumber_key" ON "GRN"("companyId", "grnNumber");

-- DN: @@unique([companyId, dnNumber])
CREATE UNIQUE INDEX IF NOT EXISTS "DN_companyId_dnNumber_key" ON "DN"("companyId", "dnNumber");

-- DebitNote: @@unique([companyId, debitNoteNumber])
CREATE UNIQUE INDEX IF NOT EXISTS "DebitNote_companyId_debitNoteNumber_key" ON "DebitNote"("companyId", "debitNoteNumber");

-- CreditNote: @@unique([companyId, creditNoteNumber])
CREATE UNIQUE INDEX IF NOT EXISTS "CreditNote_companyId_creditNoteNumber_key" ON "CreditNote"("companyId", "creditNoteNumber");

-- PayrollRun: @@unique([companyId, period])
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollRun_companyId_period_key" ON "PayrollRun"("companyId", "period");

-- PayrollPayslip: @@unique([payrollRunId, employeeId])
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollPayslip_payrollRunId_employeeId_key" ON "PayrollPayslip"("payrollRunId", "employeeId");

-- FixedAsset: @@unique([companyId, assetNumber])
CREATE UNIQUE INDEX IF NOT EXISTS "FixedAsset_companyId_assetNumber_key" ON "FixedAsset"("companyId", "assetNumber");

-- DocumentSequence: @@unique([companyId, type, year])
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentSequence_companyId_type_year_key" ON "DocumentSequence"("companyId", "type", "year");

-- =====================================================================
-- SECTION 5: SINGLE-COLUMN AND COMPOSITE INDEXES
-- All @@index annotations from schema.prisma not yet created.
-- =====================================================================

-- LC indexes
CREATE INDEX IF NOT EXISTS "LC_companyId_deletedAt_idx" ON "LC"("companyId", "deletedAt");

-- PI indexes
CREATE INDEX IF NOT EXISTS "PI_companyId_idx" ON "PI"("companyId");
CREATE INDEX IF NOT EXISTS "PI_companyId_deletedAt_idx" ON "PI"("companyId", "deletedAt");

-- Loan indexes
CREATE INDEX IF NOT EXISTS "Loan_companyId_deletedAt_idx" ON "Loan"("companyId", "deletedAt");

-- Account indexes
CREATE INDEX IF NOT EXISTS "Account_companyId_deletedAt_idx" ON "Account"("companyId", "deletedAt");

-- Project indexes
CREATE INDEX IF NOT EXISTS "Project_companyId_deletedAt_idx" ON "Project"("companyId", "deletedAt");

-- CostCenter indexes
CREATE INDEX IF NOT EXISTS "CostCenter_companyId_deletedAt_idx" ON "CostCenter"("companyId", "deletedAt");

-- Customer indexes
CREATE INDEX IF NOT EXISTS "Customer_companyId_deletedAt_idx" ON "Customer"("companyId", "deletedAt");

-- Vendor indexes
CREATE INDEX IF NOT EXISTS "Vendor_companyId_deletedAt_idx" ON "Vendor"("companyId", "deletedAt");

-- Product indexes
CREATE INDEX IF NOT EXISTS "Product_companyId_deletedAt_idx" ON "Product"("companyId", "deletedAt");

-- Invoice indexes
CREATE INDEX IF NOT EXISTS "Invoice_companyId_deletedAt_idx" ON "Invoice"("companyId", "deletedAt");

-- Bill indexes
CREATE INDEX IF NOT EXISTS "Bill_companyId_deletedAt_idx" ON "Bill"("companyId", "deletedAt");

-- Payment indexes
CREATE INDEX IF NOT EXISTS "Payment_companyId_deletedAt_idx" ON "Payment"("companyId", "deletedAt");

-- ActivityLog indexes
CREATE INDEX IF NOT EXISTS "ActivityLog_companyId_deletedAt_idx" ON "ActivityLog"("companyId", "deletedAt");

-- SalesOrder indexes
CREATE INDEX IF NOT EXISTS "SalesOrder_companyId_idx" ON "SalesOrder"("companyId");
CREATE INDEX IF NOT EXISTS "SalesOrder_customerId_idx" ON "SalesOrder"("customerId");
CREATE INDEX IF NOT EXISTS "SalesOrder_lcId_idx" ON "SalesOrder"("lcId");

-- GRN indexes
CREATE INDEX IF NOT EXISTS "GRN_companyId_idx" ON "GRN"("companyId");

-- DN indexes
CREATE INDEX IF NOT EXISTS "DN_companyId_idx" ON "DN"("companyId");

-- PurchaseOrder indexes (missing: @@index([companyId, deletedAt]))
CREATE INDEX IF NOT EXISTS "PurchaseOrder_companyId_deletedAt_idx" ON "PurchaseOrder"("companyId", "deletedAt");

-- DebitNote indexes
CREATE INDEX IF NOT EXISTS "DebitNote_companyId_idx" ON "DebitNote"("companyId");
CREATE INDEX IF NOT EXISTS "DebitNote_vendorId_idx" ON "DebitNote"("vendorId");
CREATE INDEX IF NOT EXISTS "DebitNote_billId_idx" ON "DebitNote"("billId");
CREATE INDEX IF NOT EXISTS "DebitNote_status_idx" ON "DebitNote"("status");

-- DebitNoteLine indexes
CREATE INDEX IF NOT EXISTS "DebitNoteLine_debitNoteId_idx" ON "DebitNoteLine"("debitNoteId");
CREATE INDEX IF NOT EXISTS "DebitNoteLine_productId_idx" ON "DebitNoteLine"("productId");

-- CreditNote indexes
CREATE INDEX IF NOT EXISTS "CreditNote_companyId_idx" ON "CreditNote"("companyId");
CREATE INDEX IF NOT EXISTS "CreditNote_customerId_idx" ON "CreditNote"("customerId");
CREATE INDEX IF NOT EXISTS "CreditNote_invoiceId_idx" ON "CreditNote"("invoiceId");
CREATE INDEX IF NOT EXISTS "CreditNote_status_idx" ON "CreditNote"("status");

-- CreditNoteLine indexes
CREATE INDEX IF NOT EXISTS "CreditNoteLine_creditNoteId_idx" ON "CreditNoteLine"("creditNoteId");
CREATE INDEX IF NOT EXISTS "CreditNoteLine_productId_idx" ON "CreditNoteLine"("productId");

-- PayrollRun indexes
CREATE INDEX IF NOT EXISTS "PayrollRun_companyId_idx" ON "PayrollRun"("companyId");

-- PayrollPayslip indexes
CREATE INDEX IF NOT EXISTS "PayrollPayslip_payrollRunId_idx" ON "PayrollPayslip"("payrollRunId");
CREATE INDEX IF NOT EXISTS "PayrollPayslip_employeeId_idx" ON "PayrollPayslip"("employeeId");

-- FixedAsset indexes
CREATE INDEX IF NOT EXISTS "FixedAsset_companyId_idx" ON "FixedAsset"("companyId");
CREATE INDEX IF NOT EXISTS "FixedAsset_status_idx" ON "FixedAsset"("status");

-- RecurringInvoice indexes
CREATE INDEX IF NOT EXISTS "RecurringInvoice_companyId_idx" ON "RecurringInvoice"("companyId");
CREATE INDEX IF NOT EXISTS "RecurringInvoice_customerId_idx" ON "RecurringInvoice"("customerId");
CREATE INDEX IF NOT EXISTS "RecurringInvoice_nextRunDate_idx" ON "RecurringInvoice"("nextRunDate");
CREATE INDEX IF NOT EXISTS "RecurringInvoice_isActive_idx" ON "RecurringInvoice"("isActive");

-- PaymentInvoice indexes
CREATE INDEX IF NOT EXISTS "PaymentInvoice_paymentId_idx" ON "PaymentInvoice"("paymentId");
CREATE INDEX IF NOT EXISTS "PaymentInvoice_invoiceId_idx" ON "PaymentInvoice"("invoiceId");
