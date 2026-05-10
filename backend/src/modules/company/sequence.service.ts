import prisma from '../../config/database';

export class SequenceService {
  /**
   * Generates a robust, collision-safe document number.
   * Format: [PREFIX]-[YEAR]-[SEQUENCE] (e.g., JE-2026-0001)
   *
   * Strategy:
   *  1. Count all existing docs that start with PREFIX-YEAR- to estimate the next slot.
   *  2. Loop and increment until we find a candidate that does NOT yet exist in the DB.
   *     This handles gaps, out-of-order inserts, and data migrations from older formats.
   */
  static async generateDocumentNumber(
    companyId: string,
    type: 'invoice' | 'journal' | 'po' | 'pi' | 'lc' | 'customer' | 'vendor' | 'product' | 'employee' | 'account' | 'so' | 'dn' | 'grn' | 'bill' | 'purchase-requisition' | 'debit-note' | 'fixed-asset' | 'payroll-run' | 'credit-note',
    prismaOverride?: any
  ): Promise<string> {
    const client = prismaOverride || prisma;
    const prefixes: Record<string, string> = {
      invoice: 'INV',
      journal: 'JE',
      po: 'PO',
      pi: 'PI',
      lc: 'LC',
      customer: 'CUS',
      vendor: 'VEN',
      product: 'PRD',
      employee: 'EMP',
      account: 'ACC',
      so: 'SO',
      dn: 'DN',
      grn: 'GRN',
      bill: 'BILL',
      'purchase-requisition': 'PR',
      'debit-note': 'DEBN',
      'credit-note': 'CRN',
      'warehouse': 'WH',
      'stock-transfer': 'ST',
      'stock-reconciliation': 'SR',
      'bank-reconciliation': 'BR',
      'fixed-asset': 'FA',
      'payroll-run': 'PRUN',
    };

    const prefix = prefixes[type];
    const year = new Date().getFullYear();
    const prefixYear = `${prefix}-${year}-`;

    // Atomic increment using DocumentSequence table
    const seq = await client.documentSequence.upsert({
      where: {
        companyId_type_year: {
          companyId,
          type,
          year
        }
      },
      update: {
        lastValue: { increment: 1 }
      },
      create: {
        companyId,
        type,
        year,
        lastValue: 1
      }
    });

    let counter = seq.lastValue;
    let attempts = 0;

    // Verify if the number is actually free in the main table (to handle legacy data)
    while (true) {
      const candidate = `${prefixYear}${counter.toString().padStart(4, '0')}`;
      let alreadyExists = false;

      switch (type) {
        case 'invoice':
          alreadyExists = !!(await client.invoice.findFirst({ where: { companyId, invoiceNumber: candidate } }));
          break;
        case 'journal':
          alreadyExists = !!(await client.journalEntry.findFirst({ where: { companyId, entryNumber: candidate } }));
          break;
        case 'po':
          alreadyExists = !!(await client.purchaseOrder.findFirst({ where: { companyId, poNumber: candidate } }));
          break;
        case 'pi':
          alreadyExists = !!(await (client as any).pI.findFirst({ where: { companyId, piNumber: candidate } }));
          break;
        case 'lc':
          alreadyExists = !!(await (client as any).lC.findFirst({ where: { companyId, lcNumber: candidate } }));
          break;
        case 'customer':
          alreadyExists = !!(await client.customer.findFirst({ where: { companyId, code: candidate } }));
          break;
        case 'vendor':
          alreadyExists = !!(await client.vendor.findFirst({ where: { companyId, code: candidate } }));
          break;
        case 'product':
          alreadyExists = !!(await (client as any).product.findFirst({ where: { companyId, code: candidate } }));
          break;
        case 'employee':
          alreadyExists = !!(await client.employee.findFirst({ where: { companyId, employeeCode: candidate } }));
          break;
        case 'account':
          alreadyExists = !!(await client.account.findFirst({ where: { companyId, code: candidate } }));
          break;
        case 'so':
          alreadyExists = !!(await (client as any).salesOrder.findFirst({ where: { companyId, soNumber: candidate } }));
          break;
        case 'dn':
          alreadyExists = !!(await (client as any).dN.findFirst({ where: { companyId, dnNumber: candidate } }));
          break;
        case 'grn':
          alreadyExists = !!(await (client as any).gRN.findFirst({ where: { companyId, grnNumber: candidate } }));
          break;
        case 'bill':
          alreadyExists = !!(await (client as any).bill.findFirst({ where: { companyId, billNumber: candidate } }));
          break;
      }

      if (!alreadyExists) {
        // If we found it was already free, update the sequence table to reflect this if it's far ahead
        // But usually atomic upsert is enough. The while loop handles legacy collisions.
        if (counter !== seq.lastValue) {
           await client.documentSequence.update({
             where: { id: seq.id },
             data: { lastValue: counter }
           });
        }
        return candidate;
      }

      counter++;
      attempts++;
      if (attempts > 200) {
        throw new Error(`Cannot generate unique document number for type "${type}" after 200 attempts`);
      }
    }
  }
}
