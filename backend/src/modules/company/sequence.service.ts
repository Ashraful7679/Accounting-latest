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
    type: 'invoice' | 'journal' | 'po' | 'pi' | 'lc' | 'customer' | 'vendor' | 'product'
  ): Promise<string> {
    const prefixes: Record<string, string> = {
      invoice: 'INV',
      journal: 'JE',
      po: 'PO',
      pi: 'PI',
      lc: 'LC',
      customer: 'CUS',
      vendor: 'VEN',
      product: 'PRD',
    };

    const prefix = prefixes[type];
    const year = new Date().getFullYear();
    const prefixYear = `${prefix}-${year}-`;

    // Step 1: Count existing docs with this year's prefix to get a starting estimate
    let count = 0;
    switch (type) {
      case 'invoice':
        count = await prisma.invoice.count({ where: { companyId, invoiceNumber: { startsWith: prefixYear } } });
        break;
      case 'journal':
        count = await prisma.journalEntry.count({ where: { companyId, entryNumber: { startsWith: prefixYear } } });
        break;
      case 'po':
        count = await prisma.purchaseOrder.count({ where: { companyId, poNumber: { startsWith: prefixYear } } });
        break;
      case 'pi':
        count = await (prisma as any).pI.count({ where: { companyId, piNumber: { startsWith: prefixYear } } });
        break;
      case 'lc':
        count = await (prisma as any).lC.count({ where: { companyId, lcNumber: { startsWith: prefixYear } } });
        break;
      case 'customer':
        count = await prisma.customer.count({ where: { companyId, code: { startsWith: prefixYear } } });
        break;
      case 'vendor':
        count = await prisma.vendor.count({ where: { companyId, code: { startsWith: prefixYear } } });
        break;
      case 'product':
        count = await (prisma as any).product.count({ where: { companyId, code: { startsWith: prefixYear } } });
        break;
    }

    // Step 2: Find the first free slot (handles gaps from deletions / data migrations)
    let counter = count + 1;
    let attempts = 0;

    while (true) {
      const candidate = `${prefixYear}${counter.toString().padStart(4, '0')}`;
      let alreadyExists = false;

      switch (type) {
        case 'invoice':
          alreadyExists = !!(await prisma.invoice.findUnique({ where: { invoiceNumber: candidate } }));
          break;
        case 'journal':
          alreadyExists = !!(await prisma.journalEntry.findUnique({ where: { entryNumber: candidate } }));
          break;
        case 'po':
          alreadyExists = !!(await prisma.purchaseOrder.findUnique({ where: { poNumber: candidate } }));
          break;
        case 'pi':
          alreadyExists = !!(await (prisma as any).pI.findUnique({ where: { piNumber: candidate } }));
          break;
        case 'lc':
          alreadyExists = !!(await (prisma as any).lC.findUnique({ where: { lcNumber: candidate } }));
          break;
        case 'customer':
          alreadyExists = !!(await prisma.customer.findUnique({ where: { code: candidate } }));
          break;
        case 'vendor':
          alreadyExists = !!(await prisma.vendor.findUnique({ where: { code: candidate } }));
          break;
        case 'product':
          alreadyExists = !!(await (prisma as any).product.findUnique({ where: { code: candidate } }));
          break;
      }

      if (!alreadyExists) return candidate;

      counter++;
      attempts++;
      if (attempts > 200) {
        throw new Error(`Cannot generate unique document number for type "${type}" after 200 attempts`);
      }
    }
  }
}
