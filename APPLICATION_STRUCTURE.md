# AccaBiz Application Structure Summary

Generated: May 19, 2026

---

## Summary Table

| Metric | Count |
|--------|-------|
| **Total Pages** | 70 |
| **Missing from Sidebar** | ~15 pages |
| **Pages to Remove** | 5 (duplicates) |
| **Total Forms** | 6 (defined in fieldDefinitions.ts) |
| **Forms Needing Definitions** | ~19 |
| **Total Defined Fields** | 41 |
| **Actual Fields in Use** | ~100+ |
| **Field Types** | 8 (current) + 8 (missing) |

---

## PART 1: PAGES - Current State (75 Pages)

### Breakdown by Section

#### Root/Login (1 page)
- `frontend/src/app/page.tsx` (login/landing)

#### Admin Section (5 pages)
1. Dashboard - `admin/dashboard`
2. Companies - `admin/companies`
3. Owners - `admin/owners`
4. Audit Logs - `admin/audit-logs`
5. Settings - `admin/settings` (Account, Backup)

> **Note:** Admin does NOT have own companies or employees - only system management.
> - Admin manages all companies globally but doesn't own any
> - Admin has NO employees - only system users
> - Owner manages their companies and can have employees
> - Company (staff) uses the system but doesn't own companies

#### Owner Section (4 pages)
1. Dashboard - `owner/dashboard`
2. Companies - `owner/companies`
3. Employees - `owner/employees`
4. Profile - `owner/profile`

#### Company Section - Dynamic `[id]` Routes (63 pages)

##### Core Modules (2 pages)
1. Dashboard - `company/[id]/dashboard`
2. Chart of Accounts - `company/[id]/accounts`

##### Sales Module (7 pages)
3. Customers - `company/[id]/sales/customers`
4. Sales Orders - `company/[id]/sales/orders`
5. Sales Orders Create - `company/[id]/sales/orders/create`
6. Proforma Invoices - `company/[id]/sales/pis`
7. Delivery Notes (Challans) - `company/[id]/sales/challans`
8. Sales Invoices - `company/[id]/sales/invoices`
9. Sales Invoices Create - `company/[id]/sales/invoices/create`
10. Credit Notes - `company/[id]/sales/credit-notes`
11. Challan Detail - `company/[id]/sales/challans/[challanId]`

##### Purchase Module (7 pages)
12. Vendors/Suppliers - `company/[id]/vendors`
13. Purchase Orders - `company/[id]/purchase/orders`
14. Purchase Orders Create - `company/[id]/purchase/orders/create`
15. Purchase Invoices - `company/[id]/purchase/invoices`
16. Purchase Invoices Create - `company/[id]/purchase/invoices/create`
17. Purchase PIs - `company/[id]/purchase/pis`
18. Purchase Requisitions - `company/[id]/purchase/requisitions`
19. Debit Notes - `company/[id]/purchase/debit-notes`

##### LC Module (7 pages)
20. LC Overview - `company/[id]/lc`
21. LC Detail - `company/[id]/finance/lc/[lcId]`
22. LC Create Import - `company/[id]/lc/create/import`
23. LC Create Export - `company/[id]/lc/create/export`
24. LC Loans - `company/[id]/lc/loans`
25. LC Settlement - `company/[id]/lc/settlement`
26. LC PIs - `company/[id]/lc/pis`

##### Payments Module (5 pages)
27. Receive Payment - `company/[id]/payments/receive`
28. Make Payment - `company/[id]/payments/make`
29. Transfer - `company/[id]/payments/transfer`
30. Payment History - `company/[id]/payments/history`
31. Payment Allocation - `company/[id]/payments/allocate`

##### Products Module (3 pages)
32. Product Catalog - `company/[id]/products`
33. Create Product - `company/[id]/products/create`
34. Edit Product - `company/[id]/products/[productId]/edit`

##### Journal/Finance (6 pages)
35. Journal Entries - `company/[id]/journals`
36. Journal Create - `company/[id]/journals/create`
37. Fixed Assets - `company/[id]/finance/fixed-assets`
38. Period Close - `company/[id]/finance/period-close`
39. Bank Reconciliation - `company/[id]/bank/reconcile`
40. Finance Overview - `company/[id]/finance` (empty/placeholder)

##### HR/Employees (2 pages)
41. Employees - `company/[id]/employees`
42. Payroll - `company/[id]/hr/payroll`

##### Inventory Module (3 pages)
43. Warehouses - `company/[id]/inventory/warehouses`
44. Transfers - `company/[id]/inventory/transfers`
45. Reconciliation - `company/[id]/inventory/reconciliation`

##### Other Modules (8 pages)
46. Reports - `company/[id]/reports`
47. Audit Logs - `company/[id]/audit`
48. Notifications - `company/[id]/notifications`
49. Settings - `company/[id]/settings`
50. Roles - `company/[id]/settings/roles`
51. Backup - `company/[id]/settings/backup`
52. Receivables Search - `company/[id]/receivables-search`
53. Period Closing - `company/[id]/closing` (duplicate)

#### Portal Section (2 pages)
1. Vendor Portal - `portal/[companyId]/vendor/[token]`
2. Customer Portal - `portal/[companyId]/customer/[token]`

#### Unused/Duplicate Pages (to remove)
- `health/page.tsx` - unused health check
- `invoices/page.tsx` - duplicate of sales/invoices
- `receivables-search/page.tsx` - could be in Reports
- `finance/bank-reconciliation/page.tsx` - duplicate of `/bank/reconcile`

---

## PART 2: CURRENT SIDEBAR NAVIGATION (33 Menu Items)

```
1. Dashboard
2. Chart of Accounts
3. Sales
   ├── Customers
   ├── Sales Orders
   ├── Proforma Invoice
   ├── Delivery Notes
   ├── Sales Invoices
   ├── Credit Notes           <-- NEW
   └── Collections
4. Purchase
   ├── Suppliers
   ├── Purchase Requisitions  <-- NEW
   ├── Purchase Orders
   ├── Purchase PIs          <-- NEW
   ├── Purchase Invoices
   └── Debit Notes            <-- NEW
5. LC Management
   ├── LC Overview
   ├── Import LC
   ├── Export LC
   ├── Loan Management
   └── LC Settlement
6. Payments
   ├── Receive Payment
   ├── Make Payment
   ├── Transfer
   ├── Payment History
   └── Payment Allocation
7. Journal Entries
8. Products
   ├── Catalog
   └── Add Product
9. Employees
10. Payroll                 <-- NEW
11. Inventory              <-- NEW
    ├── Warehouses
    ├── Transfers
    └── Reconciliation
12. Finance
    ├── Fixed Assets
    ├── Period Closing
    └── Bank Reconciliation
13. Reports
14. Roles
15. Backup
```

### Missing from Sidebar (Need to Add):

| Module | Pages Available | Sidebar Status |
|--------|------------------|----------------|
| **Finance** | General Ledger View | NOT separate page |
| **Company** | Branches | NO dedicated page |
| **Admin** | Currencies | NO dedicated page |

> **Note:** As of last update, Inventory, Payroll, Credit Notes, Purchase PIs, Debit Notes, and Purchase Requisitions have been ADDED to the sidebar.

---

## PART 3: FORMS ANALYSIS

### Currently Defined Forms (fieldDefinitions.ts): 6 Forms

| Form | Fields | Field Names |
|------|--------|-------------|
| Invoice | 9 | customer, invoiceDate, dueDate, currency, exchangeRate, quantity, unitPrice, taxRate, description |
| Journal | 6 | date, description, debit, credit, account, reference |
| Payment | 5 | amount, account, method, reference, date |
| Product | 7 | code, name, category, unitPrice, costPrice, stockAmount, unit |
| Employee | 8 | firstName, lastName, email, phone, designation, department, salary, joinDate |
| Account | 6 | code, name, accountType, openingBalance, category, cashFlowType |

**Total Defined Fields: 41**

---

### Forms NOT Defined (Need to Add):

| Form | Fields to Define |
|------|------------------|
| **CustomerForm** | code, name, company, email, phone, address, city, country, contactPerson, tinVat, creditLimit, paymentTerms, currency, openingBalance, balanceType, portalEnabled |
| **VendorForm** | code, name, company, country, email, phone, address, city, contactPerson, tinVat, creditLimit, paymentTerms, currency, openingBalance, balanceType, portalEnabled |
| **SalesOrderForm** | soNumber, customer, soDate, expectedDeliveryDate, currency, exchangeRate, status, lines |
| **PurchaseOrderForm** | poNumber, supplier, poDate, expectedDeliveryDate, currency, exchangeRate, status, lines |
| **PIForm (Proforma Invoice)** | piNumber, customer/vendor, lcId, piDate, amount, currency, exchangeRate, status |
| **DeliveryNoteForm (DN/Challan)** | dnNumber, salesOrder, invoice, shipmentDate, status, lines |
| **GRNForm (Goods Received)** | grnNumber, purchaseOrder, invoice, receivedDate, status, lines |
| **CreditNoteForm** | creditNoteNumber, customer, invoice, salesOrder, creditNoteDate, reason, returnToStock, lines |
| **DebitNoteForm** | debitNoteNumber, vendor, bill, purchaseOrder, debitNoteDate, reason, returnToStock, lines |
| **LCForm** | lcNumber, bankName, amount, currency, conversionRate, issueDate, expiryDate, type, status, marginPercentage, commissionRate, shipmentDate |
| **LoanForm** | loanNumber, bankName, principalAmount, interestRate, repaymentTerm, monthlyInstallment, startDate, endDate, status |
| **FixedAssetForm** | assetNumber, assetName, description, category, purchaseDate, purchaseValue, salvageValue, usefulLife, depreciationMethod, depreciationRate |
| **EmployeeAdvanceForm** | employee, amount, purpose, date, paymentMethod, status |
| **EmployeeLoanForm** | employee, principalAmount, interestRate, installments, startDate, purpose, status |
| **PayrollRunForm** | runNumber, period, runDate, status, notes |
| **BranchForm** | name, code, address, phone, email, isMain, status |
| **ProjectForm** | code, name, isActive |
| **CostCenterForm** | code, name, isActive |
| **CurrencyForm** | code, name, symbol, isBase, isActive |
| **ExchangeRateForm** | fromCurrency, toCurrency, rate, rateDate, source |

**Total Forms Needing Definitions: 19**

---

## PART 4: FIELDS ANALYSIS

### Current Defined Fields: 41

| Form | Count | Fields |
|------|-------|--------|
| Invoice | 9 | customer, invoiceDate, dueDate, currency, exchangeRate, quantity, unitPrice, taxRate, description |
| Journal | 6 | date, description, debit, credit, account, reference |
| Payment | 5 | amount, account, method, reference, date |
| Product | 7 | code, name, category, unitPrice, costPrice, stockAmount, unit |
| Employee | 8 | firstName, lastName, email, phone, designation, department, salary, joinDate |
| Account | 6 | code, name, accountType, openingBalance, category, cashFlowType |

---

### Common Fields Across All Forms (Implicit - Not in fieldDefinitions.ts)

| Field | Type | Description |
|-------|------|-------------|
| id | uuid | Auto-generated primary key |
| companyId | uuid | Multi-tenant reference |
| branchId | uuid | Multi-branch reference (optional) |
| createdAt | datetime | Auto timestamp |
| updatedAt | datetime | Auto timestamp |
| deletedAt | datetime | Soft delete timestamp |
| status | string | DRAFT, PENDING_VERIFICATION, VERIFIED, PENDING_APPROVAL, APPROVED, REJECTED |
| createdById | uuid | Audit - created by |
| verifiedById | uuid | Audit - verified by |
| approvedById | uuid | Audit - approved by |
| rejectedById | uuid | Audit - rejected by |
| verifiedAt | datetime | Verification timestamp |
| approvedAt | datetime | Approval timestamp |
| rejectionReason | string | Rejection notes |
| notes | text | Additional notes |
| isJournaled | boolean | GL posting flag |
| journalId | uuid | Linked journal entry |

---

### Additional Fields by Entity

#### Customer Fields (not in fieldDefinitions.ts):
- code, companyId, email, phone, address, city, country, isActive
- contactPerson, tinVat, openingBalance, balanceType, creditLimit
- preferredCurrency, exchangeRate, paymentTerms, portalEnabled

#### Vendor Fields (not in fieldDefinitions.ts):
- code, companyId, country, email, phone, address, city, isActive
- contactPerson, tinVat, openingBalance, balanceType, creditLimit
- preferredCurrency, exchangeRate, paymentTerms, portalEnabled

#### Invoice Fields (not in fieldDefinitions.ts):
- invoiceNumber, type, subtotal, taxAmount, discountAmount, otherExpenses, total
- isProforma, paymentSplits, salesOrderId, purchaseOrderId
- originalInvoiceId (for reversals)

#### Product Fields (not in fieldDefinitions.ts):
- sku, description, isActive, type, currency

#### Employee Fields (not in fieldDefinitions.ts):
- employeeCode, isActive, paymentTerms

#### Account Fields (not in fieldDefinitions.ts):
- parentId (hierarchy), isActive, currentBalance, allowNegative, referenceId, currencyId

---

### Unused/Extra Fields in Schema (Cleanup Candidate)

| Model | Unused Fields |
|-------|---------------|
| User | blockedIps, forcePasswordReset, tokenVersion |
| Company | category |
| Invoice | originalInvoiceId |
| JournalEntry | originalJournalId |
| RecurringInvoice | (model exists but no UI) |
| EmployeeExpense | companyId, accountId, journalEntryId (inconsistent) |

---

## PART 5: FIELD TYPES ANALYSIS

### Current Field Types: 8

| Type | HTML Input | Examples |
|------|------------|----------|
| **text** | `type="text"` | Customer name, product name, account code |
| **number** | `type="number"` | Quantity, price, amount, exchange rate |
| **date** | `type="date"` | Invoice date, due date, join date |
| **checkbox** | `type="checkbox"` | isActive, isService, returnToStock |
| **radio** | `type="radio"` | Local/Foreign, payment method |
| **file** | `type="file"` | Attachments, backups, logo upload |
| **select** | `<select>` | Dropdowns for accounts, categories, currencies |
| **textarea** | `<textarea>` | Address, description, notes |

---

### Missing Field Types (Should Be Added): 8

| Type | HTML Input | Use Case |
|------|------------|----------|
| **email** | `type="email"` | Customer/vendor email, user email |
| **tel** | `type="tel"` | Phone numbers with validation |
| **url** | `type="url"` | Company website, portal links |
| **password** | `type="password"` | Login, change password forms |
| **color** | `type="color"` | Category color coding |
| **datetime-local** | `type="datetime-local"` | Timestamps with time |
| **month** | `type="month"` | Payroll period (YYYY-MM) |
| **week** | `type="week"` | Reporting periods |

---

### Field Type Implementation Issues

| Issue | Solution |
|-------|----------|
| Date fields lack time component | Add datetime picker component |
| Number fields lack precision | Add decimal_places config |
| Currency mixed with regular numbers | Create MoneyInput component |
| No rich text for descriptions | Add rich text editor for notes |

---

## PART 6: RECOMMENDATIONS

### High Priority Actions

#### 1. Add Missing Pages to Sidebar:
- [x] Inventory → Warehouses, Transfers, Reconciliation
- [x] HR → Payroll Run
- [x] Purchase → Purchase PIs, Debit Notes, Requisitions
- [x] Sales → Credit Notes

#### 2. Create Field Definitions:
- [ ] CustomerForm (16 fields)
- [ ] VendorForm (16 fields)
- [ ] SalesOrderForm (8 fields)
- [ ] PurchaseOrderForm (8 fields)
- [ ] LCForm (13 fields)
- [ ] LoanForm (8 fields)
- [ ] FixedAssetForm (10 fields)
- [ ] PayrollRunForm (5 fields)

#### 3. Remove Duplicate Pages:
- [x] Delete `/finance` page (empty) - REMOVED
- [x] Delete `/closing` page (use period-close) - REMOVED
- [x] Delete `/finance/bank-reconciliation` (use /bank/reconcile) - REMOVED
- [ ] Keep `/health` page (actually used by system health check)
- [ ] Keep `/invoices` page (used by notification panel)

#### 4. Add Missing Field Types:
- [ ] Create EmailInput component
- [ ] Create PhoneInput component
- [ ] Create UrlInput component
- [ ] Create ColorPicker component

### Medium Priority Actions

#### 5. Create Missing Pages:
- [ ] Branches management page
- [ ] Currencies management page
- [ ] Cost Centers page
- [ ] Projects page

#### 6. Add Employee Sub-Forms:
- [ ] Employee Advances UI
- [ ] Employee Expenses UI
- [ ] Employee Loans UI (separate from LC loans)

#### 7. Schema Cleanup:
- [ ] Remove unused fields from User model
- [ ] Fix EmployeeExpense schema inconsistency

### Low Priority Actions

#### 8. UI Component Improvements:
- [ ] Add rich text editor for notes fields
- [ ] Create MoneyInput with currency symbol
- [ ] Create DateTimePicker for timestamps
- [ ] Add month/week pickers for reporting

---

## FINAL SUMMARY

| Category | Current | Missing/Needed | Action |
|----------|---------|----------------|--------|
| **Pages** | 70 | +3 (branches, currencies, GL) | Clean up done |
| **Sidebar** | 33 items | Added 5 new items | DONE |
| **Forms** | 6 defined | +19 definitions needed | Create fieldDefinitions |
| **Fields** | 41 defined | +60+ in use | Expand definitions |
| **Field Types** | 8 | +8 new types | Add input components |

### Changes Applied (May 19, 2026):
- **Sidebar Updated**: Added Credit Notes, Purchase PIs, Debit Notes, Purchase Requisitions, Payroll, Inventory (Warehouses, Transfers, Reconciliation)
- **Pages Removed**: `/finance/page.tsx`, `/closing/page.tsx`, `/finance/bank-reconciliation/page.tsx`
- **Pages Kept**: `/health` (used by system), `/invoices` (used by notifications)

---

## DATABASE MODELS REFERENCE

The system supports these entities (from schema.prisma):

| Category | Models |
|----------|--------|
| **Auth & Users** | User, Role, UserRole, UserPermission, UserCompany |
| **Company** | Company, Branch, CompanySettings, DocumentSequence |
| **Accounting** | Account, AccountType, Project, CostCenter |
| **Customers/Vendors** | Customer, Vendor |
| **Sales** | SalesOrder, SalesOrderLine, DN, DNLine, CreditNote, CreditNoteLine |
| **Purchase** | PurchaseOrder, PurchaseOrderLine, GRN, GRNLine, Bill, DebitNote, DebitNoteLine |
| **Invoicing** | Invoice, InvoiceLine |
| **Journal** | JournalEntry, JournalEntryLine |
| **LC & Trade** | LC, PI, PILine, Loan |
| **Products** | Product |
| **Payments** | Payment, PaymentPI, PaymentInvoice |
| **HR/Payroll** | Employee, EmployeeAdvance, EmployeeLoan, EmployeeLoanRepayment, EmployeeExpense, PayrollRun, PayrollPayslip |
| **Assets** | FixedAsset |
| **Financial** | Currency, ExchangeRate |
| **Documents** | Attachment |
| **Audit** | ActivityLog, SystemAuditLog, Notification, BackupLog |
| **Recurring** | RecurringInvoice |