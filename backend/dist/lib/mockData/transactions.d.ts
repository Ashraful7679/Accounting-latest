export declare const demoInvoices: ({
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    status: string;
    currency: string;
    exchangeRate: number;
    type: string;
    subtotal: number;
    taxAmount: number;
    total: number;
    customer: {
        id: string;
        name: string;
    };
    vendor: any;
    createdBy: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        isActive: boolean;
        roles: string[];
        userCompanies: {
            companyId: string;
            isDefault: boolean;
            company: {
                id: string;
                code: string;
                name: string;
                baseCurrency: string;
                isActive: boolean;
                address: string;
                city: string;
                country: string;
            };
        }[];
    };
    lines: {
        id: string;
        description: string;
        quantity: number;
        unitPrice: number;
        taxRate: number;
        amount: number;
        product: any;
    }[];
} | {
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    status: string;
    currency: string;
    exchangeRate: number;
    type: string;
    subtotal: number;
    taxAmount: number;
    total: number;
    customer: any;
    vendor: {
        id: string;
        name: string;
    };
    createdBy: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        isActive: boolean;
        roles: string[];
        userCompanies: {
            companyId: string;
            isDefault: boolean;
            company: {
                id: string;
                code: string;
                name: string;
                baseCurrency: string;
                isActive: boolean;
                address: string;
                city: string;
                country: string;
            };
        }[];
    };
    lines: {
        id: string;
        description: string;
        quantity: number;
        unitPrice: number;
        taxRate: number;
        amount: number;
        product: any;
    }[];
})[];
export declare const demoJournals: {
    id: string;
    entryNumber: string;
    companyId: string;
    date: string;
    description: string;
    status: string;
    totalDebit: number;
    totalCredit: number;
    createdBy: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        isActive: boolean;
        roles: string[];
        userCompanies: {
            companyId: string;
            isDefault: boolean;
            company: {
                id: string;
                code: string;
                name: string;
                baseCurrency: string;
                isActive: boolean;
                address: string;
                city: string;
                country: string;
            };
        }[];
    };
    lines: {
        account: {
            code: string;
            name: string;
        };
        debit: number;
        credit: number;
        description: string;
    }[];
}[];
//# sourceMappingURL=transactions.d.ts.map