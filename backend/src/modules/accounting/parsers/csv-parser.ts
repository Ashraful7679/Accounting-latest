import { BankStatementLine, BankStatementParser } from '../bank-parser.interface';

export class GenericCsvParser implements BankStatementParser {
  /**
   * Parses a CSV buffer.
   * @param buffer Statement file buffer
   * @param config Mapping config { dateCol: 0, amountCol: 2, descCol: 1, skipRows: 1 }
   */
  async parse(buffer: Buffer, config: any = {}): Promise<BankStatementLine[]> {
    const content = buffer.toString('utf-8');
    const lines = content.split(/\r?\n/);
    const skipRows = config.skipRows || 0;
    const results: BankStatementLine[] = [];

    const dateCol = config.dateCol !== undefined ? config.dateCol : 0;
    const amountCol = config.amountCol !== undefined ? config.amountCol : 1;
    const descCol = config.descCol !== undefined ? config.descCol : 2;
    const refCol = config.refCol !== undefined ? config.refCol : 3;

    for (let i = skipRows; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      // Basic CSV split (caution: doesn't handle commas inside quotes perfectly, but sufficient for many banking CSVs)
      const parts = lines[i].split(',').map(p => p.replace(/^"|"$/g, '').trim());
      
      const date = new Date(parts[dateCol]);
      if (isNaN(date.getTime())) continue;

      const amount = parseFloat(parts[amountCol].replace(/[^\d.-]/g, ''));
      if (isNaN(amount)) continue;

      results.push({
        date,
        amount,
        description: parts[descCol] || '',
        reference: parts[refCol] || parts[descCol] || '',
      });
    }

    return results;
  }
}
