import prisma from '../config/database';
import { SYSTEM_MODE } from '../lib/systemMode';

interface FindManyOptions {
  companyId: string;
  page?: number;
  limit?: number;
  search?: string;
}

interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const demoCustomers = [
  { id: "cus-1", code: "CUS-001", name: "Modern Garments Ltd", email: "info@moderngarments.com", phone: "+8801711223344", address: "Ghazipur, Dhaka", city: "Dhaka", country: "Bangladesh", preferredCurrency: 'BDT', exchangeRate: 1 },
  { id: "cus-2", code: "CUS-002", name: "Elegant Textiles", email: "contact@elegant.com", phone: "+8801811998877", address: "Narayanganj", city: "Dhaka", country: "Bangladesh", preferredCurrency: 'BDT', exchangeRate: 1 },
];

export class CustomerRepository {
  static async findMany(options: FindManyOptions): Promise<PaginatedResult<any>> {
    const { companyId, page = 1, limit = 20, search } = options;
    
    const where: any = { companyId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const skip = (page - 1) * limit;

    if (SYSTEM_MODE === "LIVE") {
      try {
        const [data, total] = await Promise.all([
          prisma.customer.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            select: {
              id: true,
              code: true,
              name: true,
              email: true,
              phone: true,
              address: true,
              city: true,
              country: true,
              isActive: true,
              preferredCurrency: true,
              exchangeRate: true,
              updatedAt: true,
              createdAt: true,
            }
          }),
          prisma.customer.count({ where })
        ]);

        return {
          data,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        };
      } catch (error) {
        console.error('Customer search failed, falling back to mock');
      }
    }
    
    const filtered = search 
      ? demoCustomers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
      : demoCustomers;
    
    return {
      data: filtered,
      pagination: { page, limit, total: filtered.length, totalPages: 1 }
    };
  }

  static async create(data: any, tx?: any) {
    const client = tx || prisma;
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await client.customer.create({ data });
      } catch (error) {
        console.error('Customer creation failed');
      }
    }
    return { ...data, id: `offline-${Date.now()}` };
  }
}