# AccaBiz - Accounting System

## Build Commands

```bash
# Backend
cd backend
npm run build    # npx prisma generate && tsc && npx prisma migrate deploy

# Frontend
cd frontend
npm run build    # next build
```

## Deploy

- **Backend**: Render.com - auto-deploys on `git push` to `okay` branch
- **Frontend**: Render.com - auto-deploys on `git push` to `okay` branch
- **Database**: Neon PostgreSQL (production)

## Database Migrations

- All migrations in `backend/prisma/migrations/`
- **Always run** `npx prisma migrate deploy` in build step - migrations are NOT auto-applied on production
- Create new migration: `npx prisma migrate dev --name migration_name`
- Manual migration file: create folder in migrations with `migration.sql`

## Known Issues & Fixes

> [!TIP]
> For a detailed list of potential issues and their solutions, refer to [TROUBLESHOOTING.md](file:///d:/BrainyFlavors/Accounting-Github/AccaBiz%20-%20Copy/TROUBLESHOOTING.md).

1. **Missing authenticate hook**: Company routes (`company.routes.ts`) must have `fastify.addHook('preHandler', authenticate)` - other route files (admin, owner, system) already have this
2. **Missing columns**: If Prisma throws "column does not exist", create migration to add missing columns (e.g., `LC.deletedAt`, `Account.referenceId`)
3. **Route 404**: Check if route exists in controller AND is registered in routes file

## Environment

- **Backend**: `backend/.env` - DATABASE_URL, JWT_SECRET, PORT
- **Frontend**: `frontend/.env.local` - NEXT_PUBLIC_API_URL
- Production API: `https://accabiz-backend.onrender.com/api`
- Production Frontend: `https://accabiz-frontend.onrender.com`

## Project Structure

```
backend/
  src/
    modules/          # Feature controllers & routes
    middleware/      # Auth, error handling
    config/          # Database config
    lib/             # Utilities
  prisma/
    schema.prisma    # Database schema
    migrations/      # SQL migrations

frontend/
  src/
    app/             # Next.js pages (App Router)
    components/      # Reusable UI components
    lib/             # API client, utilities
    data/            # Static data, field definitions
```

## Key Patterns

- **Auth**: JWT stored in localStorage, interceptor auto-logouts on 401
- **API**: Axios with baseURL `/api`, token in Authorization header
- **Forms**: InfoTooltip component in `components/InfoTooltip.tsx` with field definitions in `data/fieldDefinitions.ts`
- **Company context**: Dynamic company ID from URL params (`[id]`)

## Rollback

- Revert commits with `git revert` or `git reset`
- Render keeps deploy history - can manually rollback via Render dashboard