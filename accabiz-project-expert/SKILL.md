---
name: accabiz-project-expert
description: Comprehensive project knowledge for AccaBiz ERP, including architecture, build commands, environment setup, and common troubleshooting patterns.
---

# AccaBiz Project Expert Skill

This skill provides a high-level overview of the AccaBiz ERP project structure and operational procedures. Use it as the primary onboarding reference for any development or maintenance task.

## Project Architecture

AccaBiz is a full-stack accounting ERP system.

- **Backend**: Fastify (Node.js) + Prisma ORM + PostgreSQL (Neon/Local).
- **Frontend**: Next.js (App Router) + Tailwind CSS + TanStack Query.
- **Deployment**: Render.com (auto-deploys from `okay` branch).

### Directory Structure
- `backend/src/modules/company`: Core feature controllers (Invoices, Journals, LC, etc.).
- `backend/prisma/schema.prisma`: Source of truth for the database schema.
- `frontend/src/app/company/[id]`: Multi-tenant company context pages.
- `frontend/src/components`: Shared UI components (Sidebar, DetailPanel, etc.).

## Critical Commands

### Backend
```bash
cd backend
npm run dev      # Local development
npm run build    # Prisma generate + TSC + Migrate deploy
npx prisma migrate dev --name <name>  # Create migration
```

### Frontend
```bash
cd frontend
npm run dev      # Local development
npm run build    # Next.js production build
```

## Environment Configuration
- **Backend**: Requires `DATABASE_URL`, `JWT_SECRET`, and `SYSTEM_MODE` (LIVE/DEMO).
- **Frontend**: Requires `NEXT_PUBLIC_API_URL` pointing to the backend.

## Common Troubleshooting Patterns

1. **Prisma P2003 (Foreign Key)**: Usually caused by sending an empty string `""` for a customer/vendor ID. Controllers should convert these to `null`.
2. **TypeError: w.filter is not a function**: API returned an object or null instead of an array. Always wrap API responses with `Array.isArray()` guards in the frontend.
3. **Route 404**: Check if the route is registered in `company.routes.ts` AND has a corresponding controller method.
4. **Hydration Mismatch**: Ensure client-side components use the `mounted` state pattern to prevent SSR/CSR HTML differences.

## Design Standards
- **RBAC**: Every company-scoped action must be gated via `this.requirePermission`.
- **UX**: Use `DetailPanel` for side-sheet views to keep the user in the context of the list.
- **Data**: All financial values should be stored as `Float` in the DB and formatted using `toLocaleString()` in the UI.

---
*Created for the AccaBiz ERP Project*
