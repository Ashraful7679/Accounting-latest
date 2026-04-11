export declare class ProductRepository {
    static findMany(where?: any): Promise<{
        currency: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        type: string;
        code: string;
        companyId: string;
        sku: string | null;
        unitType: string;
        unitPrice: number;
        stockAmount: number;
    }[]>;
    static findById(id: string): Promise<{
        currency: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        type: string;
        code: string;
        companyId: string;
        sku: string | null;
        unitType: string;
        unitPrice: number;
        stockAmount: number;
    }>;
    static create(data: {
        code: string;
        name: string;
        companyId: string;
        sku?: string;
        description?: string;
        unitType?: string;
        unitPrice?: number;
        isActive?: boolean;
        currency?: string;
        stockAmount?: number;
        type?: string;
    }): Promise<{
        currency: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        type: string;
        code: string;
        companyId: string;
        sku: string | null;
        unitType: string;
        unitPrice: number;
        stockAmount: number;
    }>;
    static update(id: string, data: Partial<{
        name: string;
        sku: string;
        description: string;
        unitType: string;
        unitPrice: number;
        isActive: boolean;
        currency: string;
        stockAmount: number;
        type: string;
    }>): Promise<{
        currency: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        type: string;
        code: string;
        companyId: string;
        sku: string | null;
        unitType: string;
        unitPrice: number;
        stockAmount: number;
    }>;
    static delete(id: string): Promise<{
        currency: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        description: string | null;
        type: string;
        code: string;
        companyId: string;
        sku: string | null;
        unitType: string;
        unitPrice: number;
        stockAmount: number;
    }>;
}
//# sourceMappingURL=ProductRepository.d.ts.map