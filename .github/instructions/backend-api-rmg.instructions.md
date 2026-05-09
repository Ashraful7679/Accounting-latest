---
name: backend-api-rmg
description: "Use when creating Fastify controllers and API routes for RMG manufacturing workflows. Enforces role-based LC trading, multi-company isolation, GL journaling, audit logging, and Bangladesh compliance."
applyTo: "backend/src/modules/**/*.controller.ts"
---

# RMG Backend API Handler Guidelines

You are designing **Fastify API controllers** for a Bangladesh RMG manufacturing export company. Every endpoint must enforce role-based access, GL integration, audit trails, and LC/trade workflow compliance.

## Domain Context

**RMG Export Workflow**:
1. Buyer sends inquiry → Company creates PI (Proforma Invoice)
2. Buyer opens LC at their bank
3. Company receives LC, creates SO (Sales Order) to subcontractors/spinners
4. Subcontractors supply goods, GRN (Goods Received Note) inspects quality
5. Goods shipped, Invoice created, Payment received (USD)
6. GL entries reconcile: LC utilisation, WIP, COGS, Revenue

**Key roles**:
- **Superadmin**: Full access, audit logging required
- **Owner**: Company-level access, LC/export management
- **Manager**: Department-level (Buying, Production, Finance)
- **Accountant**: GL entry creation, reconciliation
- **DataEntryOperator**: GRN, PO data entry only

---

## Mandatory Patterns

### 1. Role & Company Isolation Guard

Every endpoint must verify:
1. **User is authenticated** via JWT
2. **User has correct role** for operation
3. **Company context** matches user's company
4. **IP address logged** for audit trail

```typescript
// Pattern for RMG LC export operations
export class LCController {
  async createLC(request: FastifyRequest, reply: FastifyReply) {
    // Auth guard
    const user = request.user as AuthUser;
    if (!user || !user.isAdmin) throw new UnauthorizedError();

    const companyId = request.body.companyId;
    
    // Company isolation: User can only create LC for their company
    const userCompany = await prisma.userCompany.findFirst({
      where: { userId: user.id, companyId }
    });
    if (!userCompany) throw new ForbiddenError('Not authorized for this company');

    // Proceed with business logic
    const lc = await prisma.lC.create({
      data: { ...request.body, companyId }
    });

    // Audit log
    await this.auditLog(request, 'CREATE_LC', 'LC', lc.id, { lcNumber: lc.lcNumber, amount: lc.amount });

    return reply.status(201).send({ success: true, data: lc });
  }

  private async auditLog(request: FastifyRequest, action: string, resource: string, targetId: string, details?: any) {
    const ipAddress = (request.ip || (request.headers['x-forwarded-for'] as string)?.split(',')[0] || 'unknown') as string;
    await (prisma as any).systemAuditLog.create({
      data: {
        adminId: (request.user as any).id,
        action,
        targetResource: resource,
        targetId,
        ipAddress,
        details: details || null,
      }
    });
  }
}
```

### 2. GL Journaling Middleware

Every financial operation (LC create, SO payment, GRN acceptance) must create GL entries automatically.

```typescript
// RMG GL pattern: LC opening creates contingent liability
private async createLCOpeningGL(lc: LC, companyId: string) {
  const jvNumber = await this.generateJVNumber(companyId);
  
  // Debit: Contingent Liability account
  // Credit: LC Liability GL account
  const journal = await prisma.journalEntry.create({
    data: {
      companyId,
      jvNumber,
      debitAmount: lc.amount,  // BDT equivalent
      creditAmount: lc.amount,
      referenceDoc: lc.lcNumber,
      description: `LC Opening - ${lc.lcNumber} from ${lc.bankName}`,
      createdBy: 'SYSTEM',  // or actual user
    }
  });
  
  return journal;
}

// RMG GL pattern: Invoice payment received → Revenue recognition
private async createPaymentGL(invoice: Invoice, paidAmount: Decimal, companyId: string) {
  const jvNumber = await this.generateJVNumber(companyId);
  
  // Debit: Bank account (USD or BDT received)
  // Credit: Export Revenue account
  const journal = await prisma.journalEntry.create({
    data: {
      companyId,
      jvNumber,
      debitAmount: paidAmount,
      creditAmount: paidAmount,
      referenceDoc: invoice.invoiceNumber,
      description: `Payment received - Invoice ${invoice.invoiceNumber}`,
      createdBy: (request.user as any).id,
    }
  });
  
  return journal;
}
```

### 3. Multi-Currency Handling

RMG transactions are in USD (export) and BDT (local costs). Track both.

```typescript
// Pattern: LC amount in USD, GL in BDT
async createLC(request: FastifyRequest, reply: FastifyReply) {
  const { amount, currencyCode, exchangeRate } = request.body;
  
  let amountBDT = new Decimal(0);
  if (currencyCode === 'USD') {
    amountBDT = new Decimal(amount).times(exchangeRate);
  }
  
  const lc = await prisma.lC.create({
    data: {
      amount: new Decimal(amount),          // USD
      amountBDT,                             // BDT for GL
      currencyCode,
      exchangeRate: new Decimal(exchangeRate),
      ...request.body
    }
  });

  // Create GL in BDT
  await this.createLCOpeningGL(lc, request.body.companyId);
  
  return reply.send({ success: true, data: lc });
}
```

### 4. LC Utilisation Tracking

Prevent over-commitment: Total SO amount ≤ LC amount

```typescript
async createSalesOrder(request: FastifyRequest, reply: FastifyReply) {
  const { lcId, soAmount } = request.body;
  
  const lc = await prisma.lC.findUnique({ where: { id: lcId } });
  if (!lc) throw new NotFoundError('LC not found');
  
  // Calculate existing utilisation
  const existingSOs = await prisma.salesOrder.aggregate({
    where: { lcId, deletedAt: null },
    _sum: { amount: true }
  });
  
  const totalUtilised = (existingSOs._sum.amount || 0) + soAmount;
  
  if (totalUtilised > lc.amount) {
    throw new ConflictError(
      `LC utilisation exceeded. LC amount: ${lc.amount}, Total SO: ${totalUtilised}`
    );
  }

  // Update LC utilised amount
  await prisma.lC.update({
    where: { id: lcId },
    data: { utilizedAmount: new Decimal(totalUtilised) }
  });

  // Create SO
  const so = await prisma.salesOrder.create({ data: { ...request.body } });
  
  await this.auditLog(request, 'CREATE_SO', 'SalesOrder', so.id, { lcId, amount: soAmount });
  
  return reply.status(201).send({ success: true, data: so });
}
```

### 5. GRN Quality Inspection Workflow

GRN links to SO and validates inspection before revenue recognition.

```typescript
async createGRN(request: FastifyRequest, reply: FastifyReply) {
  const { soId, qtyReceived, qtyInspected, qualityGrade, remarks } = request.body;
  
  const so = await prisma.salesOrder.findUnique({ where: { id: soId } });
  if (!so) throw new NotFoundError('SO not found');
  
  // Validate inspection
  if (qtyInspected > qtyReceived) {
    throw new ConflictError('Inspected qty cannot exceed received qty');
  }
  
  const grn = await prisma.gRN.create({
    data: {
      soId,
      qtyReceived: new Decimal(qtyReceived),
      qtyInspected: new Decimal(qtyInspected),
      qualityGrade,  // First, Second, Reject
      remarks,
      status: 'INSPECTED',
      companyId: so.companyId,
    }
  });

  // If quality pass, update SO status
  if (qualityGrade === 'First') {
    await prisma.salesOrder.update({
      where: { id: soId },
      data: { status: 'READY_FOR_SHIPMENT' }
    });
  } else {
    // Reject or Second quality → notify Production
    await this.createNotification(so.companyId, 'Quality issue on SO', so.id);
  }

  await this.auditLog(request, 'CREATE_GRN', 'GRN', grn.id, { soId, qualityGrade });
  
  return reply.status(201).send({ success: true, data: grn });
}
```

### 6. Error Response Standard

All endpoints return consistent format:

```typescript
// Success
{ success: true, data: { ...record } }

// Error
{ success: false, error: { message: 'LC not found', code: 'NOT_FOUND', statusCode: 404 } }

// Validation error
{
  success: false,
  error: {
    message: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details: [
      { field: 'lcNumber', message: 'LC number already exists' }
    ]
  }
}
```

### 7. Input Validation

Validate **before** hitting database:

```typescript
import { z } from 'zod';

const CreateLCSchema = z.object({
  lcNumber: z.string().regex(/^[A-Z0-9\-]+$/),
  bankName: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currencyCode: z.enum(['USD', 'BDT']),
  expiryDate: z.string().datetime(),
  companyId: z.string().uuid(),
});

async createLC(request: FastifyRequest, reply: FastifyReply) {
  const validation = CreateLCSchema.safeParse(request.body);
  if (!validation.success) {
    return reply.status(400).send({
      success: false,
      error: { message: 'Validation failed', details: validation.error.errors }
    });
  }

  // Proceed...
}
```

### 8. Audit & Compliance Logging

Log all state changes and sensitive operations:

```typescript
// Critical operations require audit trail
async approveLCPayment(request: FastifyRequest, reply: FastifyReply) {
  const { lcId, paymentAmount } = request.body;
  
  const lc = await prisma.lC.findUnique({ where: { id: lcId } });
  
  // Approve payment
  const updated = await prisma.lC.update({
    where: { id: lcId },
    data: { 
      status: 'UTILISED',
      approvedBy: (request.user as any).id,
      approvedAt: new Date()
    }
  });

  // Create GL: Payment reversal/settlement
  await this.createLCSettlementGL(lc, new Decimal(paymentAmount), lc.companyId);

  // Audit log with full context
  await this.auditLog(request, 'APPROVE_LC_PAYMENT', 'LC', lcId, {
    lcNumber: lc.lcNumber,
    amount: lc.amount,
    paymentAmount,
    approver: (request.user as any).email
  });

  return reply.send({ success: true, data: updated });
}
```

---

## Review Checklist

When reviewing backend API code, verify:

- [ ] Route has authentication guard (`requireAdmin`, `requireOwner`)
- [ ] Company isolation enforced: User can only access their company data
- [ ] Input validation with `z.parse()` or similar
- [ ] GL entries created for financial operations (LC, invoice, payment)
- [ ] Multi-currency: USD amounts converted to BDT for GL
- [ ] LC utilisation checked before creating SO
- [ ] GRN workflow validates quality before revenue recognition
- [ ] Audit log recorded with IP address and user ID
- [ ] Response format: `{ success, data, error }`
- [ ] Soft delete used for financial records (GL, Invoice), never hard delete
- [ ] Error messages are user-friendly, codes are machine-readable

---

## Common RMG API Routes

Reference these patterns when creating new routes:

| Route | Method | Purpose | GL Impact | Audit |
|-------|--------|---------|-----------|-------|
| `/lc` | POST | Create LC | Contingent liability | ✅ |
| `/lc/:id/close` | PUT | Close LC | GL settlement | ✅ |
| `/so` | POST | Create SO | None (linked to LC) | ✅ |
| `/so/:id/allocate-materials` | PUT | Link PO items to SO | WIP GL | ✅ |
| `/grn` | POST | Inspect goods | None (triggers SO status) | ✅ |
| `/grn/:id/accept` | PUT | Accept GRN | COGS GL | ✅ |
| `/invoice` | POST | Create invoice from GRN | Revenue accrual | ✅ |
| `/payment` | POST | Record payment received | Bank GL, Revenue recognition | ✅ |
| `/loan/repayment` | POST | Record loan installment | Interest GL, Principal GL | ✅ |

