import prisma from '../../config/database';
import { BankStatementLine, BankStatementParser } from './bank-parser.interface';
import { GenericCsvParser } from './parsers/csv-parser';

export class BankReconciliationService {
  private static parsers: Record<string, BankStatementParser> = {
    'csv': new GenericCsvParser(),
    // 'mt940': new StandardMt940Parser(),
  };

  /**
   * Processes a bank statement and finds matching ledger entries.
   */
  static async reconcileStatement(
    companyId: string, 
    accountId: string, 
    buffer: Buffer, 
    format: string, 
    config?: any
  ) {
    const parser = this.parsers[format];
    if (!parser) throw new Error(`Unsupported statement format: ${format}`);

    const statementLines = await parser.parse(buffer, config);
    
    // Fetch unreconciled journal lines for this account
    const unreconciledLedger = await prisma.journalEntryLine.findMany({
      where: {
        accountId,
        reconciled: false,
        journalEntry: { companyId, status: 'APPROVED' }
      },
      include: { journalEntry: true }
    });

    const matches: any[] = [];
    const unmatchedStatement: BankStatementLine[] = [];

    for (const stmtLine of statementLines) {
      // Find candidate matches in ledger
      const candidates = unreconciledLedger.filter(ledgerLine => {
        const ledgerAmount = Number(ledgerLine.debit || 0) - Number(ledgerLine.credit || 0);
        
        // Match 1: Identical amount and date
        const isExactAmount = Math.abs(ledgerAmount - stmtLine.amount) < 0.01;
        const isExactDate = ledgerLine.journalEntry.date.toDateString() === stmtLine.date.toDateString();
        
        if (isExactAmount && isExactDate) return true;

        // Match 2: Exact amount and date within 3 days
        const dateDiff = Math.abs(ledgerLine.journalEntry.date.getTime() - stmtLine.date.getTime()) / (1000 * 60 * 60 * 24);
        if (isExactAmount && dateDiff <= 3) return true;

        return false;
      });

      if (candidates.length > 0) {
        matches.push({
          statement: stmtLine,
          ledgerCandidates: candidates.map(c => ({
            id: c.id,
            entryNumber: c.journalEntry.entryNumber,
            date: c.journalEntry.date,
            description: c.description || c.journalEntry.description,
            amount: Number(c.debit || 0) - Number(c.credit || 0)
          }))
        });
      } else {
        unmatchedStatement.push(stmtLine);
      }
    }

    return { matches, unmatchedStatement };
  }

  /**
   * Commits the reconciliation by marking lines as reconciled.
   */
  static async commitReconciliation(batch: { statementRef: string, ledgerLineId: string }[]) {
    return await prisma.$transaction(async (tx: any) => {
      const results = [];
      for (const item of batch) {
        const updated = await tx.journalEntryLine.update({
          where: { id: item.ledgerLineId },
          data: {
            reconciled: true,
            reconciledAt: new Date()
          }
        });
        results.push(updated);
      }
      return results;
    });
  }
}
