export declare class ProductPriceRepository {
    static findMany(where: any): Promise<any>;
    static upsert(productId: string, entityId: string, type: 'customer' | 'vendor', price: number, currency: string): Promise<any>;
    static delete(id: string): Promise<any>;
    static findByEntity(entityId: string, type: 'customer' | 'vendor'): Promise<any>;
}
//# sourceMappingURL=ProductPriceRepository.d.ts.map