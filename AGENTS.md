# AccaBiz - Accounting System

## Project Memory

> [!IMPORTANT]
> After making code changes, ALWAYS update the project memory by running:
> ```bash
> node hooks/memory-update.js --update --file="relative/path.ts" --feature="description of change"
> ```

Example after modifying `journal.service.ts`:
```bash
node hooks/memory-update.js --update --file="backend/src/modules/accounting/journal.service.ts" --feature="Added CREDIT_NOTE and DEBIT_NOTE auto-journal support"
```

Current memory state: `.project-memory.json`

---

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
    middleware/        # Auth, error handling
    config/           # Database config
    lib/              # Utilities
  prisma/
    schema.prisma      # Database schema
    migrations/       # SQL migrations

frontend/
  src/
    app/              # Next.js pages (App Router)
    components/       # Reusable UI components
    lib/              # API client, utilities
    data/             # Static data, field definitions
```

## Key Patterns

- **Auth**: JWT stored in localStorage, interceptor auto-logouts on 401
- **API**: Axios with baseURL `/api`, token in Authorization header
- **Forms**: InfoTooltip component in `components/InfoTooltip.tsx` with field definitions in `data/fieldDefinitions.ts`
- **Company context**: Dynamic company ID from URL params (`[id]`)

## Rollback

- Revert commits with `git revert` or `git reset`
- Render keeps deploy history - can manually rollback via Render dashboard

## Memory Hook Usage

> [!IMPORTANT]
> After making code changes, ALWAYS update the project memory by running:
> ```bash
> node hooks/memory-update.js --update --file="relative/path.ts" --feature="description of change"
> ```

### For Coding Agents

After any code modification, run:

```bash
# Single file change
node hooks/memory-update.js --update --file="path/to/file.ts" --feature="What was changed"

# Add implementation record
node hooks/memory-update.js --impl --key="feature-name" --desc="Description" --files="file1.ts,file2.ts"

# List recent changes
node hooks/memory-update.js --list --limit=10

# Read full memory
node hooks/memory-update.js --read
```

### Error Prevention Checklist

Before committing any code, verify:

- [ ] **Double-Entry**: SUM(debit) === SUM(credit) for all journals
- [ ] **Idempotency**: Check `isJournaled` flag before auto-journaling
- [ ] **Transactions**: Wrap multi-table operations in `prisma.$transaction()`
- [ ] **Validation**: Required fields, empty strings → null, numeric checks
- [ ] **Security**: `requirePermission()`, `authenticate` hook, no sensitive data exposed
- [ ] **Concurrency**: Optimistic locking for status changes
- [ ] **Audit**: Activity logs with userId and timestamp

See [CHECKLIST.md](file:///d:/BrainyFlavors/Accounting-Github/AccaBiz%20-%20Copy/CHECKLIST.md) for complete checklist.

### Important File Mappings

| File | Recent Changes |
|------|-----------------|
| `backend/src/modules/accounting/journal.service.ts` | Auto-journal for CREDIT_NOTE, DEBIT_NOTE |
| `backend/src/modules/company/payment.controller.ts` | Auto-allocation FIFO, auto-apply advances |
| `backend/src/modules/company/invoice.controller.ts` | Auto DN/GRN generation with journals |
| `backend/src/modules/company/credit-note.controller.ts` | Auto-journal on approve |
| `backend/src/modules/company/debit-note.controller.ts` | Auto-journal on approve |

### Skills Available

| Skill | Purpose |
|-------|---------|
| `accabiz-project-expert` | Project structure, commands, troubleshooting |
| `accabiz-accounting-pro` | Double-entry, LC patterns, financial controls |
| `accabiz-security-audit` | RBAC, Prisma integrity, API security |
| `accabiz-ui-ux` | UI patterns, button styles, DetailPanel |
| `accabiz-testing` | Unit tests, integration tests, CI/CD |

### Testing

Run tests locally:
```bash
cd backend
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage
```

Pre-commit checks:
```bash
# Windows
powershell -File hooks/pre-commit.ps1

# Mac/Linux
bash hooks/pre-commit.sh
```

CI/CD Pipeline: `.github/workflows/ci.yml`