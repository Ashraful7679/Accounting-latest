export interface BankStatementLine {
  date: Date;
  amount: number; // Positive for inflow, negative for outflow
  reference: string;
  description: string;
  fitid?: string; // Financial Transaction ID (if available)
}

export interface BankStatementParser {
  parse(buffer: Buffer, config?: any): Promise<BankStatementLine[]>;
}
