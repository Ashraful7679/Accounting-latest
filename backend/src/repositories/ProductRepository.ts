import prisma from '../config/database';
import { SYSTEM_MODE } from '../lib/systemMode';

export const demoProducts = [
  { id: "prod-1", code: "PRD-2026-0001", name: "Steel Pipes", sku: "SP-001", description: "High quality export grade steel pipes", unitPrice: 150, isActive: true },
  { id: "prod-2", code: "PRD-2026-0002", name: "Aluminum Sheets", sku: "AL-002", description: "Industrial grade aluminum sheets", unitPrice: 85, isActive: true },
];

export class ProductRepository {
  static async findMany(where = {}) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await (prisma as any).product.findMany({
          where,
          orderBy: { createdAt: 'desc' }
        });
      } catch (error) {
        console.error('Product search failed, falling back to mock');
      }
    }
    return demoProducts;
  }

  static async findById(id: string) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await (prisma as any).product.findUnique({
          where: { id }
        });
      } catch (error) {
        console.error('Product retrieval failed');
      }
    }
    return demoProducts.find(p => p.id === id);
  }

  static async create(data: any) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await (prisma as any).product.create({ data });
      } catch (error) {
        console.error('Product creation failed');
        throw error;
      }
    }
    return { ...data, id: `offline-${Date.now()}` };
  }

  static async update(id: string, data: any) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await (prisma as any).product.update({ 
          where: { id },
          data 
        });
      } catch (error) {
        console.error('Product update failed');
        throw error;
      }
    }
    return { ...data, id };
  }

  static async delete(id: string) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await (prisma as any).product.delete({
          where: { id }
        });
      } catch (error) {
        console.error('Product deletion failed');
        throw error;
      }
    }
    return { id };
  }
}
