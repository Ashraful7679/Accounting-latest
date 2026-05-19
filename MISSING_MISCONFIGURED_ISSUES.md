# AccaBiz - Missing & Misconfigured Implementations

Generated: May 19, 2026

---

## EXECUTIVE SUMMARY

| Priority | Count | Status |
|----------|-------|--------|
| HIGH | 3 | Critical issues requiring immediate attention |
| MEDIUM | 2 | Features partially implemented or broken |
| LOW | 3 | UI/UX inconsistencies |

---

## PART 1: HIGH PRIORITY ISSUES

### 1.1 FRONTEND - Missing Permission Checks (50+ pages)

**Problem:** Only 4 out of 60+ company pages use the `usePermissions` hook. Any authenticated user can access and modify any company data without proper RBAC.

**Pages WITH permission checks (4):**
- `frontend/src/app/company/[id]/hr/payroll/page.tsx`
- `frontend/src/app/company/[id]/employees/page.tsx`
- `frontend/src/app/company/[id]/sales/orders/page.tsx`
- `frontend/src/app/company/[id]/finance/period-close/page.tsx`

**Pages MISSING permission checks (critical):**
| Module | Page | File |
|--------|------|------|
| **Accounts** | Chart of Accounts | `accounts/page.tsx` |
| **Sales** | Customers | `sales/customers/page.tsx` |
| **Sales** | Invoices | `sales/invoices/page.tsx` |
| **Sales** | Sales Orders | `sales/orders/page.tsx` |
| **Sales** | PIs | `sales/pis/page.tsx` |
| **Sales** | Challans | `sales/challans/page.tsx` |
| **Sales** | Credit Notes | `sales/credit-notes/page.tsx` |
| **Purchase** | Vendors | `vendors/page.tsx` |
| **Purchase** | Purchase Orders | `purchase/orders/page.tsx` |
| **Purchase** | Purchase Invoices | `purchase/invoices/page.tsx` |
| **Purchase** | Purchase PIs | `purchase/pis/page.tsx` |
| **Purchase** | Debit Notes | `purchase/debit-notes/page.tsx` |
| **Purchase** | Requisitions | `purchase/requisitions/page.tsx` |
| **Payments** | Receive | `payments/receive/page.tsx` |
| **Payments** | Make | `payments/make/page.tsx` |
| **Payments** | Transfer | `payments/transfer/page.tsx` |
| **Payments** | History | `payments/history/page.tsx` |
| **Payments** | Allocate | `payments/allocate/page.tsx` |
| **Journal** | Entries | `journals/page.tsx` |
| **Products** | Catalog | `products/page.tsx` |
| **Finance** | Fixed Assets | `finance/fixed-assets/page.tsx` |
| **Finance** | Bank Reconcile | `bank/reconcile/page.tsx` |
| **LC** | Overview | `lc/page.tsx` |
| **LC** | Create Import | `lc/create/import/page.tsx` |
| **LC** | Create Export | `lc/create/export/page.tsx` |
| **LC** | Loans | `lc/loans/page.tsx` |
| **LC** | Settlement | `lc/settlement/page.tsx` |
| **LC** | PIs | `lc/pis/page.tsx` |
| **Inventory** | Warehouses | `inventory/warehouses/page.tsx` |
| **Inventory** | Transfers | `inventory/transfers/page.tsx` |
| **Inventory** | Reconciliation | `inventory/reconciliation/page.tsx` |
| **Reports** | All Reports | `reports/page.tsx` |
| **Settings** | Roles | `settings/roles/page.tsx` |
| **Settings** | Backup | `settings/backup/page.tsx` |
| **Audit** | Activity | `audit/page.tsx` |
| **Notifications** | All | `notifications/page.tsx` |

**Fix Required:** Add `usePermissions` hook to each page with module-specific permissions like:
- `sales.customers`
- `sales.invoices`
- `purchase.vendors`
- `finance.journals`
- `inventory.products`

---

### 1.2 BACKEND - Missing Inventory API Endpoints

**Problem:** Frontend calls inventory APIs that don't exist in backend.

| Frontend Call | Used In | Status |
|---------------|---------|--------|
| `GET /company/{id}/warehouses` | `inventory/warehouses/page.tsx` | **MISSING** |
| `POST /company/{id}/warehouses` | `inventory/warehouses/page.tsx` | **MISSING** |
| `PUT /company/{id}/warehouses/{id}` | `inventory/warehouses/page.tsx` | **MISSING** |
| `DELETE /company/{id}/warehouses/{id}` | `inventory/warehouses/page.tsx` | **MISSING** |
| `GET /company/{id}/stock-transfers` | `inventory/transfers/page.tsx` | **MISSING** |
| `POST /company/{id}/stock-transfers` | `inventory/transfers/page.tsx` | **MISSING** |
| `GET /company/{id}/inventory/reconciliation` | Sidebar navigation | **MISSING** |

**No Warehouse Model exists in schema.prisma**

**Fix Required:** 
1. Create `Warehouse` model in schema.prisma
2. Create inventory controller with CRUD endpoints
3. Register routes in company.routes.ts

---

### 1.3 BACKEND - Missing Stock Transfer API Endpoints

**Problem:** Stock transfer functionality doesn't exist.

| Needed Endpoint | Purpose |
|-----------------|---------|
| `POST /company/{id}/stock-transfers` | Create stock transfer between warehouses |
| `GET /company/{id}/stock-transfers` | List all transfers |
| `PUT /company/{id}/stock-transfers/{id}/approve` | Approve/reject transfer |
| `GET /company/{id}/inventory/reconciliation` | Get inventory counts for reconciliation |

**Fix Required:** Implement stock transfer workflow with approval process.

---

## PART 2: MEDIUM PRIORITY ISSUES

### 2.1 DATABASE - Unused RecurringInvoice Model

**Problem:** Model exists in schema but is never used.

| Location | Details |
|----------|---------|
| `backend/prisma/schema.prisma` | Lines 1845-1869 |
| `backend/src/config/prisma-middleware.ts` | Referenced but not used |

**No frontend page exists**
**No backend controller handles it**

**Fix Required:** Either implement the feature or remove from schema:
- Option A: Create UI and backend for recurring invoice generation
- Option B: Remove from schema to reduce confusion

---

### 2.2 INVENTORY MODULE - Non-Functional

**Problem:** Sidebar shows inventory options that return 404 errors.

```
Inventory 
├── Warehouses     → 404 Error
├── Transfers     → 404 Error  
└── Reconciliation → 404 Error
```

**Root Cause:** No backend endpoints, no database models, no controller logic.

**Fix Required:**
1. Create Warehouse model and API
2. Create StockTransfer model and API
3. Create InventoryReconciliation functionality

---

## PART 3: LOW PRIORITY ISSUES

### 3.1 UI/UX - Inconsistent Button Labels

| Page | Current Label | Should Be |
|------|--------------|-----------|
| Owner Users | Add User | Consistent with other "Add" buttons |
| Company Products | Add Product | Could be "New Product" |
| Payments Receive | - | Consistent terminology |

### 3.2 UI/UX - Missing Loading States

Pages missing proper loading indicators:
- `company/[id]/dashboard/page.tsx`
- `company/[id]/accounts/page.tsx`
- `company/[id]/journals/page.tsx`

### 3.3 UI/UX - Incomplete Error Handling

Some pages don't handle API failures gracefully:
- No toast notifications for failed operations
- No retry buttons for failed requests

---

## PART 4: DATA INTEGRITY CONCERNS

### 4.1 Journal Entry Balance Not Enforced

**Problem:** No database constraint to ensure `totalDebit === totalCredit`

**Current:** Application-level validation only
**Risk:** Manual journal entries could be unbalanced

**Recommendation:** Add CHECK constraint in migration:
```sql
ALTER TABLE "JournalEntry" ADD CONSTRAINT balanced_entry 
CHECK (totalDebit = totalCredit);
```

### 4.2 Account Balance Drift Risk

**Problem:** `Account.currentBalance` is updated manually in application code

**Risk:** If code fails mid-transaction, balance becomes inconsistent

**Recommendation:** Use triggers or computed columns instead of manual updates

### 4.3 Employee Code Uniqueness

**Problem:** No database-level uniqueness constraint on `Employee.employeeCode`

**Risk:** Could create duplicate employee codes

**Recommendation:** Add unique index on `(companyId, employeeCode)`

---

## PART 5: ACTION ITEMS

### Immediate (Fix Today)

| # | Action | Files |
|---|--------|-------|
| 1 | Add usePermissions hook to all company pages | ~50 files in `frontend/src/app/company/[id]/` |
| 2 | Create Warehouse model and API | New file + routes |
| 3 | Create StockTransfer model and API | New file + routes |

### Short-term (This Week)

| # | Action | Files |
|---|--------|-------|
| 4 | Implement or remove RecurringInvoice | schema.prisma + frontend |
| 5 | Add loading states to all pages | Various |
| 6 | Fix error handling | Various |

### Long-term (This Month)

| # | Action | Files |
|---|--------|-------|
| 7 | Add database constraints | New migration |
| 8 | Add unit tests | Test files |
| 9 | Audit trail verification | Throughout |

---

## PART 6: VERIFICATION CHECKLIST

Use this to track fixes:

- [ ] Add usePermissions to accounts page (module: finance.accounts)
- [ ] Add usePermissions to sales/invoices page (module: sales.invoices)
- [ ] Add usePermissions to sales/customers page (module: sales.customers)
- [ ] Add usePermissions to purchase/vendors page (module: purchase.vendors)
- [ ] Add usePermissions to journals page (module: finance.journals)
- [ ] Add usePermissions to products page (module: inventory.products)
- [ ] Add usePermissions to payments/receive page (module: payments.receive)
- [ ] Add usePermissions to payments/make page (module: payments.make)
- [ ] Add usePermissions to LC pages (module: lc.*)
- [ ] Create Warehouse model and API endpoints
- [ ] Create StockTransfer model and API endpoints
- [ ] Implement or remove RecurringInvoice