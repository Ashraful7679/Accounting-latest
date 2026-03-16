export declare class FinanceRepository {
    static findLCs(companyId: string): Promise<{
        id: string;
        lcNumber: string;
        bankName: string;
        amount: number;
        currency: string;
        status: string;
        type: string;
    }[]>;
    static findLoans(companyId: string): Promise<{
        id: string;
        loanNumber: string;
        bankName: string;
        principalAmount: number;
        outstandingBalance: number;
        interestRate: number;
        status: string;
    }[]>;
}
//# sourceMappingURL=FinanceRepository.d.ts.map