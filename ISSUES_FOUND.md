# Issues Found in Current Documentation Update

This file captures issues found after auditing the current documentation-focused changes (especially `CHECKLIST.md` and related skill updates).

---

## 1) Incomplete Page Coverage in `CHECKLIST.md` (High)

The checklist claims to provide a comprehensive page inventory, but a path audit shows gaps.

- Total Next.js pages discovered: **73**
- Pages referenced in checklist inventory: **54**
- Missing from checklist: **19**

Missing page paths:

1. `frontend/src/app/admin/settings/account/page.tsx`
2. `frontend/src/app/admin/settings/backup/page.tsx`
3. `frontend/src/app/company/[id]/bank/reconcile/page.tsx`
4. `frontend/src/app/company/[id]/closing/page.tsx`
5. `frontend/src/app/company/[id]/invoices/page.tsx`
6. `frontend/src/app/company/[id]/journals/create/page.tsx`
7. `frontend/src/app/company/[id]/lc/create/export/page.tsx`
8. `frontend/src/app/company/[id]/products/[productId]/edit/page.tsx`
9. `frontend/src/app/company/[id]/products/create/page.tsx`
10. `frontend/src/app/company/[id]/purchase/invoices/create/page.tsx`
11. `frontend/src/app/company/[id]/purchase/orders/create/page.tsx`
12. `frontend/src/app/company/[id]/sales/challans/[challanId]/page.tsx`
13. `frontend/src/app/company/[id]/sales/invoices/create/page.tsx`
14. `frontend/src/app/company/[id]/sales/orders/create/page.tsx`
15. `frontend/src/app/company/[id]/settings/backup/page.tsx`
16. `frontend/src/app/company/[id]/settings/roles/page.tsx`
17. `frontend/src/app/owner/employees/page.tsx`
18. `frontend/src/app/owner/profile/page.tsx`
19. `frontend/src/app/page.tsx`

Impact:
- “Single source of truth” claim is currently inaccurate.
- QA/review using checklist can miss pages and related permission or field checks.

---

## 2) Grouped Path Notation Reduces Auditability (Medium)

Several checklist lines group multiple routes using shorthand (e.g., `+ /create` or `/settings/...`) instead of enumerating each file path.

Impact:
- Harder to validate coverage with automated tools.
- Increases risk of false confidence in route-by-route review.

---

## 3) Checklist Semantics vs. Runtime Truth (Medium)

Some entries assign generalized role/permission expectations (e.g., “Sales/Accountant approve”) that may not match actual backend RBAC configuration.

Impact:
- Readers may treat assumptions as actual enforced policy.
- Potential mismatch between docs and `requirePermission()` implementation.

Recommendation:
- Add a “Doc assumption” tag where permissions are inferred.
- Link each module section to the authoritative permission source.

---

## 4) Potential Drift Risk Between `CHECKLIST.md` and Route Tree (Medium)

No process is documented to keep checklist inventory synced with `frontend/src/app/**/page.tsx`.

Impact:
- New pages can be added without checklist updates.

Recommendation:
- Add a periodic route-diff check in CI or pre-commit:
  - compare discovered page files with listed checklist paths.

---

## Audit Method Used

The coverage issue was found by comparing:

- file-system route discovery: `frontend/src/app/**/page.tsx`
- page paths explicitly mentioned in backticks inside `CHECKLIST.md`

---

## 5) Missing or Misapplied Process/Triggers/Fields/Forms/Views/Pages

Based on the same route-to-checklist audit, the following practical gaps exist:

### A. Missing Forms (Create/Edit flows) — 8

These are high-risk because form screens are where field validation and business triggers are usually implemented.

1. `frontend/src/app/company/[id]/journals/create/page.tsx`
2. `frontend/src/app/company/[id]/lc/create/export/page.tsx`
3. `frontend/src/app/company/[id]/products/[productId]/edit/page.tsx`
4. `frontend/src/app/company/[id]/products/create/page.tsx`
5. `frontend/src/app/company/[id]/purchase/invoices/create/page.tsx`
6. `frontend/src/app/company/[id]/purchase/orders/create/page.tsx`
7. `frontend/src/app/company/[id]/sales/invoices/create/page.tsx`
8. `frontend/src/app/company/[id]/sales/orders/create/page.tsx`

Why this matters:
- Field-type/effect rules in `CHECKLIST.md` cannot be fully applied if these forms are not explicitly mapped.
- Validation and approval trigger expectations may be missed during QA.

### B. Missing Views/Pages — 11

1. `frontend/src/app/admin/settings/account/page.tsx`
2. `frontend/src/app/admin/settings/backup/page.tsx`
3. `frontend/src/app/company/[id]/bank/reconcile/page.tsx`
4. `frontend/src/app/company/[id]/closing/page.tsx`
5. `frontend/src/app/company/[id]/invoices/page.tsx`
6. `frontend/src/app/company/[id]/sales/challans/[challanId]/page.tsx`
7. `frontend/src/app/company/[id]/settings/backup/page.tsx`
8. `frontend/src/app/company/[id]/settings/roles/page.tsx`
9. `frontend/src/app/owner/employees/page.tsx`
10. `frontend/src/app/owner/profile/page.tsx`
11. `frontend/src/app/page.tsx`

Why this matters:
- Read-only/detail views still carry role/permission and UX obligations (filters, export, visibility control).
- Missing settings pages reduce coverage for sensitive operational controls.

### C. Missing Trigger-Sensitive Pages — 5

These pages are likely to contain critical operational triggers, but are not explicitly itemized in the checklist.

1. `frontend/src/app/admin/settings/backup/page.tsx` (backup/restore triggers)
2. `frontend/src/app/company/[id]/bank/reconcile/page.tsx` (reconciliation status triggers)
3. `frontend/src/app/company/[id]/closing/page.tsx` (period close/open triggers)
4. `frontend/src/app/company/[id]/settings/backup/page.tsx` (tenant backup triggers)
5. `frontend/src/app/company/[id]/settings/roles/page.tsx` (permission mutation triggers)

### D. Field Mapping Gaps (Process issue)

Even where a parent route is listed in `CHECKLIST.md`, grouped notation (e.g., “+ `/create`”) hides concrete create/edit paths.

Result:
- Field-level checklists become ambiguous at execution time.
- Process triggers (approve/verify/close/reconcile/backup) can be applied inconsistently.

### E. Recommended Fix Pattern

1. Enumerate **every** `page.tsx` path explicitly (no grouped shorthand).
2. Add a mandatory per-path mini-matrix:
   - key fields,
   - field types,
   - trigger events,
   - side effects,
   - required permissions.
3. Add CI route-sync check to fail when page inventory and checklist diverge.
