# AccaBiz Development Checklist

> Use this checklist for every code change to ensure 100% error-free implementation.

---

## 1. Double-Entry Validation

- [ ] Every journal entry has balanced debits and credits
- [ ] `SUM(debit) === SUM(credit)` before saving
- [ ] Account type determines balance direction (ASSET/EXPENSE increase with DEBIT)

## 2. Idempotency

- [ ] Auto-journal operations check `isJournaled` flag first
- [ ] No duplicate journals on retry
- [ ] Pattern: `if (doc.isJournaled) return { alreadyJournaled: true }`

## 3. Transaction Safety

- [ ] Multi-step operations wrapped in `prisma.$transaction()`
- [ ] No partial commits - all or nothing
- [ ] Error handling with proper rollback

## 4. Input Validation

- [ ] Required fields validated before processing
- [ ] Empty strings converted to `null` for optional fields
- [ ] Numeric fields checked for valid numbers
- [ ] Dates validated (not in closed periods)

## 5. Status Transitions

- [ ] Only valid transitions allowed (check `from` and `to` status)
- [ ] `DRAFT` -> `APPROVED` validation (user permissions)
- [ ] Revert operations handle all side effects (stock, journals)

## 6. Security

- [ ] `requirePermission()` called at start of controller methods
- [ ] `authenticate` hook on all company routes
- [ ] No sensitive data in responses (password, secrets)
- [ ] Company access validated for all queries

## 7. Error Handling

- [ ] Try-catch around all async operations
- [ ] Meaningful error messages
- [ ] No stack traces in production responses
- [ ] Proper HTTP status codes

## 8. Concurrency

- [ ] Optimistic locking for status changes
- [ ] Fresh data fetched inside transactions
- [ ] No read-modify-write without locking

## 9. Audit Trail

- [ ] Activity logs for create/update/delete
- [ ] User ID and timestamp recorded
- [ ] Soft delete instead of hard delete

## 10. Testing Checklist

### Before Any Commit
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] No lint errors: `npm run lint`
- [ ] New migrations tested

### For New Features
- [ ] Unit test for validation logic
- [ ] Integration test for workflow
- [ ] Edge case tested (null, empty, negative)

---

## Quick Validation Commands

```bash
# TypeScript check
cd backend && npx tsc --noEmit

# Lint check
cd backend && npm run lint

# Frontend check
cd frontend && npm run build

# Database migration
cd backend && npx prisma migrate deploy

# Update memory
node hooks/memory-update.js --update --file="path" --feature="change"
```