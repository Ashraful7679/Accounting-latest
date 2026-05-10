import prisma from '../config/database';
import { SYSTEM_MODE } from '../lib/systemMode';

export const demoVendors = [
  { id: "ven-1", code: "VEN-001", name: "Apex Chemicals", email: "sales@apexchem.com", phone: "+8801911445566", address: "Tejgaon I/A", city: "Dhaka", country: "Bangladesh" },
  { id: "ven-2", code: "VEN-002", name: "Global Logistics", email: "support@globallog.com", phone: "+8801611002233", address: "Chittagong Port", city: "Chittagong", country: "Bangladesh" },
];

interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class VendorRepository {
  static async findMany(options: any = {}): Promise<PaginatedResult<any>> {
    const { companyId, page = 1, limit = 20, search } = options;
    
    const where: any = companyId ? { companyId } : {};
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
          prisma.vendor.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
          }),
          prisma.vendor.count({ where })
        ]);

        return {
          data,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        };
      } catch (error) {
        console.error('Vendor search failed, falling back to mock:', error);
      }
    }
    
    const filtered = search 
      ? demoVendors.filter(v => v.name.toLowerCase().includes(search.toLowerCase()))
      : demoVendors;
      
    return {
      data: filtered,
      pagination: { page, limit, total: filtered.length, totalPages: 1 }
    };
  }

  static async create(data: any, tx?: any) {
    const client = tx || prisma;
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await client.vendor.create({ data });
      } catch (error) {
        console.error('Vendor creation failed:', error);
      }
    }
    return { ...data, id: `offline-${Date.now()}` };
  }
}
