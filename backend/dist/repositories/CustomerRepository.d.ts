export declare const demoCustomers: {
    id: string;
    code: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
}[];
export declare class CustomerRepository {
    static findMany(where?: {}): Promise<{
        id: string;
        code: string;
        name: string;
        email: string;
        phone: string;
        address: string;
        city: string;
        country: string;
    }[]>;
    static create(data: any, tx?: any): Promise<any>;
}
//# sourceMappingURL=CustomerRepository.d.ts.map