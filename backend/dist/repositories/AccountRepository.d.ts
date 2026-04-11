export declare class AccountRepository {
    static findMany(where?: {}, take?: number, skip?: number): Promise<({
        id: string;
        code: string;
        name: string;
        accountType: {
            name: string;
            type: string;
        };
        currentBalance: number;
        openingBalance: number;
        isActive: boolean;
        category: string;
    } | {
        id: string;
        code: string;
        name: string;
        accountType: {
            name: string;
            type: string;
        };
        currentBalance: number;
        openingBalance: number;
        isActive: boolean;
        category?: undefined;
    })[]>;
    static findAccountTypes(): Promise<{
        id: string;
        isActive: boolean;
        name: string;
        type: string;
    }[] | {
        id: string;
        name: string;
        type: string;
    }[]>;
    static findAccountTypeById(id: string): Promise<{
        id: string;
        name: string;
        type: string;
    }>;
    static create(data: any): Promise<any>;
    static findByCategory(companyId: string, category: string): Promise<{
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        code: string;
        openingBalance: number;
        currentBalance: number;
        cashFlowType: string | null;
        allowNegative: boolean;
        category: string | null;
        referenceId: string | null;
        companyId: string;
        accountTypeId: string;
        parentId: string | null;
    } | {
        id: string;
        code: string;
        name: string;
        accountType: {
            name: string;
            type: string;
        };
        currentBalance: number;
        openingBalance: number;
        isActive: boolean;
        category: string;
    } | {
        id: string;
        code: string;
        name: string;
        accountType: {
            name: string;
            type: string;
        };
        currentBalance: number;
        openingBalance: number;
        isActive: boolean;
        category?: undefined;
    }>;
    static findById(id: string): Promise<{
        id: string;
        code: string;
        name: string;
        accountType: {
            name: string;
            type: string;
        };
        currentBalance: number;
        openingBalance: number;
        isActive: boolean;
        category: string;
    } | {
        id: string;
        code: string;
        name: string;
        accountType: {
            name: string;
            type: string;
        };
        currentBalance: number;
        openingBalance: number;
        isActive: boolean;
        category?: undefined;
    }>;
}
//# sourceMappingURL=AccountRepository.d.ts.map