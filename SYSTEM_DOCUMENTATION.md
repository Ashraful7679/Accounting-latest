# AccaBiz System Documentation

**Version**: 1.0  
**Date**: May 19, 2026  
**System**: AccaBiz - Multi-tenant Accounting ERP

---

## Table of Contents

1. [Legal Compliance](#1-legal-compliance)
2. [Security Architecture](#2-security-architecture)
3. [Automation & Workflows](#3-automation--workflows)
4. [UI Design System](#4-ui-design-system)
5. [UX Guidelines](#5-ux-guidelines)

---

## 1. Legal Compliance

### 1.1 Financial Recording Requirements

#### Step 1: Document Numbering System
- Every financial document must have a unique, sequential number
- Number format: `PREFIX-YEAR-SEQUENCE` (e.g., INV-2026-0001)
- Gaps in numbering must be logged in audit trail

**Implementation**:
```typescript
// backend/src/modules/company/sequence.service.ts
async function getNextSequence(companyId: string, type: string): Promise<string> {
  const seq = await prisma.documentSequence.findUnique({
    where: { companyId_type_year: { companyId, type, year: new Date().getFullYear() } }
  });
  // Increment and return formatted sequence
}
```

#### Step 2: Retention of Financial Records
- All transactions retained with `createdAt` and `updatedAt` timestamps
- Soft delete pattern (`deletedAt` field) preserves audit trail
- Minimum retention: 7 years (configurable per company settings)

**Database Schema**:
```prisma
model JournalEntry {
  id          String   @id @default(uuid())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?  // Soft delete for audit trail
}
```

#### Step 3: Double-Entry Bookkeeping Enforcement
- Every journal entry must balance: `SUM(debit) === SUM(credit)`
- Database constraint added via migration:
```sql
ALTER TABLE "JournalEntry" ADD CONSTRAINT balanced_entry 
CHECK (totalDebit = totalCredit);
```

**Validation in Controller**:
```typescript
// backend/src/modules/company/journal.controller.ts
function validateBalancedEntry(lines: JournalEntryLine[]): boolean {
  const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
  return totalDebit === totalCredit;
}
```

### 1.2 Tax Compliance

#### Step 1: Tax Rate Configuration
- Each product can have configurable tax rate
- Tax calculations shown separately on invoices
- Support for multiple tax types (VAT, GST, etc.)

**Field Definition**:
```typescript
// frontend/src/data/fieldDefinitions.ts
taxRate: {
  function: 'Percentage of tax applied to this line item',
  procedure: 'Select applicable tax rate from configured tax codes',
  impact: 'Calculates tax amount to be collected and remitted',
  suggestions: [
    'Verify tax code matches product/service type',
    'Check for tax exemptions or special rates',
    'Stay updated on tax law changes'
  ]
}
```

#### Step 2: Tax Reporting
- Tax summary reports available per period
- Export functionality for tax filing
- Track tax collected vs. tax paid

### 1.3 South Asian Compliance (Bangladesh Context)

#### Step 1: Owner Identity Requirements
Enhanced owner profile with legal identifiers:

```prisma
model UserCompany {
  fatherMotherName String?  // Parent/Guardian name
  nidPassport      String?  // National ID or Passport
  mobile           String?  // Contact number
  permanentAddress String?  // Legal address
  tin               String?  // Tax Identification Number
  tinCertificateUrl String? // TIN Certificate upload
  din               String? // Director Identification Number
  ownershipType    String? // Proprietor, Partner, Director, Shareholder
  joiningDate      DateTime?
}
```

#### Step 2: Company Categories
```prisma
model Company {
  category String? @default("GENERAL") // GENERAL, TRADING, MANUFACTURING, SERVICE
}
```

---

## 2. Security Architecture

### 2.1 Authentication System

#### Step 1: JWT Token-Based Authentication

**Login Flow**:
```
1. User submits credentials → /api/auth/login
2. Backend validates password with bcrypt
3. Generate JWT with payload:
   {
     sub: userId,
     email: user.email,
     roles: ['Admin', 'Owner', 'Manager', ...],
     companyId: 'uuid' // for company users
   }
4. Return token + user data
5. Frontend stores in localStorage
```

**Token Structure**:
```typescript
interface JWTToken {
  sub: string;        // User ID
  id?: string;
  role?: string;      // Primary role
  roles?: string[];   // All roles
  isAdmin?: boolean;
  companyId?: string; // Current company context
  exp: number;        // Expiration timestamp
}
```

#### Step 2: Role-Based Access Control (RBAC)

**Permission Resolution Path**:
1. **System Admin Bypass** - Admin/Owner roles get full access
2. **User-Specific Override** - Individual permissions from `UserPermission` table
3. **Module Template** - Default permissions from `RolePermission` table

**Permission Model**:
```prisma
model RolePermission {
  id         String  @id @default(uuid())
  roleId     String
  module     String  // e.g., 'sales.invoices', 'finance.accounts'
  canCreate  Boolean @default(false)
  canView    Boolean @default(true)
  canEdit    Boolean @default(false)
  canDelete  Boolean @default(false)
  canVerify  Boolean @default(false)
  canApprove Boolean @default(false)
  canExport  Boolean @default(false)
  canPrint   Boolean @default(false)
}

model UserPermission {
  id         String  @id @default(uuid())
  userId     String
  module     String
  // Individual overrides (same fields as RolePermission)
}
```

**Permission Modules**:
| Module Key | Description |
|------------|-------------|
| `finance.accounts` | Chart of Accounts |
| `finance.journals` | Journal Entries |
| `sales.customers` | Customer Management |
| `sales.invoices` | Sales Invoices |
| `sales.orders` | Sales Orders |
| `sales.credit-notes` | Credit Notes |
| `purchase.vendors` | Vendor Management |
| `purchase.invoices` | Purchase Invoices |
| `purchase.orders` | Purchase Orders |
| `purchase.debit-notes` | Debit Notes |
| `hr.employees` | Employee Management |
| `hr.payroll` | Payroll Processing |
| `inventory.products` | Product Catalog |
| `inventory.warehouses` | Warehouse Management |
| `lc.*` | Letter of Credit Management |
| `payments.*` | Payment Processing |
| `company.settings` | Company Settings |
| `company.branches` | Branch Management |

#### Step 3: Frontend Permission Hook

**Implementation**:
```typescript
// frontend/src/hooks/usePermissions.ts
import { usePermissions } from '@/hooks/usePermissions';

function SalesInvoicesPage() {
  const companyId = useCompany().companyId;
  const { canCreate, canEdit, canDelete, canVerify, canApprove } = 
    usePermissions('sales.invoices', companyId);

  return (
    <div>
      {canCreate && <button>Create Invoice</button>}
      {canEdit && <button>Edit</button>}
      {canDelete && <button>Delete</button>}
      {canVerify && <button>Verify</button>}
      {canApprove && <button>Approve</button>}
    </div>
  );
}
```

### 2.2 API Security

#### Step 1: Route Protection

**Required Hook Pattern**:
```typescript
// backend/src/modules/company/company.routes.ts
export default async function companyRoutes(fastify: FastifyInstance) {
  // ALL routes must include this
  fastify.addHook('preHandler', authenticate);

  fastify.get('/:id/accounts', controller.getAccounts.bind(controller));
  fastify.post('/:id/invoices', controller.createInvoice.bind(controller));
  // ... more routes
}
```

#### Step 2: Input Validation

**Request Validation**:
```typescript
// Example: Invoice creation validation
const invoiceSchema = {
  type: 'object',
  required: ['customerId', 'type', 'lines'],
  properties: {
    customerId: { type: 'string', format: 'uuid' },
    type: { type: 'string', enum: ['SALES', 'PURCHASE'] },
    lines: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['productId', 'quantity', 'unitPrice'],
        properties: {
          productId: { type: 'string' },
          quantity: { type: 'number', minimum: 0.01 },
          unitPrice: { type: 'number', minimum: 0 }
        }
      }
    }
  }
};
```

#### Step 3: Error Handling

**Global Error Handler**:
```typescript
// backend/src/middleware/errorHandler.ts
fastify.setErrorHandler(async (error, request, reply) => {
  // Log error for debugging
  logger.error({ error: error.message, stack: error.stack });

  // Sanitize response based on error type
  if (error instanceof PrismaClientKnownRequestError) {
    return reply.status(400).send({
      success: false,
      error: { message: 'Database operation failed' }
    });
  }

  if (error.statusCode >= 500) {
    return reply.status(500).send({
      success: false,
      error: { message: 'Internal server error' }
    });
  }

  // Forward known errors with their messages
  return reply.status(error.statusCode).send({
    success: false,
    error: { message: error.message }
  });
});
```

### 2.3 Data Protection

#### Step 1: Company Isolation
- Every query must include `companyId` filter
- Middleware enforces tenant isolation

**Middleware Implementation**:
```typescript
// backend/src/middleware/authorizeCompany.ts
async function authorizeCompany(request: FastifyRequest) {
  const user = request.user as any;
  const params = request.params as any;
  const companyId = params.companyId || params.id;

  if (!companyId) return; // Skip for non-company routes

  // Verify user has access to this company
  const userCompany = await prisma.userCompany.findFirst({
    where: { userId: user.id, companyId }
  });

  if (!userCompany) {
    throw new ForbiddenError('Access denied to this company');
  }
}
```

#### Step 2: Sensitive Data Handling
- Passwords hashed with bcrypt (10 rounds)
- JWT secrets in environment variables
- Sensitive fields excluded from API responses

**Exclusion Pattern**:
```typescript
// In controllers, before returning user data
const { password, tokenVersion, ...userWithoutSensitive } = user;
return userWithoutSensitive;
```

---

## 3. Automation & Workflows

### 3.1 Financial Automation

#### Step 1: Auto-Journal on Invoice Approval

**Flow**:
```
Invoice Status: DRAFT → VERIFIED → APPROVED
                            ↓
                    Auto-generate Journal Entry
                            ↓
                    isJournaled = true (prevents duplicate)
```

**Implementation**:
```typescript
// backend/src/modules/company/invoice.service.ts
async function autoJournalOnApprove(invoice: Invoice): Promise<void> {
  // Check if already journaled
  if (invoice.isJournaled) return;

  // Build journal entry lines
  const lines = [
    // Debit: Accounts Receivable
    { accountId: arAccountId, debit: invoice.total, credit: 0 },
    // Credit: Revenue
    { accountId: revenueAccountId, debit: 0, credit: invoice.subtotal },
    // Credit: Tax Payable
    { accountId: taxAccountId, debit: 0, credit: invoice.taxAmount }
  ];

  await prisma.journalEntry.create({
    data: {
      companyId: invoice.companyId,
      date: invoice.invoiceDate,
      description: `Auto-generated from Invoice ${invoice.invoiceNumber}`,
      totalDebit: invoice.total,
      totalCredit: invoice.total,
      status: 'APPROVED',
      isJournaled: true,
      lines: { create: lines }
    }
  });

  // Mark invoice as journaled
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { isJournaled: true }
  });
}
```

#### Step 2: Auto-Allocation on Payment

**FIFO Algorithm**:
```typescript
// backend/src/modules/company/payment.service.ts
async function autoAllocate(payment: Payment, companyId: string): Promise<void> {
  // Get outstanding invoices for customer/vendor
  const outstandingInvoices = await prisma.invoice.findMany({
    where: {
      companyId,
      customerId: payment.customerId,
      status: 'APPROVED',
      total: { gt: prisma.invoice.fields.totalPaid } // Has balance
    },
    orderBy: { invoiceDate: 'asc' } // FIFO
  });

  let remainingAmount = payment.amount;

  for (const invoice of outstandingInvoices) {
    if (remainingAmount <= 0) break;

    const balance = invoice.total - invoice.totalPaid;
    const allocationAmount = Math.min(balance, remainingAmount);

    await prisma.paymentInvoice.create({
      data: {
        paymentId: payment.id,
        invoiceId: invoice.id,
        allocatedAmount: allocationAmount
      }
    });

    remainingAmount -= allocationAmount;
  }
}
```

### 3.2 Document Automation

#### Step 1: Auto-Generate DN from Sales Invoice

**Trigger**: Invoice status → APPROVED

**Flow**:
```
1. Check if items need delivery
2. Create Delivery Note (DN) with same line items
3. Update invoice with DN reference
4. Log activity
```

#### Step 2: Auto-Generate GRN from Purchase Invoice

**Trigger**: Purchase Invoice status → APPROVED

### 3.3 LC (Letter of Credit) Automation

#### Step 1: PI Linked to LC

**Validation**:
```typescript
async function validateLC_PILink(pi: PI, lc: LC): Promise<boolean> {
  const linkedPIs = await prisma.pi.findMany({
    where: { lcId: lc.id }
  });

  const totalPIAmount = linkedPIs.reduce((sum, p) => sum + p.amount, 0);
  const lcAmount = lc.amount;

  return totalPIAmount + pi.amount <= lcAmount;
}
```

#### Step 2: Margin Calculation

```typescript
function calculateLCMargin(lcAmount: number, marginPercentage: number): number {
  return lcAmount * (marginPercentage / 100);
}
```

### 3.4 Payroll Automation

#### Step 1: Process Monthly Payroll

**Flow**:
```
1. Select payroll period (YYYY-MM)
2. Fetch active employees
3. Calculate:
   - Gross Salary = Basic + Allowances + Overtime
   - Deductions = Tax + Advances + Loans
   - Net Salary = Gross - Deductions
4. Create PayrollRun record
5. Generate PayrollPayslip for each employee
6. Create journal entry for salary payable
```

### 3.5 Stock Automation

#### Step 1: Stock Transfer Workflow

**States**: PENDING → APPROVED → RECEIVED

**Transfer Flow**:
```typescript
async function transferStock(
  fromWarehouseId: string,
  toWarehouseId: string,
  lines: { productId: string, quantity: number }[]
): Promise<StockTransfer> {
  return await prisma.$transaction(async (tx) => {
    // 1. Create transfer record
    const transfer = await tx.stockTransfer.create({
      data: {
        companyId,
        transferNumber: await generateTransferNumber(companyId),
        fromWarehouseId,
        toWarehouseId,
        status: 'PENDING',
        lines: { create: lines }
      }
    });

    // 2. Reserve stock (optional based on business logic)
    // 3. Return transfer ID for approval workflow
    return transfer;
  });
}
```

---

## 4. UI Design System

### 4.1 Component Library

#### Step 1: Base Components

| Component | Purpose | File Location |
|-----------|----------|---------------|
| Button | Primary actions | `components/ui/Button.tsx` |
| Input | Text/number entry | `components/ui/Input.tsx` |
| Select | Dropdown selection | `components/ui/Select.tsx` |
| Modal | Pop-up dialogs | `components/ui/Modal.tsx` |
| Table | Data display | `components/ui/Table.tsx` |
| DetailPanel | Side panel for details | `components/DetailPanel.tsx` |
| ConfirmModal | Delete confirmations | `components/ConfirmModal.tsx` |
| InfoTooltip | Field help text | `components/InfoTooltip.tsx` |

#### Step 2: Form Components with Field Definitions

**Example: Invoice Form Fields**:
```typescript
// frontend/src/data/fieldDefinitions.ts
export const invoiceFieldInfo: FieldDefinitions = {
  customer: {
    function: 'Identifies the customer/buyer who will receive this invoice',
    procedure: 'Select from the list of active customers',
    impact: 'Affects accounts receivable tracking, customer aging reports',
    suggestions: [
      'Verify customer tax ID if applicable',
      'Check customer payment terms and credit limit'
    ]
  },
  // ... more fields
};
```

**InfoTooltip Usage**:
```tsx
import { InfoTooltip } from '@/components/InfoTooltip';
import { invoiceFieldInfo } from '@/data/fieldDefinitions';

<label>
  Customer
  <InfoTooltip fieldInfo={invoiceFieldInfo.customer} />
</label>
```

### 4.2 Layout Patterns

#### Step 1: Company Page Layout

```tsx
// Standard layout for /company/[id]/* pages
export default function CompanyPage() {
  const params = useParams();
  const companyId = params.id;

  return (
    <div className="flex">
      <Sidebar companyId={companyId} />
      <main className="flex-1 ml-56">
        <Header />
        <Content />
      </main>
    </div>
  );
}
```

#### Step 2: Detail Panel Pattern

**For viewing/editing without leaving list**:
```tsx
import DetailPanel, { DetailField, DetailAction, DetailTab } from '@/components/DetailPanel';

const fields: DetailField[] = [
  { label: 'Invoice Number', value: invoice.invoiceNumber },
  { label: 'Customer', value: invoice.customer?.name },
  { label: 'Total', value: invoice.total, type: 'currency' }
];

const actions: DetailAction[] = [
  { label: 'Edit', onClick: handleEdit, variant: 'secondary' },
  { label: 'Approve', onClick: handleApprove, variant: 'primary' }
];

<DetailPanel
  isOpen={showPanel}
  title="Invoice Details"
  fields={fields}
  actions={actions}
  onClose={() => setShowPanel(false)}
/>
```

### 4.3 Responsive Design

#### Breakpoints
- **Mobile**: < 640px
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

#### Sidebar Behavior
- Desktop: Fixed left sidebar (w-56 = 224px)
- Mobile: Hamburger menu → slide-out drawer

### 4.4 Color System

| Purpose | Color | Tailwind Class |
|---------|-------|----------------|
| Primary Action | Blue 600 | `bg-blue-600` |
| Success | Emerald 600 | `bg-emerald-600` |
| Danger/Delete | Red 600 | `bg-red-600` |
| Warning | Amber 500 | `bg-amber-500` |
| Background | Slate 50 | `bg-slate-50` |
| Surface | White | `bg-white` |
| Text Primary | Slate 900 | `text-slate-900` |
| Text Secondary | Slate 500 | `text-slate-500` |

---

## 5. UX Guidelines

### 5.1 Authentication Flow

#### Step 1: Session Management

**Root Page Redirect** (`/page.tsx`):
```typescript
useEffect(() => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user'));
  
  if (!token || !user) {
    router.push('/login');
    return;
  }

  const roles = user.roles || [];
  if (roles.includes('Admin')) {
    router.push('/admin/dashboard');
  } else if (roles.includes('Owner')) {
    router.push('/owner/dashboard');
  } else if (user.userCompanies?.length > 0) {
    router.push(`/company/${user.userCompanies[0].companyId}/dashboard`);
  }
}, [router]);
```

#### Step 2: Protected Routes

**Pattern for all company pages**:
```typescript
useEffect(() => {
  const token = localStorage.getItem('token');
  if (!token) {
    router.push('/login');
  }
  setMounted(true);
}, [router]);

if (!mounted) return null;
```

### 5.2 Navigation

#### Step 1: Sidebar Structure

**For Company Pages**:
```typescript
const menuItems = [
  { name: 'Dashboard', href: `/company/${companyId}/dashboard` },
  { name: 'Chart of Accounts', href: `/company/${companyId}/accounts` },
  { 
    name: 'Sales', 
    children: [
      { name: 'Customers', href: '...' },
      { name: 'Invoices', href: '...' }
    ]
  }
  // ... more items
];
```

#### Step 2: Breadcrumb Navigation

For nested pages (e.g., `/company/[id]/sales/invoices/create`):
```tsx
<nav className="flex items-center gap-2 text-sm">
  <Link href={`/company/${companyId}/dashboard`}>Dashboard</Link>
  <ChevronRight className="w-4 h-4" />
  <Link href={`/company/${companyId}/sales`}>Sales</Link>
  <ChevronRight className="w-4 h-4" />
  <span className="text-gray-500">Create Invoice</span>
</nav>
```

### 5.3 Data Loading States

#### Step 1: Loading Indicators

```tsx
const { data, isLoading } = useQuery({
  queryKey: ['invoices', companyId],
  queryFn: () => api.get(`/company/${companyId}/invoices`)
});

if (isLoading) {
  return <div className="flex justify-center p-8">
    <LoadingSpinner />
  </div>;
}
```

#### Step 2: Empty States

```tsx
if (!data?.length) {
  return (
    <div className="text-center p-8">
      <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
      <p className="text-gray-500">No invoices found</p>
      <button onClick={() => router.push('create')}>Create First Invoice</button>
    </div>
  );
}
```

#### Step 3: Error States

```tsx
try {
  // API call
} catch (error) {
  toast.error('Failed to load invoices');
  return (
    <div className="text-center p-8">
      <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
      <p className="text-gray-700">Something went wrong</p>
      <button onClick={() => refetch()}>Try Again</button>
    </div>
  );
}
```

### 5.4 Form UX Best Practices

#### Step 1: Inline Validation

```tsx
const [errors, setErrors] = useState({});

function validate(field: string, value: string) {
  if (!value) {
    setErrors(prev => ({ ...prev, [field]: 'This field is required' }));
  } else {
    setErrors(prev => ({ ...prev, [field]: undefined }));
  }
}

<input 
  onChange={(e) => {
    setFormData({ ...formData, name: e.target.value });
    validate('name', e.target.value);
  }}
  className={errors.name ? 'border-red-500' : ''}
/>
{errors.name && <p className="text-red-500 text-sm">{errors.name}</p>}
```

#### Step 2: Auto-save Drafts

```typescript
// Save draft automatically when form changes
useEffect(() => {
  const timer = setTimeout(() => {
    if (hasChanges) {
      localStorage.setItem(`draft_${formType}`, JSON.stringify(formData));
    }
  }, 2000);
  return () => clearTimeout(timer);
}, [formData]);
```

#### Step 3: Confirmation Dialogs

For destructive actions (delete, cancel):
```tsx
<ConfirmModal
  isOpen={showDeleteModal}
  title="Delete Invoice"
  message="Are you sure you want to delete this invoice? This action cannot be undone."
  confirmLabel="Delete"
  variant="danger"
  onConfirm={handleDelete}
  onCancel={() => setShowDeleteModal(false)}
/>
```

### 5.5 Accessibility

#### Step 1: Keyboard Navigation
- All interactive elements focusable
- Logical tab order
- Escape closes modals

#### Step 2: Screen Reader Support
- Proper semantic HTML (`<table>`, `<nav>`, `<button>`)
- ARIA labels for icons
- Form labels associated with inputs

#### Step 3: Color Contrast
- Minimum 4.5:1 contrast ratio for text
- Visible focus indicators

---

## 6. Appendix

### A. Database Models Overview

| Category | Models |
|----------|--------|
| **Auth** | User, Role, UserRole, UserPermission, UserCompany |
| **Company** | Company, Branch, CompanySettings, DocumentSequence |
| **Accounting** | Account, AccountType, Project, CostCenter |
| **Sales** | SalesOrder, DN, CreditNote |
| **Purchase** | PurchaseOrder, GRN, Bill, DebitNote |
| **Invoicing** | Invoice, InvoiceLine |
| **Journal** | JournalEntry, JournalEntryLine |
| **LC/Trade** | LC, PI, Loan |
| **Products** | Product |
| **Inventory** | Warehouse, StockTransfer |
| **HR/Payroll** | Employee, EmployeeAdvance, EmployeeLoan, PayrollRun |
| **Financial** | Currency, ExchangeRate |
| **Audit** | ActivityLog, SystemAuditLog, Notification |

### B. API Endpoints Summary

| Prefix | Description |
|--------|-------------|
| `/auth/*` | Authentication (login, logout, roles) |
| `/admin/*` | System administration |
| `/owner/*` | Owner-level management |
| `/company/:id/*` | Company-scoped operations |

### C. Build & Deploy Commands

```bash
# Backend
cd backend
npm run build  # npx prisma generate && tsc && npx prisma migrate deploy

# Frontend
cd frontend
npm run build  # next build

# Deploy
git push origin okay  # Auto-deploys to Render.com
```

---

*End of System Documentation*