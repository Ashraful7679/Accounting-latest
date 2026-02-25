# Accounting System - Complete Specification

## 1. Project Overview

### Project Name
Accounting System New

### Tech Stack
- **Frontend:** Next.js 15 with TypeScript, TailwindCSS, ShadcnUI
- **Backend:** Fastify with TypeScript, Prisma ORM
- **Database:** PostgreSQL (via Prisma)
- **File Storage:** Local filesystem (./uploads)

---

## 2. Authentication & Roles

### Roles
| Role | Description |
|------|-------------|
| Admin | System admin - manages companies and owners |
| Owner | Company owner - manages company, employees |
| Manager | Verification role - verifies subordinate work |
| Accountant | Entry creator - creates invoices/journals |
| User | Basic access - can create entries |

### Login Flow
1. Landing page: `/login`
2. User enters email/password
3. System detects role and redirects:
   - Admin → `/admin/dashboard`
   - Owner → `/owner/dashboard`
   - Manager/Accountant/User → `/company/:id/dashboard`

### Token Storage
- localStorage: `token`, `user`, `role`
- Separate tokens for admin: `adminToken`, `adminUser`

---

## 3. Database Schema

### Core Models

```prisma
// User Model
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  password      String
  firstName    String
  lastName     String
  isActive     Boolean  @default(true)
  maxCompanies Int      @default(1)
  
  // Reporting Hierarchy
  managerId     String?
  manager       User?    @relation("ManagerSubordinates", fields: [managerId], references: [id])
  subordinates  User[]   @relation("ManagerSubordinates")
  
  // Relations
  userRoles     UserRole[]
  userCompanies UserCompany[]
  permissions   UserPermission[]
  
  // Audit Trail - Created
  createdInvoices    Invoice[]    @relation("CreatedInvoices")
  createdJournals    JournalEntry[] @relation("CreatedJournals")
  
  // Audit Trail - Verified
  verifiedInvoices   Invoice[]   @relation("VerifiedInvoices")
  verifiedJournals   JournalEntry[] @relation("VerifiedJournals")
  
  // Audit Trail - Approved
  approvedInvoices   Invoice[]   @relation("ApprovedInvoices")
  approvedJournals  JournalEntry[] @relation("ApprovedJournals")
  
  // Audit Trail - Rejected
  rejectedInvoices   Invoice[]   @relation("RejectedInvoices")
  rejectedJournals  JournalEntry[] @relation("RejectedJournals")
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

// Role Model
model Role {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  isSystem    Boolean  @default(false)
  isActive    Boolean  @default(true)
  userRoles   UserRole[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// UserRole - Links User to Role
model UserRole {
  id      String @id @default(uuid())
  userId  String
  roleId  String
  user    User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  role    Role   @relation(fields: [roleId], references: [id])
  
  @@unique([userId, roleId])
}

// UserPermission - Module-level permissions
model UserPermission {
  id          String @id @default(uuid())
  userId      String
  module      String  // invoices, journals, customers, vendors, accounts, reports, backup
  canCreate   Boolean @default(false)
  canVerify   Boolean @default(false)
  canApprove  Boolean @default(false)
  user        User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, module])
}

// Company Model
model Company {
  id            String   @id @default(uuid())
  code          String   @unique  // Auto-generated: DC-001
  name          String
  logoUrl       String?
  address       String?
  city          String?
  country       String?
  phone         String?
  email         String?
  website       String?
  baseCurrency  String   @default("BDT")
  isActive     Boolean  @default(true)
  
  // Relations
  userCompanies UserCompany[]
  invoices     Invoice[]
  journals     JournalEntry[]
  customers    Customer[]
  vendors      Vendor[]
  accounts    Account[]
  branches    Branch[]
  products    Product[]
  
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

// UserCompany - Links User to Company
model UserCompany {
  id         String   @id @default(uuid())
  userId     String
  companyId  String
  isDefault  Boolean  @default(false)
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  company    Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  
  @@unique([userId, companyId])
}

// Invoice Model
model Invoice {
  id              String    @id @default(uuid())
  invoiceNumber   String    @unique  // Auto-generated: INV-0001
  companyId       String
  customerId      String?
  
  // Currency
  currency        String    @default("BDT")
  exchangeRate   Float     @default(1)
  subtotal       Float
  taxAmount      Float     @default(0)
  discountAmount Float     @default(0)
  total          Float
  
  // Status: DRAFT → PENDING_VERIFICATION → VERIFIED → PENDING_APPROVAL → APPROVED
  status         String    @default("DRAFT")
  
  // Audit Trail
  createdById     String
  verifiedById    String?
  approvedById   String?
  rejectedById    String?
  rejectionReason String?
  
  // Dates
  invoiceDate     DateTime  @default(now())
  dueDate         DateTime?
  verifiedAt      DateTime?
  approvedAt      DateTime?
  
  // Relations
  company        Company   @relation(fields: [companyId], references: [id])
  customer       Customer? @relation(fields: [customerId], references: [id])
  createdBy      User      @relation("CreatedInvoices", fields: [createdById], references: [id])
  verifiedBy     User?     @relation("VerifiedInvoices", fields: [verifiedById], references: [id])
  approvedBy    User?     @relation("ApprovedInvoices", fields: [approvedById], references: [id])
  rejectedBy    User?     @relation("RejectedInvoices", fields: [rejectedById], references: [id])
  lines         InvoiceLine[]
  documents      Document[]
  
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}

// InvoiceLine
model InvoiceLine {
  id          String  @id @default(uuid())
  invoiceId   String
  description String?
  quantity    Float   @default(1)
  unitPrice   Float
  taxRate     Float   @default(0)
  amount      Float
  invoice     Invoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
}

// JournalEntry Model
model JournalEntry {
  id              String    @id @default(uuid())
  entryNumber     String    @unique  // Auto-generated: JE-0001
  companyId       String
  date            DateTime  @default(now())
  description     String?
  reference       String?
  
  // Status: DRAFT → PENDING_VERIFICATION → VERIFIED → PENDING_APPROVAL → APPROVED
  status          String    @default("DRAFT")
  
  totalDebit      Float     @default(0)
  totalCredit     Float     @default(0)
  
  // Audit Trail
  createdById     String
  verifiedById    String?
  approvedById   String?
  rejectedById    String?
  rejectionReason String?
  
  // Dates
  verifiedAt      DateTime?
  approvedAt      DateTime?
  
  // Relations
  company        Company   @relation(fields: [companyId], references: [id])
  createdBy      User      @relation("CreatedJournals", fields: [createdById], references: [id])
  verifiedBy     User?     @relation("VerifiedJournals", fields: [verifiedById], references: [id])
  approvedBy    User?     @relation("ApprovedJournals", fields: [approvedById], references: [id])
  rejectedBy    User?     @relation("RejectedJournals", fields: [rejectedById], references: [id])
  lines         JournalEntryLine[]
  documents      Document[]
  
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}

// JournalEntryLine
model JournalEntryLine {
  id             String       @id @default(uuid())
  journalEntryId String
  accountId     String
  debit         Float        @default(0)
  credit        Float        @default(0)
  description   String?
  journalEntry  JournalEntry @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)
  account       Account      @relation(fields: [accountId], references: [id])
}

// Document/Attachment
model Document {
  id          String   @id @default(uuid())
  name        String   // Original filename
  fileName   String   // Stored filename (uuid)
  fileType   String   // pdf, jpg, jpeg, csv, png
  filePath   String   // Local path
  fileSize   Int      // Size in bytes
  entityType String   // invoice, journal, ledger
  entityId   String
  uploadedById String
  uploadedBy User    @relation(fields: [uploadedById], references: [id])
  createdAt   DateTime @default(now())
}

// Customer
model Customer {
  id          String   @id @default(uuid())
  code        String   @unique
  name        String
  companyId   String
  email       String?
  phone       String?
  address     String?
  city        String?
  country     String?
  isActive    Boolean  @default(true)
  company     Company  @relation(fields: [companyId], references: [id])
  invoices    Invoice[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// Vendor
model Vendor {
  id          String   @id @default(uuid())
  code        String   @unique
  name        String
  companyId   String
  email       String?
  phone       String?
  address     String?
  city        String?
  country     String?
  isActive    Boolean  @default(true)
  company     Company  @relation(fields: [companyId], references: [id])
  bills       Bill[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// Account
model Account {
  id           String   @id @default(uuid())
  code         String   @unique
  name         String
  companyId    String
  accountTypeId String
  parentId     String?
  isActive     Boolean  @default(true)
  openingBalance Float   @default(0)
  company      Company        @relation(fields: [companyId], references: [id])
  accountType  AccountType   @relation(fields: [accountTypeId], references: [id])
  parent       Account?      @relation("AccountHierarchy", fields: [parentId], references: [id])
  children     Account[]     @relation("AccountHierarchy")
  journalLines JournalEntryLine[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

// AccountType
model AccountType {
  id        String    @id @default(uuid())
  name      String    // ASSET, LIABILITY, EQUITY, INCOME, EXPENSE
  type      String    // DEBIT, CREDIT
  isActive  Boolean   @default(true)
  accounts  Account[]
}

// Branch
model Branch {
  id        String   @id @default(uuid())
  code      String   @unique
  name      String
  companyId String
  isActive  Boolean  @default(true)
  company   Company  @relation(fields: [companyId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// Product (for inventory)
model Product {
  id          String   @id @default(uuid())
  code        String   @unique
  name        String
  companyId   String
  sku         String?
  description String?
  unitPrice   Float    @default(0)
  isActive    Boolean  @default(true)
  company     Company  @relation(fields: [companyId], references: [id])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// Bill (Accounts Payable)
model Bill {
  id          String    @id @default(uuid())
  billNumber  String    @unique
  companyId   String
  vendorId    String
  status      String    @default("DRAFT")
  total       Float
  company     Company   @relation(fields: [companyId], references: [id])
  vendor      Vendor    @relation(fields: [vendorId], references: [id])
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}
```

---

## 4. Page Structure

### Landing: `/login`
- Email/Password form
- Role detection and redirect

### Admin: `/admin/*`
- `/dashboard` - Stats (companies, owners, users count)
- `/companies` - List, Create, Delete, Toggle Active
- `/owners` - List, Create, Reset Password, Delete

### Owner: `/owner/*`
- `/dashboard` - List of assigned companies (clickable)
- `/companies/:id` - Edit company details (name, logo, phone, address)
- `/employees` - List, Create, Set Permissions, Set Manager, Activate/Deactivate, Reset Password

### Company: `/company/:id/*`
- `/dashboard` - Overview with stats
- `/invoices` - List, Create, Verify, Approve, Print
- `/journals` - List, Create, Verify, Approve, Print
- `/customers` - CRUD
- `/vendors` - CRUD
- `/accounts` - Chart of Accounts
- `/ledger` - View, Print
- `/trial-balance` - View, Print
- `/reports/balance-sheet` - View, Print
- `/reports/profit-loss` - View, Print

---

## 5. Workflow Rules

### Document Status Flow
```
DRAFT → PENDING_VERIFICATION → VERIFIED → PENDING_APPROVAL → APPROVED
                          ↓ (reject)
                       REJECTED
```

### Role Actions Matrix

| Action | Accountant | Manager | Owner |
|--------|------------|---------|-------|
| Create | ✅ | ✅ | ✅ |
| Edit (Draft) | ✅ | ✅ | ✅ |
| Edit (Rejected) | ✅ | ❌ | ✅ |
| Delete (Draft) | ✅ | ❌ | ❌ |
| Delete (Verified+) | ❌ | ❌ | ❌ |
| Verify | ❌ | ✅ | ✅ |
| Reject | ❌ | ✅ | ✅ |
| Retrieve from Rejection | ❌ | ❌ | ✅ |
| Approve | ❌ | ❌ | ✅ |
| View Own + Subordinates | ❌ | ✅ | ✅ |
| View All | ❌ | ❌ | ✅ |

### Manager Verification Rules
- Can only verify entries created by their subordinates
- Cannot verify own entries
- Cannot retrieve entries that are already VERIFIED or APPROVED

### After Approval
- NO edits allowed
- NO deletions allowed
- Only view and print

---

## 6. Currency Handling

### Default Currency
- Base: BDT

### Multi-Currency in Invoice/Journal
```typescript
{
  currency: "USD",      // Selected currency
  exchangeRate: 110,   // 1 USD = 110 BDT
  amount: 1000,        // Amount in USD
  bdtAmount: 110000    // 1000 × 110 = BDT
}
```

- `bdtAmount` used for all calculations and reports

---

## 7. Auto-Generation Rules

### Company Code
- Format: `XX-001` where XX = First letters of company name
- Examples: "Demo Company" → "DC-001", "ABC Corporation" → "AC-001"

### Invoice Number
- Format: `INV-0001` (year-based: `INV-2026-0001`)

### Journal Entry Number
- Format: `JE-0001` (year-based: `JE-2026-0001`)

### Customer/Vendor Code
- Customer: `CUS-0001`
- Vendor: `VEN-0001`

---

## 8. File Storage

### Upload Location
```
./uploads/
├── companies/
│   └── :companyId/
│       └── logos/
│           └── :logo.jpg
├── documents/
│   └── :companyId/
│       ├── invoices/
│       │   └── :invoiceId/
│       │       └── :file.pdf
│       └── journals/
│           └── :journalId/
│               └── :file.pdf
```

### Allowed File Types
- Images: jpg, jpeg, png
- Documents: pdf
- Spreadsheets: csv

### Max File Size
- 10MB

---

## 9. Print Reports

All reports should be printable (PDF):
- Invoice
- Journal Entry
- Trial Balance
- Ledger
- Balance Sheet
- Profit & Loss Statement

---

## 10. API Endpoints

### Auth
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Admin
- `GET /api/admin/companies`
- `POST /api/admin/companies`
- `PUT /api/admin/companies/:id`
- `DELETE /api/admin/companies/:id`
- `GET /api/admin/owners`
- `POST /api/admin/owners`
- `DELETE /api/admin/owners/:id`
- `POST /api/admin/owners/:id/reset-password`

### Owner
- `GET /api/owner/companies`
- `PUT /api/owner/companies/:id`
- `GET /api/owner/employees`
- `POST /api/owner/employees`
- `PUT /api/owner/employees/:id/permissions`
- `PUT /api/owner/employees/:id/manager`
- `PUT /api/owner/employees/:id/activate`
- `POST /api/owner/employees/:id/reset-password`

### Company (Invoices)
- `GET /api/company/:id/invoices`
- `POST /api/company/:id/invoices`
- `PUT /api/company/:id/invoices/:invoiceId`
- `DELETE /api/company/:id/invoices/:invoiceId`
- `POST /api/company/:id/invoices/:invoiceId/verify`
- `POST /api/company/:id/invoices/:invoiceId/reject`
- `POST /api/company/:id/invoices/:invoiceId/retrieve`
- `POST /api/company/:id/invoices/:invoiceId/approve`
- `GET /api/company/:id/invoices/:invoiceId/print`

### Company (Journals)
- `GET /api/company/:id/journals`
- `POST /api/company/:id/journals`
- `PUT /api/company/:id/journals/:journalId`
- `DELETE /api/company/:id/journals/:journalId`
- `POST /api/company/:id/journals/:journalId/verify`
- `POST /api/company/:id/journals/:journalId/reject`
- `POST /api/company/:id/journals/:journalId/retrieve`
- `POST /api/company/:id/journals/:journalId/approve`
- `GET /api/company/:id/journals/:journalId/print`

### Company (Reports)
- `GET /api/company/:id/reports/trial-balance`
- `GET /api/company/:id/reports/ledger`
- `GET /api/company/:id/reports/balance-sheet`
- `GET /api/company/:id/reports/profit-loss`

### Files
- `POST /api/files/upload`
- `GET /api/files/:id/download`

---

## 11. Implementation Priority

1. **Phase 1: Foundation**
   - Project setup
   - Database schema
   - Auth system

2. **Phase 2: Admin Module**
   - Login/logout
   - Company CRUD
   - Owner CRUD

3. **Phase 3: Owner Module**
   - Company listing
   - Company editing
   - Employee management

4. **Phase 4: Company Module**
   - Dashboard
   - Customers/Vendors
   - Accounts

5. **Phase 5: Transactions**
   - Invoices (CRUD + workflow)
   - Journals (CRUD + workflow)

6. **Phase 6: Reports**
   - Trial Balance
   - Ledger
   - Balance Sheet
   - P&L

7. **Phase 7: Features**
   - File attachments
   - Print functionality
   - Currency conversion
