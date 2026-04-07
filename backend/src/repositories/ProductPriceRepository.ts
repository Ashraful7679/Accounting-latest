import prisma from '../config/database';
import { SYSTEM_MODE } from '../lib/systemMode';

export class ProductPriceRepository {
  static async findMany(where: any) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await (prisma as any).productEntityPrice.findMany({
          where,
          include: {
            product: true,
            customer: true,
            vendor: true
          }
        });
      } catch (error) {
        console.error('Product price search failed');
      }
    }
    return [];
  }

  static async upsert(productId: string, entityId: string, type: 'customer' | 'vendor', price: number, currency: string) {
    if (SYSTEM_MODE === "LIVE") {
      const where = type === 'customer' 
        ? { productId_customerId: { productId, customerId: entityId } }
        : { productId_vendorId: { productId, vendorId: entityId } };
      
      const createData: any = {
        productId,
        price,
        currency
      };
      if (type === 'customer') createData.customerId = entityId;
      else createData.vendorId = entityId;

      try {
        return await (prisma as any).productEntityPrice.upsert({
          where,
          update: { price, currency },
          create: createData
        });
      } catch (error) {
        console.error('Product price upsert failed');
        throw error;
      }
    }
    return { productId, price, currency, [type === 'customer' ? 'customerId' : 'vendorId']: entityId };
  }

  static async delete(id: string) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await (prisma as any).productEntityPrice.delete({
          where: { id }
        });
      } catch (error) {
        console.error('Product price deletion failed');
        throw error;
      }
    }
    return { id };
  }

  static async findByEntity(entityId: string, type: 'customer' | 'vendor') {
    if (SYSTEM_MODE === "LIVE") {
      try {
        const where = type === 'customer' ? { customerId: entityId } : { vendorId: entityId };
        return await (prisma as any).productEntityPrice.findMany({
          where,
          include: {
            product: true
          }
        });
      } catch (error) {
        console.error('Failed to fetch entity products');
        throw error;
      }
    }
    return [];
  }
}
