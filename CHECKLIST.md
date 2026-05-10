# AccaBiz Master Delivery Checklist

> Use this as the single source of truth for **pages, UI elements, field types/effects, user roles, and permissions**.

---

## A) Global Engineering Checklist

### 1. Accounting / Data Integrity
- [ ] Every journal is balanced (`SUM(debit) === SUM(credit)`).
- [ ] Auto-journal paths enforce idempotency (`isJournaled` or equivalent guard).
- [ ] Multi-step financial writes are wrapped in `prisma.$transaction()`.
- [ ] Closed-period validation exists for posting/approval flows.

### 2. Security / Access
- [ ] `authenticate` preHandler exists for all protected routes.
- [ ] `requirePermission()` is called at the start of sensitive actions.
- [ ] Company isolation is enforced (`companyId` scope).
- [ ] Sensitive fields are excluded from responses.

### 3. Testing / Quality
- [ ] Backend type-check passes.
- [ ] Frontend build passes.
- [ ] New/changed flow has at least one regression test.
- [ ] Permission-denied test exists for sensitive actions.

---

## B) Role & Permission Checklist

### User Roles (minimum expected)
- [ ] System Admin
- [ ] Owner
- [ ] Company Admin
- [ ] Accountant
- [ ] Sales
- [ ] Purchase
- [ ] Inventory
- [ ] HR/Payroll
- [ ] Viewer/Auditor

### Permission Matrix (apply per module)
- [ ] `view`
- [ ] `create`
- [ ] `update`
- [ ] `delete`
- [ ] `approve`
- [ ] `verify`
- [ ] `export` (reports/downloads)

---

## C) Field Types & Effect Rules (apply to all forms)

- [ ] **Text**: trims whitespace; empty string becomes `null` for optional fields.
- [ ] **Number/Currency**: numeric validation + precision handling; no NaN/Infinity.
- [ ] **Date**: valid date + period-lock checks where accounting impact exists.
- [ ] **Select/Relation**: invalid IDs rejected; optional relation supports `null`.
- [ ] **Status**: transitions validated (`DRAFT -> APPROVED`, etc.) with permission checks.
- [ ] **Boolean toggles**: side effects are explicit (journaling, stock movement, notifications).
- [ ] **File/Attachment**: type/size constraints + access checks.

---

## D) UI/UX Checklist (per page)

- [ ] Authentication guard and mounted-state handling for client pages.
- [ ] Clear page title + primary action button.
- [ ] Search/filter controls (where list data exists).
- [ ] Loading / empty / error states are present.
- [ ] Table semantics (`thead`, `tbody`, aligned numeric columns).
- [ ] Detail panel or modal preserves list context for view/edit.
- [ ] Keyboard reachable controls, visible focus, and labeled inputs.

---

## E) Page Inventory + Elements/Fields/Effects + Roles/Permissions

> Format: **Page** → Core Elements | Field Types | Field Effects | Roles/Permissions.

### Public / Authentication
- [ ] `frontend/src/app/page.tsx` → Landing content, navigation CTA | N/A | Route to login/dashboard | Public.
- [ ] `frontend/src/app/login/page.tsx` → Login form | email/text, password | session token issuance, redirect | Public (no auth required).

### Portal Pages
- [ ] `frontend/src/app/portal/[companyId]/customer/[token]/page.tsx` → Customer portal form/view | token, text, number, date | external customer action + document/status updates | Token-scoped access.
- [ ] `frontend/src/app/portal/[companyId]/vendor/[token]/page.tsx` → Vendor portal form/view | token, text, number, date | external vendor action + document/status updates | Token-scoped access.

### Admin / Owner
- [ ] `frontend/src/app/admin/dashboard/page.tsx` → KPI cards, quick links | filters/date range | dashboard aggregation only | System Admin (`view`).
- [ ] `frontend/src/app/admin/companies/page.tsx` → companies table + create/edit | text/select/status | tenant provisioning + settings updates | System Admin (`view/create/update`).
- [ ] `frontend/src/app/admin/owners/page.tsx` → owners list/form | text/email/role | owner account lifecycle | System Admin (`view/create/update/delete`).
- [ ] `frontend/src/app/admin/backups/page.tsx` → backup list/actions | date/select | backup create/restore operations | System Admin (`view/create`).
- [ ] `frontend/src/app/admin/audit-logs/page.tsx` → audit table + filters | date/text/select | read-only security audit visibility | System Admin (`view`).
- [ ] `frontend/src/app/admin/settings/page.tsx` → admin settings hub | text/toggle/select | platform config effects | System Admin (`view/update`).
- [ ] `frontend/src/app/admin/settings/account/page.tsx` → admin account settings | text/password/toggle | credential and profile config effects | System Admin (`view/update`).
- [ ] `frontend/src/app/admin/settings/backup/page.tsx` → admin backup settings/actions | select/date/toggle | backup/restore trigger effects | System Admin (`view/create/update`).
- [ ] `frontend/src/app/owner/dashboard/page.tsx` → owner KPI/dashboard | filters | aggregate visibility | Owner (`view`).
- [ ] `frontend/src/app/owner/companies/page.tsx` → owner company list | search/filter | scoped company access | Owner (`view`).
- [ ] `frontend/src/app/owner/owners/page.tsx` → owners management | text/email/select/status | owner account lifecycle effects | Owner (`view/update`, limited create/delete).
- [ ] `frontend/src/app/owner/employees/page.tsx` → owner employee management view | text/email/select/status | employee account/profile updates | Owner (`view/update`).
- [ ] `frontend/src/app/owner/profile/page.tsx` → owner profile settings | text/email/password | owner profile/security updates | Owner (`view/update`).

### Company Core
- [ ] `frontend/src/app/company/[id]/dashboard/page.tsx` → KPI cards/charts/activity | date/range filters | no transactional write by default | Company roles (`view`).
- [ ] `frontend/src/app/company/[id]/health/page.tsx` → system health indicators | N/A | diagnostic visibility | Company Admin/Auditor (`view`).
- [ ] `frontend/src/app/company/[id]/notifications/page.tsx` → notification list/actions | status/select | read/acknowledge state changes | Authenticated company users (`view/update`).
- [ ] `frontend/src/app/company/[id]/audit/page.tsx` → company audit logs | date/user/module filters | read-only traceability | Company Admin/Auditor (`view`).
- [ ] `frontend/src/app/company/[id]/settings/page.tsx` → company settings hub | text/toggle/select | tenant configuration effects | Company Admin (`view/update`).
- [ ] `frontend/src/app/company/[id]/settings/roles/page.tsx` → RBAC settings page | permission flags/selects | role-policy mutation triggers | Company Admin (`view/update`).
- [ ] `frontend/src/app/company/[id]/settings/backup/page.tsx` → company backup settings/actions | select/date/toggle | tenant backup/restore triggers | Company Admin (`view/update`).

### Accounting / Finance
- [ ] `frontend/src/app/company/[id]/accounts/page.tsx` → chart of accounts list/form | code/name/category/status | account structure changes; posting impact | Accountant/Admin (`view/create/update`).
- [ ] `frontend/src/app/company/[id]/journals/page.tsx` → journal list/view | date/status/amount filters | GL visibility and audit trace effects | Accountant (`view`).
- [ ] `frontend/src/app/company/[id]/journals/create/page.tsx` → journal entry create form | date/account/select/amount/line items | GL posting, balances affected | Accountant (`create/approve`).
- [ ] `frontend/src/app/company/[id]/finance/page.tsx` → finance hub | N/A | navigation only | Finance roles (`view`).
- [ ] `frontend/src/app/company/[id]/finance/period-close/page.tsx` → period close controls | period/date/status | period lock policy effects | Finance Admin (`view/approve/update`).
- [ ] `frontend/src/app/company/[id]/closing/page.tsx` → operational closing page | period/date/status | blocks posting in closed periods | Finance Admin (`view/approve/update`).
- [ ] `frontend/src/app/company/[id]/finance/bank-reconciliation/page.tsx` → bank reconciliation summary/workbench | date/amount/reference/status | reconciliation state + clearing effects | Accountant (`view/update/approve`).
- [ ] `frontend/src/app/company/[id]/bank/reconcile/page.tsx` → bank reconcile execution page | statement lines, match flags, amount/date refs | clearing/unreconciled status triggers | Accountant (`view/update/approve`).
- [ ] `frontend/src/app/company/[id]/finance/fixed-assets/page.tsx` → asset register/depreciation controls | text/date/currency/status | depreciation journal and asset lifecycle effects | Finance/Admin (`view/create/update/approve`).
- [ ] `frontend/src/app/company/[id]/receivables-search/page.tsx` → receivables lookup/filter | text/date/status | inquiry only unless collection action exists | Accountant/Sales (`view`).

### Sales
- [ ] `frontend/src/app/company/[id]/sales/customers/page.tsx` → customer master CRUD | text/email/phone/select/status | AR master data effects | Sales/Admin (`view/create/update`).
- [ ] `frontend/src/app/company/[id]/sales/orders/page.tsx` → sales order list/view | customer, date, status filters | sales pipeline visibility effects | Sales (`view`).
- [ ] `frontend/src/app/company/[id]/sales/orders/create/page.tsx` → sales order create form | customer, item, qty, price, date, status | commitments + inventory reservation (if configured) | Sales (`create/update/approve`).
- [ ] `frontend/src/app/company/[id]/sales/challans/page.tsx` → delivery challan list | quantities, warehouse, date/status | fulfillment visibility effects | Sales/Inventory (`view/create/update`).
- [ ] `frontend/src/app/company/[id]/sales/challans/[challanId]/page.tsx` → delivery challan detail view | line items, status, references | inventory movement + fulfillment trace | Sales/Inventory (`view/update`).
- [ ] `frontend/src/app/company/[id]/sales/invoices/page.tsx` → sales invoice list/view | customer, tax, totals, due date, status | invoicing visibility + approval workflow effects | Sales/Accountant (`view`).
- [ ] `frontend/src/app/company/[id]/sales/invoices/create/page.tsx` → sales invoice create form | customer, lines, tax, totals, due date | AR posting + revenue + journal effects | Sales/Accountant (`create/approve`).
- [ ] `frontend/src/app/company/[id]/invoices/page.tsx` → company invoices aggregate page | search/date/status totals | cross-module invoice visibility and navigation effects | Sales/Accountant (`view`).
- [ ] `frontend/src/app/company/[id]/sales/credit-notes/page.tsx` → credit note workflows | reason, lines, amounts, status | reversal of revenue/AR + optional stock return | Sales/Accountant (`view/create/approve`).
- [ ] `frontend/src/app/company/[id]/sales/pis/page.tsx` → proforma workflows | customer, lines, value/date/status | pre-invoice commitment; LC linkage candidate | Sales (`view/create/update`).

### Purchase / Payables
- [ ] `frontend/src/app/company/[id]/vendors/page.tsx` → vendor master CRUD | text/email/phone/select/status | AP master data effects | Purchase/Admin (`view/create/update`).
- [ ] `frontend/src/app/company/[id]/purchase/requisitions/page.tsx` → requisition lifecycle | requester, item, qty, priority, status | upstream approval chain effects | Purchase (`view/create/approve`).
- [ ] `frontend/src/app/company/[id]/purchase/orders/page.tsx` → purchase order list/view | vendor, qty/cost, date/status filters | PO visibility and approval workflow effects | Purchase (`view`).
- [ ] `frontend/src/app/company/[id]/purchase/orders/create/page.tsx` → purchase order create form | vendor, lines, qty, cost, date/status | commitments + expected payables | Purchase (`create/update/approve`).
- [ ] `frontend/src/app/company/[id]/purchase/invoices/page.tsx` → bill/AP invoice list | vendor, tax, totals, due date/status filters | AP invoice visibility and status effects | Purchase/Accountant (`view`).
- [ ] `frontend/src/app/company/[id]/purchase/invoices/create/page.tsx` → bill/AP invoice create form | vendor, tax, totals, due date/status | AP posting + expense/inventory valuation | Purchase/Accountant (`create/approve`).
- [ ] `frontend/src/app/company/[id]/purchase/debit-notes/page.tsx` → debit note workflows | reason, lines, amount/status | AP adjustments + potential stock effects | Purchase/Accountant (`view/create/approve`).
- [ ] `frontend/src/app/company/[id]/purchase/pis/page.tsx` → purchase PI workflows | vendor, lines, value/date/status | import/LC pipeline effect | Purchase (`view/create/update`).

### Payments / Banking
- [ ] `frontend/src/app/company/[id]/payments/make/page.tsx` → outbound payment form | payee, bank/cash account, amount, date, refs | AP settlement + cash/bank reduction + journals | Accountant (`create/approve`).
- [ ] `frontend/src/app/company/[id]/payments/receive/page.tsx` → inbound receipt form | payer, account, amount, date, refs | AR settlement + cash/bank increase + journals | Accountant (`create/approve`).
- [ ] `frontend/src/app/company/[id]/payments/allocate/page.tsx` → allocation grid | document refs, allocation amounts | updates invoice/bill outstanding and status | Accountant (`update/approve`).
- [ ] `frontend/src/app/company/[id]/payments/transfer/page.tsx` → account transfer form | from/to account, amount/date | internal bank/cash transfer journal | Accountant (`create/approve`).
- [ ] `frontend/src/app/company/[id]/payments/history/page.tsx` → payment history table | filters/date/status | read-only reporting | Accountant (`view`).

### Inventory / Products
- [ ] `frontend/src/app/company/[id]/products/page.tsx` → item master list | SKU, name, UOM, price, tax, status filters | product visibility/reporting effects | Inventory/Admin (`view`).
- [ ] `frontend/src/app/company/[id]/products/create/page.tsx` → product create form | SKU, name, UOM, price, tax, status | stock valuation/reporting basis | Inventory/Admin (`create`).
- [ ] `frontend/src/app/company/[id]/products/[productId]/edit/page.tsx` → product edit form | SKU, name, UOM, price, tax, status | product master update effects | Inventory/Admin (`update`).
- [ ] `frontend/src/app/company/[id]/inventory/warehouses/page.tsx` → warehouse master | name/location/status | stock location structure changes | Inventory/Admin (`view/create/update`).
- [ ] `frontend/src/app/company/[id]/inventory/transfers/page.tsx` → transfer form/list | from/to warehouse, item, qty, date | inter-warehouse stock movement | Inventory (`view/create/approve`).
- [ ] `frontend/src/app/company/[id]/inventory/reconciliation/page.tsx` → stock adjustment/reconciliation | item, counted qty, variance reason | inventory adjustment + accounting impact | Inventory/Accountant (`create/approve`).

### HR / Employees / Payroll
- [ ] `frontend/src/app/company/[id]/employees/page.tsx` → employee master CRUD | bio, role, payroll fields, status | payroll + payable mappings | HR/Admin (`view/create/update`).
- [ ] `frontend/src/app/company/[id]/hr/payroll/page.tsx` → payroll run controls | period, employee set, earnings/deductions | salary payable + expense journal generation | HR/Finance (`view/create/approve`).

### LC / Trade Finance
- [ ] `frontend/src/app/company/[id]/lc/page.tsx` → LC list/status | LC number, bank, amount, margin, status | trade finance lifecycle | Finance/Purchase (`view/create/update`).
- [ ] `frontend/src/app/company/[id]/lc/create/import/page.tsx` → import LC create form | party/bank/value/currency/date/docs | establishes import LC commitments/margin effects | Finance/Purchase (`create/approve`).
- [ ] `frontend/src/app/company/[id]/lc/create/export/page.tsx` → export LC create form | party/bank/value/currency/date/docs | establishes export LC commitments/margin effects | Finance/Purchase (`create/approve`).
- [ ] `frontend/src/app/company/[id]/lc/pis/page.tsx` → PI-LC mapping grid | PI select, allocation amount | LC utilization control | Finance/Purchase (`update/approve`).
- [ ] `frontend/src/app/company/[id]/lc/settlement/page.tsx` → settlement form | settlement amount/rate/date/charges | realized FX + liability settlement postings | Finance (`create/approve`).
- [ ] `frontend/src/app/company/[id]/lc/loans/page.tsx` → loan drawdown/repayment | bank, principal, interest, date | loan liability and finance cost postings | Finance (`create/approve`).
- [ ] `frontend/src/app/company/[id]/finance/lc/[lcId]/page.tsx` → LC detail analytics | filters, line-level references | read + operational actions by permission | Finance (`view`, scoped update).

### Reports
- [ ] `frontend/src/app/company/[id]/reports/page.tsx` → report filters + export | date range, account/module filters, format select | read-only analytics, export output | Accountant/Auditor (`view/export`).

---

## F) Quick Validation Commands

```bash
# Backend
cd backend && npx tsc --noEmit
cd backend && npm run build

# Frontend
cd frontend && npm run build

# Security spot-check
rg "requirePermission\\(|addHook\\('preHandler', authenticate\\)" backend/src

# Update project memory after checklist/doc updates
node hooks/memory-update.js --update --file="CHECKLIST.md" --feature="Added page inventory with elements, fields, effects, roles, permissions, UI/UX checklists"
```
