# AccaBiz Production Stability Checklist

This file tracks critical production issues, stabilization tasks, and their resolution status. 

> [!IMPORTANT]
> **Instructions for Agents:**
> 1. When you identify a new issue or error in logs, **immediately add it** to the `## Active Issues` section.
> 2. When you resolve an issue, **mark it as done [x]** and move it to the `## Resolved Tasks` section.
> 3. Always run the `Stability Validation` commands after a fix.

## 🚀 Session Startup Commands
Run these at the beginning of every session to ensure environment integrity:
```bash
# 1. Regenerate Prisma Client
cd backend && npx prisma generate

# 2. Verify TypeScript
cd backend && npx tsc --noEmit

# 3. Check Database Status
cd backend && npx prisma migrate status
```

---

## 🛠 Active Issues

- [x] **Audit Trail Validation**: Implemented `ActivityLogService` and integrated it into Branch and Fixed Asset workflows.
- [x] **Branch Verification**: Added status-based verification and approval workflow for branches.
- [x] **Fixed Asset Integrity**: Implemented verification, approval, and automated depreciation runs with journal entries.
- [ ] **Performance Audit**: Check query performance for large company datasets (Employees, Journals).
- [ ] **Performance Audit**: Check query performance for large company datasets (Employees, Journals).

---

## ✅ Resolved Tasks (Current Session)

- [x] **Soft-Delete Middleware Corruption**: Fixed recursive `deletedAt` injection into non-soft-delete models (Role, UserRole).
- [x] **Relational Query Syntax**: Refactored `OwnerController` to use `is: { name: 'Owner' }` for role filters.
- [x] **Settings 404 Error**: Registered `PUT /api/company/:id/settings` route in `company.routes.ts`.
- [x] **RBAC 400 Error**: Refactored `RBACController.updatePermission` to support both role-level toggle payloads and user-level overrides.
- [x] **Schema Mismatch**: Added `disallowFutureDates`, `lockPreviousMonths`, and `approvalWorkflow` to `CompanySettings` model and updated controller.
- [x] **IDE Type Synchronization**: Resolved stale Prisma types in controller using `as any` cast for `CompanySettings` upsert.
- [x] **Fixed Asset Integrity**: Added verification/approval workflow and automated depreciation journal generation.
- [x] **Branch Hardening**: Implemented branch verification and audit trails to ensure financial scoping integrity.
- [x] **Auto-COA Generation**: Standardized COA initialization based on company category (General, Manufacturing, Trading).
- [x] **Migration Stability**: Patched migration `20260515000003` to handle `deletedAt` column addition before partial indexing.

---

## 📝 Future Reference & Gotchas

- **Prisma Types**: After schema changes, `npx prisma generate` is required. If the IDE still shows errors despite `tsc` passing, use `as any` as a safe escape hatch for standard upserts.
- **Middleware**: Soft-delete middleware must NOT be recursive to avoid breaking queries on models without a `deletedAt` field.
- **RBAC Payload**: The Roles UI sends `{ module, permission, value }` while the backend usually expects `{ userId, module, canXxx... }`. The `RBACController` now handles both.
