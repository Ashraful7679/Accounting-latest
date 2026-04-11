export declare class TransactionRepository {
    static findInvoices(where?: {}): Promise<any[]>;
    static findInvoiceById(id: string): Promise<any>;
    static createInvoice(data: any): Promise<any>;
    static findJournals(where?: {}, take?: number, skip?: number): Promise<any[]>;
    static findJournalById(id: string): Promise<any>;
    static createJournal(data: any): Promise<any>;
    static generateInvoiceJournal(tx: any, invoice: any, companyId: string, userId: string): Promise<any>;
    static generateBillJournal(tx: any, bill: any, companyId: string, userId: string): Promise<any>;
    static generatePaymentJournal(tx: any, payment: any, companyId: string, userId: string, type: 'SALES' | 'PURCHASE' | 'LC_EXPORT' | 'LC_IMPORT'): Promise<any>;
    static generateTransferJournal(tx: any, transfer: any, companyId: string, userId: string, toAccountId: string): Promise<any>;
    static getAccountTypeId(typeName: string): Promise<string>;
    /**
     * Ensures a dedicated ledger account exists for a Customer, Vendor, or Employee.
     * Scoped to the company.
     */
    static ensureEntityAccount(tx: any, companyId: string, entityId: string, entityName: string, entityCode: string, category: 'AR' | 'AP' | 'PAYABLE', openingBalance?: number): Promise<any>;
    /**
     * Generates a DRAFT journal entry for a salary payment request.
     */
    static generateSalaryJournal(tx: any, { companyId, employeeId, amount, date, description, userId }: any): Promise<any>;
}
//# sourceMappingURL=TransactionRepository.d.ts.map