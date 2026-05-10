---
name: accabiz-testing
description: Comprehensive testing strategy for AccaBiz ERP. Use when writing tests, validating code, or ensuring bug-free deployments. Covers unit tests, integration tests, and regression prevention.
---

# AccaBiz Testing Skill

This skill provides comprehensive testing patterns for the AccaBiz ERP system. Use it when writing tests, validating functionality, or ensuring code quality before deployment.

## Testing Philosophy

**Test the critical paths, not everything.** Focus on:
1. Double-entry balance validation (MUST HAVE)
2. Idempotent operations (auto-journals)
3. Status transitions
4. Payment allocations
5. Security/RBAC checks

## Minimum Quality Gate

Before merge/deploy for touched modules:

- [ ] Relevant unit tests pass.
- [ ] Relevant integration tests pass.
- [ ] At least one regression test is added for each bug fix.
- [ ] Finance-critical flows assert double-entry and idempotency.
- [ ] Permission-denied scenario is tested for sensitive actions.

## Test Structure

### Backend Tests Location
```
backend/
├── src/
│   └── __tests__/           # Jest tests
│       ├── unit/
│       ├── integration/
│       └── helpers/
└── prisma/
    └── seed.ts              # Test data seeding
```

### Test Naming Convention
```
testFile.spec.ts
test_file.integration.test.ts
```

## Critical Tests (Must Pass Before Deploy)

### 1. Journal Service Tests

```typescript
// __tests__/unit/journal.service.test.ts
describe('JournalService', () => {
  describe('handleDocumentApproval', () => {
    it('should throw error if SUM(debits) !== SUM(credits)', async () => {
      // This is the MOST IMPORTANT test
    });

    it('should skip if isJournaled is true (idempotency)', async () => {
      // Verify no duplicate journals
    });

    it('should create journal with correct line amounts', async () => {
      // Verify amounts match source document
    });
  });
});
```

### 2. Payment Allocation Tests

```typescript
describe('PaymentController', () => {
  describe('createPayment', () => {
    it('should auto-allocate full amount to single invoice', async () => {
      // FIFO allocation test
    });

    it('should handle partial payments correctly', async () => {
      // Outstanding balance calculation
    });

    it('should update invoice status to PAID when fully allocated', async () => {
      // Status transition
    });
  });
});
```

### 3. Invoice Approval Tests

```typescript
describe('InvoiceController', () => {
  describe('approveInvoice', () => {
    it('should generate DN for SALES invoice', async () => {
      // Auto-DN generation
    });

    it('should generate GRN for PURCHASE invoice', async () => {
      // Auto-GRN generation
    });

    it('should post journal and mark isJournaled', async () => {
      // Idempotency + journal
    });

    it('should revert stock on invoice revert', async () => {
      // Revert operations
    });
  });
});
```

### 4. Credit/Debit Note Tests

```typescript
describe('CreditNoteController', () => {
  describe('approveCreditNote', () => {
    it('should auto-post reversal journal (Dr Revenue / Cr AR)', async () => {
      // Auto-journal on approval
    });

    it('should return stock if returnToStock is true', async () => {
      // Stock restoration
    });
  });
});
```

### 5. Double-Entry Balance Tests

```typescript
describe('Double-Entry Integrity', () => {
  it('Invoice journal: SUM(debits) === SUM(credits)', async () => {
    const invoice = await createTestInvoice();
    await approveInvoice(invoice.id);
    const journal = await getJournal(invoice.journalId);
    
    expect(journal.totalDebit).toBe(journal.totalCredit);
  });

  it('Payment journal: SUM(debits) === SUM(credits)', async () => {
    const payment = await createTestPayment();
    const journal = await getJournal(payment.journalId);
    
    expect(journal.totalDebit).toBe(journal.totalCredit);
  });
});
```

## Test Helpers

### Database Setup
```typescript
// __tests__/helpers/database.ts
import { PrismaClient } from '@prisma/client';

export const prismaTest = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL
    }
  }
});

export async function cleanupDatabase() {
  // Clean up test data after each test
}

export async function seedTestData() {
  // Create test company, accounts, customers
}
```

### Test Data Fixtures
```typescript
// __tests__/fixtures/
export const testCompany = {
  name: 'Test Company',
  code: 'TC001'
};

export const testAccounts = {
  cash: { code: 'CASH', name: 'Cash', category: 'CASH' },
  ar: { code: 'AR', name: 'Accounts Receivable', category: 'AR' },
  revenue: { code: 'REV', name: 'Sales Revenue', category: 'REVENUE' }
};
```

## Integration Test Patterns

### Full Workflow Tests

```typescript
// Invoice -> DN -> Journal -> Payment -> Allocation
describe('Sales Workflow', () => {
  it('should complete full cycle: Invoice -> Payment', async () => {
    // 1. Create Invoice
    const invoice = await createInvoice({
      customerId: testCustomer.id,
      lines: [{ productId: testProduct.id, quantity: 10, unitPrice: 100 }]
    });
    
    // 2. Approve Invoice (auto-generates DN + journal)
    await approveInvoice(invoice.id);
    
    // 3. Create Payment
    const payment = await createPayment({
      invoiceId: invoice.id,
      amount: invoice.total
    });
    
    // 4. Verify all side effects
    const updatedInvoice = await getInvoice(invoice.id);
    expect(updatedInvoice.status).toBe('PAID');
    expect(updatedInvoice.journalId).toBeTruthy();
  });
});
```

### Error Handling Tests

```typescript
describe('Error Handling', () => {
  it('should reject invoice approval without required permissions', async () => {
    const user = await createUserWithRole('Accountant'); // Cannot approve
    const invoice = await createInvoice();
    
    await expect(approveInvoice(invoice.id, user)).rejects.toThrow('Forbidden');
  });

  it('should rollback on partial failure', async () => {
    // Verify no partial state on error
  });
});
```

## Running Tests

### Local
```bash
# Run all tests
cd backend
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- --testPathPattern=journal.service

# Run integration tests only
npm test -- --testPathPattern=integration
```

### CI/CD (GitHub Actions)
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: cd backend && npm ci
      - run: cd backend && npx prisma migrate deploy
      - run: cd backend && npm test
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
```

## Test Coverage Targets

| Module | Target | Critical |
|--------|--------|----------|
| JournalService | 90% | ✅ MUST HAVE |
| PaymentController | 80% | ✅ MUST HAVE |
| InvoiceController | 80% | ✅ MUST HAVE |
| RBACService | 90% | ✅ MUST HAVE |
| TransactionRepository | 80% | 🟡 Important |

## Pre-Deploy Checklist

- [ ] All `handleDocumentApproval` tests pass
- [ ] Double-entry balance test passes
- [ ] Idempotency tests pass (no duplicate journals)
- [ ] Payment allocation tests pass
- [ ] Status transition tests pass
- [ ] No test is skipped or pending

## Mock Patterns

### API Mocking
```typescript
// Mock external services
jest.mock('@/lib/external-service', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
  processPayment: jest.fn().mockRejectedValue(new Error('Payment failed'))
}));
```

### Date Mocking
```typescript
// Always mock dates for predictable testing
jest.useFakeTimers();
jest.setSystemTime(new Date('2026-01-15'));
```

---
*Created for the AccaBiz ERP Project*
