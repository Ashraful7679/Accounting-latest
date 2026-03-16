export declare const demoCompany: {
    id: string;
    code: string;
    name: string;
    baseCurrency: string;
    isActive: boolean;
    address: string;
    city: string;
    country: string;
};
export declare const demoUser: {
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
//# sourceMappingURL=company.d.ts.map