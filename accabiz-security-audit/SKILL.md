---
name: accabiz-security-audit
description: Expert security auditing for AccaBiz ERP, covering RBAC, Prisma integrity, Fastify security, and data protection.
---

# AccaBiz Security Audit Skill

This skill is designed for proactive security assessment and hardening of the AccaBiz ERP system. Use it when reviewing new features, auditing permissions, or investigating potential vulnerabilities.

## Core Security Pillars

### 1. Granular RBAC (Role-Based Access Control)
AccaBiz uses a module-aware RBAC system managed by `RBACService`.
- **Resolution Path**: System Admin Bypass -> User-Specific Override -> Module Template.
- **Audit Steps**: 
    - Ensure `company.routes.ts` has the `authenticate` hook on **ALL** company-scoped routes. This is a known issue - check if `fastify.addHook('preHandler', authenticate)` is present at the top of the routes file.
    - Verify that sensitive actions (Approve, Verify) require specific permission flags beyond simple 'create' or 'update'.
    - Check for "Insecure Direct Object Reference" (IDOR) by verifying that `companyId` in the URL matches the user's authorized company list.

### 2. Database Integrity (Prisma)
- **Foreign Key Safety**: Always convert empty strings from client inputs to `null` for optional relations to prevent `P2003` violations.
- **SQL Injection**: Prisma handles parameterization, but ensure that any `prisma.$queryRaw` calls are properly parameterized and never use string interpolation with user input.
- **Soft Deletes**: Verify that sensitive entities (Journals, Ledger Accounts) use the `deletedAt` pattern rather than hard deletion where audit trails are required.

### 3. API Security (Fastify)
- **CORS Configuration**: Ensure `fastify-cors` is restricted to authorized domains (e.g., `accabiz-frontend.onrender.com`).
- **Input Validation**: Use JSON Schema or explicit controller-level validation for all request bodies.
- **Global Error Handling**: Catch and sanitize errors in `errorHandler.ts` to avoid leaking database internals (stack traces, raw SQL) to the client.

### 4. Financial Audit Integrity
- **Optimistic Locking**: Use `version` or `updatedAt` checks in `order.controller.ts` and `transaction.controller.ts` to prevent race conditions during status changes.
- **Ledger Immutability**: Once a Journal is `APPROVED`, ensure it is locked from modification. Any corrections must be done via `REVERSING` or `CORRECTION` journals.

## Audit Workflow

1. **Route Audit**: Check `company.routes.ts` for missing `preHandler` hooks.
2. **Permission Check**: Verify that `requirePermission` is called at the start of all controller methods.
3. **Data Leakage Check**: Ensure that `findMany` queries for Users or Staff don't return sensitive fields like `password` (hashed) or `JWT_SECRET` (if stored).
4. **Log Analysis**: Check `SystemAuditLog` for unexpected permission escalations or unauthorized access attempts.

---
*Created for the AccaBiz ERP Project*
