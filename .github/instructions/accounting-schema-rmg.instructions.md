---
name: accounting-schema-rmg
description: "Use when modifying Prisma schema for RMG/manufacturing accounting models. Enforces multi-tenant isolation, cascade rules, Bangladesh compliance, LC-based trade workflows, and accounting integrity."
applyTo: "backend/prisma/schema.prisma"
---

# RMG Accounting Schema Guidelines

You are reviewing and designing Prisma schema for a **Bangladesh RMG/Manufacturing Export Company** accounting system. Every model must enforce financial integrity, multi-tenant compliance, and LC/trade-based workflows.

## Domain-Specific Rules

### 1. Multi-Tenant Isolation (Critical)
- **EVERY financial model must have `companyId: String` field**
- Always add: `company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)`
- All queries must filter by `companyId` — no cross-company data leakage
- Companies represent separate RMG factory units or trading entities

### 2. LC-Based Trade Compliance
- **LC (Letter of Credit)** is the backbone of RMG exports
  - Each LC ties to a Supplier (Spinner/Yarn supplier), Buyer (Foreign importer), and multiple PIs
  - Each LC can spawn multiple Sales Orders (cut & sew orders to subcontractors)
  - Ensure LC.status tracks: `DRAFT` → `SUBMITTED` → `ACTIVE` → `UTILISED` → `CLOSED`
- **PI (Proforma Invoice)** represents quote to buyer before LC opening
  - PI → LC → SO → GRN (inspection) → Invoice → Payment
- **GRN (Goods Received Note)** is inspection record before shipment
  - Must track quality grading (First, Second, Reject), Qty inspected vs Qty shipped

### 3. GL Compliance for Manufacturing
- **Chart of Accounts must include**:
  - Raw Material accounts (Yarn, Fabric, Dyes) — track by Product Code
  - Work-In-Progress (WIP) accounts — job-order costing by SO/batch
  - Finished Goods accounts — by garment type (Shirt, Trouser, etc.)
  - Loan accounts — separate by loan type (Working Capital, Term Loan)
  - LC accounts — track LC utilisation cost vs LC amount
- **All GL entries must have audit trail**: `createdBy`, `verifiedBy`, `approvedBy` (role-based)
- **Soft deletes for GL entries**: Add `deletedAt DateTime?` — never hard-delete journal entries

### 4. Loan & Working Capital Tracking
- RMG companies heavily rely on Working Capital loans
  - Loans are disbursed by bank, tied to specific LCs or purchase orders
  - Interest accrual, prepayment, rollover tracking required
  - Each loan installment/payment creates GL entries automatically
- **Loan model must track**:
  - `status`: SANCTIONED → DISBURSED → ACTIVE → REPAID → CLOSED
  - `sanctionedAmount`, `disbursedAmount`, `repaidAmount`
  - Interest rate, tenure, payment schedule
  - Link to LC or PO

### 5. Inventory & Costing
- Track raw materials (Yarn, Fabric) with **batch numbers** and **supplier lot IDs**
  - Enable cost averaging and FIFO costing
- WIP tracking: Each SO links to raw material batches consumed
  - Variance analysis: Actual yield vs Standard yield
- **Finished goods**: Tie to Sales Order + GRN inspection record
  - Track rejection %age, re-working cost

### 6. Compliance & Audit Requirements
- **All financial operations must log**:
  - `createdAt`, `updatedAt`, soft delete support
  - `createdBy: String` (User ID), reference to creator
  - For destructive ops (LC close, payment reversal): `SystemAuditLog` entry
- **Currency tracking**:
  - RMG is multi-currency: BDT (local), USD (export)
  - LC amount in USD, Payment in USD/BDT, GL in base currency
  - Add `currencyCode: String` to LC, SO, Invoice, Payment models
- **Bangladesh regulatory**:
  - Track EPZ (Export Processing Zone) or Local status
  - Compliance with BD Bank's Export LC rules

### 7. Cascade Delete Rules
- **Safe cascades**:
  - `Company` → `LC`, `SO`, `PO`, `Invoice`, `Payment` (✅ OK to cascade)
  - `LC` → `PI` (✅ if LC is deleted, PIs are archived/soft-deleted)
  - `SO` → `GRN` (✅ mark GRN as deleted, don't soft-delete GL impact)
- **Dangerous cascades (use soft delete instead)**:
  - `Invoice` → `JournalEntry` (❌ Never hard-delete; use `deletedAt`)
  - `GRN` → `JournalEntry` (❌ Use soft delete for audit trail)
  - `Loan` → `LoanRepayment` (❌ Must retain for regulatory reporting)

### 8. Field Naming & Standardization
- **Amounts**: Use `Decimal` type, not Float
  - Example: `amount Decimal(15, 2)` for BDT, `amountUSD Decimal(15, 2)` for USD
- **Codes**: Enforce format validation at schema level where possible
  - LC number format: `{COMPANY_CODE}-LC-{YEAR}-{SEQ}` (e.g., `MYRMG-LC-2026-001`)
  - SO number: `{COMPANY_CODE}-SO-{YEAR}-{SEQ}`
  - PO number: `{COMPANY_CODE}-PO-{YEAR}-{SEQ}`
  - Use `@db.VarChar(50)` with index
- **Statuses**: Use enum-like string fields or `@db.Enum()` for PostgreSQL
  - Example: `status String` with validation in controller

### 9. Indexes & Performance
- Add `@@index([companyId])` to all company-scoped models
- Add `@@index([lcNumber])`, `@@index([soNumber])` for quick lookup
- Add `@@index([status])` for filtering by workflow state
- Composite indexes for common queries:
  - `@@index([companyId, status, createdAt])` for dashboard queries

### 10. Relationships & Integrity
- **LC → SO**: One LC can have many SO (subcontractor orders)
  - Validate: Total SO value ≤ LC amount
  - Track: LC utilisation % in real-time
- **SO → GRN**: One SO can have multiple GRN inspections (progressive shipments)
- **GRN → Invoice**: One GRN ties to Invoice (but one Invoice can have multiple GRNs for bundled shipment)
- **PO → GRN**: Local purchase links to GRN (yarn, dyes from suppliers)

## Review Checklist

When reviewing schema changes, verify:

- [ ] New financial model has `companyId` and `company` relation with cascade delete
- [ ] Date fields are present: `createdAt`, `updatedAt`, and `deletedAt` if financial record
- [ ] Audit fields present: `createdBy`, `verifiedBy` if approval workflow
- [ ] Currency field added if multi-currency (LC, PO, Invoice)
- [ ] Status field defined with enum-like validation
- [ ] Amount fields use `Decimal(15, 2)`, not Float
- [ ] Indexes added for `companyId`, `status`, `createdAt`
- [ ] Cascade delete strategy documented (safe vs soft delete)
- [ ] GL impact documented: Does this create journal entries?
- [ ] Bangladesh compliance considered: EPZ, tax, regulatory fields?

## Example Patterns

### RMG LC Model Pattern
```prisma
model LC {
  id              String   @id @default(uuid())
  companyId       String
  lcNumber        String   // Format: MYRMG-LC-2026-001
  bankName        String
  supplier        String   // Yarn/Fabric supplier name
  buyerName       String   // Foreign buyer name
  
  amount          Decimal(15, 2)       // USD amount
  amountBDT       Decimal(15, 2)?      // BDT equivalent for GL
  currencyCode    String   @default("USD")
  
  utilizedAmount  Decimal(15, 2) @default(0)  // Running total
  
  openDate        DateTime
  expiryDate      DateTime
  status          String   // DRAFT, SUBMITTED, ACTIVE, UTILISED, CLOSED
  
  // Relations
  company         Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  pis             PI[]
  salesOrders     SalesOrder[]
  
  // Audit
  createdBy       String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?
  
  @@index([companyId])
  @@index([lcNumber])
  @@index([status])
  @@unique([companyId, lcNumber])
}
```

### Journal Entry Pattern (GL)
```prisma
model JournalEntry {
  id              String   @id @default(uuid())
  companyId       String
  jvNumber        String   // Sequential: JV-2026-001
  
  // Audit & workflow
  createdBy       String
  verifiedBy      String?
  approvedBy      String?
  
  // GL details
  debitAmount     Decimal(15, 2)
  creditAmount    Decimal(15, 2)
  
  // Traceability
  referenceDoc    String?  // LC-001, SO-002, Invoice-003
  description     String
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?  // SOFT DELETE — never hard delete GL
  
  @@index([companyId, createdAt])
  @@index([deletedAt])  // Find only non-deleted entries
}
```

## Design Decisions to Document

When adding new models, document:
- **Why this entity?** (e.g., "Tracks LC utilisation for export compliance")
- **GL impact**: What journal entries are created? (e.g., "LC opening → Contingent liability GL")
- **Cascade strategy**: Why hard delete vs soft delete?
- **Multi-currency**: If amounts, why BDT and/or USD?
- **Audit requirements**: Who must approve? (RMG exports need compliance sign-off)
