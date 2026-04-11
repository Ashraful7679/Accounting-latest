import prisma from '../config/database';

export class ProductRepository {
  static async findMany(where: any = {}) {
    return prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  static async findById(id: string) {
    return prisma.product.findUnique({
      where: { id },
    });
  }

  static async create(data: {
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
  }) {
    return prisma.product.create({ data });
  }

  static async update(id: string, data: Partial<{
    name: string;
    sku: string;
    description: string;
    unitType: string;
    unitPrice: number;
    isActive: boolean;
    currency: string;
    stockAmount: number;
    type: string;
  }>) {
    return prisma.product.update({ where: { id }, data });
  }

  static async delete(id: string) {
    return prisma.product.delete({ where: { id } });
  }
}
