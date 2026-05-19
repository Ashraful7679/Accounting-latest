# AccaBiz - Page, Form, Field & Field Type Analysis

Generated: May 19, 2026

---

## PART 1: PAGES ANALYSIS

### Current State: 76 Pages

| Section | Count |
|---------|-------|
| Root/Login | 1 |
| Admin | 6 |
| Owner | 4 |
| Company (Dynamic) | 63 |
| Portal | 2 |

### Current Sidebar Navigation (Company): 28 Menu Items

```
1. Dashboard
2. Chart of Accounts
3. Sales
   ├── Customers
   ├── Sales Orders
   ├── Proforma Invoice
   ├── Delivery Notes
   ├── Sales Invoices
   └── Collections (Receive Payment)
4. Purchase
   ├── Suppliers
   ├── Purchase Orders
   └── Purchase Invoices
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
10. Finance
    ├── Fixed Assets
    ├── Period Closing
    └── Bank Reconciliation
11. Reports
12. Roles
13. Backup
```

---

## PART 2: MISSING PAGES (Should Exist)

Based on database schema, these modules exist but are NOT in sidebar or have no UI:

### Missing from Sidebar:

| Module | Model | Status |
|--------|-------|--------|
| **Inventory** | | |
| Warehouses | Warehouse (schema only) | Page exists, NOT in sidebar |
| Stock Transfers | (part of inventory) | Page exists, NOT in sidebar |
| Stock Reconciliation | (part of inventory) | Page exists, NOT in sidebar |
| **HR/Payroll** | | |
| Payroll Run | PayrollRun, PayrollPayslip | Page exists, NOT in sidebar |
| Employee Advances | EmployeeAdvance | NO page |
| Employee Loans | EmployeeLoan | Page exists under LC loans (confusing) |
| Employee Expenses | EmployeeExpense | NO page |
| **Purchase** | | |
| Purchase Requisitions | (part of PO workflow) | Page exists, NOT in sidebar |
| Purchase PIs | PI (Purchase) | Page exists, NOT in sidebar |
| Debit Notes | DebitNote | Page exists, NOT in sidebar |
| GRN (Goods Received) | GRN | NO dedicated page |
| **Sales** | | |
| Credit Notes | CreditNote | Page exists, NOT in sidebar |
| **Finance** | | |
| General Ledger | (part of accounts) | Page exists (journals), NOT as GL view |
| Currency/Exchange Rates | Currency, ExchangeRate | NO page |
| Cost Centers | CostCenter | NO page |
| Projects | Project | NO page |
| **Company Settings** | | |
| Branches | Branch | NO page |
| Document Sequences | DocumentSequence | NO page |
| **Admin** | | |
| Employees (Admin) | User | Page exists, NOT in sidebar |
| Currencies | Currency | NO page |
| Backups | BackupLog | Page exists in Admin settings |

### Pages to REMOVE (Unused/Redundant):

| Page | Reason |
|------|--------|
| `health/page.tsx` | Unused health check page |
| `invoices/page.tsx` | Duplicate of sales/invoices |
| `receivables-search/page.tsx` | Could be integrated into Reports |
| `finance/page.tsx` | Empty/Unused placeholder |
| `finance/bank-reconciliation/page.tsx` | Duplicate, actual is `/bank/reconcile` |
| `closing/page.tsx` | Duplicate of period-close |
| `lc/pis/page.tsx` | Should be under Purchase PIs |
| `admin/owners/page.tsx` | Should be under company owner management |

---

## PART 3: FORMS ANALYSIS

### Current Defined Forms (fieldDefinitions.ts): 6 Forms

| Form | Fields | Description |
|------|--------|-------------|
| Invoice | 9 | Sales/Purchase invoices |
| Journal | 6 | Journal entries |
| Payment | 5 | Receive/Make payments |
| Product | 7 | Product catalog |
| Employee | 8 | Employee management |
| Account | 6 | Chart of accounts |

**Total Defined Fields: 41**

---

### Forms NOT in fieldDefinitions.ts (Should Be Added):

| Form | Fields to Define |
|------|-------------------|
| Customer | name, company, code, email, phone, address, tinVat, creditLimit, paymentTerms, currency, openingBalance |
| Vendor | name, company, code, country, email, phone, address, tinVat, creditLimit, paymentTerms, currency, openingBalance |
| Sales Order | soNumber, customer, date, expectedDelivery, currency, exchangeRate, status, lines |
| Purchase Order | poNumber, supplier, date, expectedDelivery, currency, exchangeRate, status, lines |
| Proforma Invoice (PI) | piNumber, customer/vendor, lc, date, amount, currency, exchangeRate, status |
| Delivery Note (Challan/DN) | dnNumber, salesOrder, invoice, shipmentDate, status, lines |
| GRN | grnNumber, purchaseOrder, invoice, receivedDate, status, lines |
| Credit Note | creditNoteNumber, customer, invoice, date, reason, returnToStock, lines |
| Debit Note | debitNoteNumber, vendor, bill, date, reason, returnToStock, lines |
| LC | lcNumber, bankName, amount, currency, issueDate, expiryDate, type, status, margin, commission |
| Loan | loanNumber, bankName, principal, interestRate, term, startDate, status |
| Fixed Asset | assetNumber, assetName, category, purchaseDate, value, salvageValue, usefulLife, depreciationMethod |
| Employee Advance | employee, amount, purpose, date, paymentMethod, status |
| Employee Loan | employee, principal, interestRate, installments, startDate, purpose, status |
| Payroll Run | period, runDate, status, totalGross, totalDeductions, totalNet |
| Branch | name, code, address, phone, email, isMain, status |
| Project | code, name, isActive |
| Cost Center | code, name, isActive |
| Currency | code, name, symbol, isBase, isActive |
| Exchange Rate | fromCurrency, toCurrency, rate, rateDate, source |

---

### Forms with EXTRAS (Should Be Removed/Cleaned):

| Form | Issue |
|------|-------|
| Duplicate Invoice forms | Both `/sales/invoices` and `/invoices` exist |
| Duplicate Bank Reconciliation | Both `/finance/bank-reconciliation` and `/bank/reconcile` exist |
| Duplicate Closing | Both `/closing` and `/finance/period-close` exist |
| LC PIs mixed | PIs for LC are under both sales and purchase, should be consolidated |

---

## PART 4: FIELDS ANALYSIS

### Current Defined Fields: 41

| Form | Field Names |
|------|-------------|
| Invoice (9) | customer, invoiceDate, dueDate, currency, exchangeRate, quantity, unitPrice, taxRate, description |
| Journal (6) | date, description, debit, credit, account, reference |
| Payment (5) | amount, account, method, reference, date |
| Product (7) | code, name, category, unitPrice, costPrice, stockAmount, unit |
| Employee (8) | firstName, lastName, email, phone, designation, department, salary, joinDate |
| Account (6) | code, name, accountType, openingBalance, category, cashFlowType |

---

### Missing Fields (Not in fieldDefinitions.ts but used in forms):

#### Common Fields Across Forms:
- id (auto-generated)
- createdAt, updatedAt (auto)
- deletedAt (soft delete)
- status (DRAFT, PENDING, APPROVED, REJECTED, etc.)
- createdById, verifiedById, approvedById (audit)
- companyId (multi-tenant)
- branchId (multi-branch)
- notes, remarks
- attachments (file uploads)
- isJournaled (accounting flag)
- journalId (link to GL)

#### Customer Additional Fields:
- contactPerson, city, country, preferredCurrency, balanceType, portalEnabled

#### Vendor Additional Fields:
- contactPerson, city, country, preferredCurrency, balanceType, portalEnabled

#### Invoice Additional Fields:
- type (SALES/PURCHASE), subtotal, taxAmount, discountAmount, otherExpenses, total
- isProforma, paymentSplits, salesOrderId, purchaseOrderId
- verifiedAt, approvedAt, rejectionReason

#### Journal Additional Fields:
- entryNumber (auto), totalDebit, totalCredit
- currencyId, exchangeRate
- verifiedById, approvedById, rejectedById

#### Payment Additional Fields:
- paymentNumber (auto), status
- customerId, vendorId, invoiceId, billId, lcId
- debitNotes, creditNotes allocations

#### Product Additional Fields:
- sku, description, isActive, type, currency

#### Employee Additional Fields:
- employeeCode, isActive, paymentTerms

#### Account Additional Fields:
- parentId (hierarchy), isActive, currentBalance, allowNegative, referenceId, currencyId

---

### Extra/Unused Fields (Schema bloat):

| Model | Unused Fields |
|-------|---------------|
| User | blockedIps, forcePasswordReset, tokenVersion (security audit needed) |
| Company | category (unused) |
| Invoice | originalInvoiceId (not fully implemented) |
| JournalEntry | originalJournalId (not fully implemented) |
| RecurringInvoice | (model exists but no UI) |
| EmployeeExpense | companyId, accountId, journalEntryId (schema inconsistency) |

---

## PART 5: FIELD TYPES ANALYSIS

### Current Field Types: 8

| Type | HTML Input | Usage |
|------|------------|-------|
| text | `type="text"` | Names, codes, descriptions |
| number | `type="number"` | Amounts, quantities, rates |
| date | `type="date"` | Dates (invoiceDate, dueDate, etc.) |
| checkbox | `type="checkbox"` | Booleans (isActive, returnToStock) |
| radio | `type="radio"` | Choices (payment method, status) |
| file | `type="file"` | Attachments, logos |
| select | `<select>` | Dropdowns (accounts, categories) |
| textarea | `<textarea"` | Long text (address, notes) |

### Missing Field Types:

| Type | Description | Should Be Added |
|------|-------------|-----------------|
| **email** | `type="email"` | Email validation for contact fields |
| **tel** | `type="tel"` | Phone number validation |
| **url** | `type="url"` | Website fields |
| **password** | `type="password"` | Login/change password |
| **color** | `type="color"` | Category color coding |
| **range** | `type="range"` | Filter sliders |
| **datetime-local** | `type="datetime-local"` | timestamps with time |
| **month** | `type="month"` | Payroll period |
| **week** | `type="week"` | Reporting periods |

### Field Type Consolidation Issues:

| Issue | Solution |
|-------|----------|
| Date fields use `type="date"` but need time | Add datetime picker component |
| Number fields lack precision control | Add decimal_places config |
| Currency fields mixed with regular numbers | Create MoneyInput component |
| No rich text for description fields | Add rich text editor for notes |

---

## PART 6: RECOMMENDATIONS

### Pages to ADD to Sidebar:
1. Inventory → Warehouses, Transfers, Reconciliation
2. HR → Payroll Run, Advances, Expenses
3. Purchase → Requisitions, PIs, Debit Notes
4. Sales → Credit Notes
5. Finance → General Ledger View, Currencies, Cost Centers, Projects
6. Company → Branches, Settings
7. Admin → Employees (global), Currencies

### Pages to REMOVE:
1. `/health` - unused
2. `/invoices` - duplicate
3. `/finance` - empty
4. `/finance/bank-reconciliation` - duplicate
5. `/closing` - duplicate

### Forms to ADD to fieldDefinitions.ts:
1. CustomerForm
2. VendorForm
3. SalesOrderForm
4. PurchaseOrderForm
5. PIForm
6. DeliveryNoteForm
7. GRNForm
8. CreditNoteForm
9. DebitNoteForm
10. LCForm
11. LoanForm
12. FixedAssetForm
13. EmployeeAdvanceForm
14. EmployeeLoanForm
15. PayrollRunForm
16. BranchForm
17. ProjectForm
18. CostCenterForm
19. CurrencyForm

### Field Types to ADD:
1. email (with validation)
2. tel (phone)
3. url (website)
4. password
5. color (for categories)
6. datetime-local
7. month (for payroll)
8. week (for periods)

---

## SUMMARY TABLE

| Category | Current | Missing | Extra/Remove |
|----------|---------|---------|--------------|
| **Pages** | 76 | ~15 (sidebar) | 5 (duplicates) |
| **Forms** | 6 defined | ~19 (need definitions) | - |
| **Fields** | 41 defined | ~100+ (actual usage) | ~10 (unused schema) |
| **Field Types** | 8 | 8 (new input types) | - |

---

## ACTION ITEMS

### High Priority:
1. [ ] Add missing modules to sidebar navigation
2. [ ] Create field definitions for all major forms
3. [ ] Remove duplicate pages
4. [ ] Add missing field types (email, tel, url)

### Medium Priority:
5. [ ] Create dedicated pages for: Branches, Currencies, Cost Centers, Projects
6. [ ] Add Employee Advances/Expenses UI
7. [ ] Clean up unused schema fields

### Low Priority:
8. [ ] Add rich text editor for notes
9. [ ] Create MoneyInput component
10. [ ] Add datetime picker component