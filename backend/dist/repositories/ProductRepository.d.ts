export declare const demoProducts: {
    id: string;
    code: string;
    name: string;
    sku: string;
    description: string;
    unitPrice: number;
    isActive: boolean;
}[];
export declare class ProductRepository {
    static findMany(where?: {}): Promise<any>;
    static findById(id: string): Promise<any>;
    static create(data: any): Promise<any>;
    static update(id: string, data: any): Promise<any>;
    static delete(id: string): Promise<any>;
}
//# sourceMappingURL=ProductRepository.d.ts.map