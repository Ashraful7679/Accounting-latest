export declare class TransactionRepository {
    static findInvoices(where?: {}): Promise<any[]>;
    static findInvoiceById(id: string): Promise<any>;
    static createInvoice(data: any): Promise<any>;
    static findJournals(where?: {}, take?: number, skip?: number): Promise<any[]>;
    static findJournalById(id: string): Promise<any>;
    static createJournal(data: any): Promise<any>;
    static generateInvoiceJournal(tx: any, invoice: any, companyId: string, userId: string): Promise<any>;
}
//# sourceMappingURL=TransactionRepository.d.ts.map