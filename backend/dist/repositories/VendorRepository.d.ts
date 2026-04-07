export declare const demoVendors: {
    id: string;
    code: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
}[];
export declare class VendorRepository {
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
    static create(data: any): Promise<any>;
}
//# sourceMappingURL=VendorRepository.d.ts.map