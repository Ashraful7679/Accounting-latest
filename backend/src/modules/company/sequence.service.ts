import prisma from '../../config/database';

export class SequenceService {
  /**
   * Generates a robust, sequence-based document number.
   * Format: [PREFIX]-[YEAR]-[SEQUENCE] (e.g., PO-2026-0001)
   */
  static async generateDocumentNumber(
    companyId: string,
    type: 'invoice' | 'journal' | 'po' | 'pi' | 'lc' | 'customer' | 'vendor'
  ): Promise<string> {
    const prefixes: Record<string, string> = {
      invoice: 'INV',
      journal: 'JE',
      po: 'PO',
      pi: 'PI',
      lc: 'LC',
      customer: 'CUS',
      vendor: 'VEN'
    };

    const prefix = prefixes[type];
    const year = new Date().getFullYear();

    let lastDoc: any = null;

    switch (type) {
      case 'invoice':
        lastDoc = await prisma.invoice.findFirst({ where: { companyId }, orderBy: { createdAt: 'desc' } });
        break;
      case 'journal':
        lastDoc = await prisma.journalEntry.findFirst({ where: { companyId }, orderBy: { createdAt: 'desc' } });
        break;
      case 'po':
        lastDoc = await prisma.purchaseOrder.findFirst({ where: { companyId }, orderBy: { createdAt: 'desc' } });
        break;
      case 'pi':
        lastDoc = await (prisma as any).pI.findFirst({ where: { companyId }, orderBy: { createdAt: 'desc' } });
        break;
      case 'lc':
        lastDoc = await (prisma as any).lC.findFirst({ where: { companyId }, orderBy: { createdAt: 'desc' } });
        break;
      case 'customer':
        lastDoc = await prisma.customer.findFirst({ where: { companyId }, orderBy: { createdAt: 'desc' } });
        break;
      case 'vendor':
        lastDoc = await prisma.vendor.findFirst({ where: { companyId }, orderBy: { createdAt: 'desc' } });
        break;
    }

    let counter = 1;
    if (lastDoc) {
      const getNum = (doc: any) => {
        if (type === 'invoice') return doc.invoiceNumber;
        if (type === 'journal') return doc.entryNumber;
        if (type === 'po') return doc.poNumber;
        if (type === 'pi') return doc.piNumber;
        if (type === 'lc') return doc.lcNumber;
        if (type === 'customer' || type === 'vendor') return doc.code;
        return '';
      };

      const lastStr = getNum(lastDoc);
      if (lastStr) {
        const parts = lastStr.split('-');
        const lastNum = parseInt(parts[parts.length - 1] || '0');
        if (!isNaN(lastNum)) counter = lastNum + 1;
      }
    }

    return `${prefix}-${year}-${counter.toString().padStart(4, '0')}`;
  }
}
