export declare class ReportRepository {
    static getTrialBalance(companyId: string, filters?: any): Promise<{
        accountCode: string;
        accountName: string;
        accountType: string;
        debit: number;
        credit: number;
        balance: number;
    }[]>;
}
//# sourceMappingURL=ReportRepository.d.ts.map