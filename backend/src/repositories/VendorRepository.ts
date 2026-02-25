import prisma from '../config/database';
import { SYSTEM_MODE } from '../lib/systemMode';

export const demoVendors = [
  { id: "ven-1", code: "VEN-001", name: "Apex Chemicals", email: "sales@apexchem.com", phone: "+8801911445566", address: "Tejgaon I/A", city: "Dhaka", country: "Bangladesh" },
  { id: "ven-2", code: "VEN-002", name: "Global Logistics", email: "support@globallog.com", phone: "+8801611002233", address: "Chittagong Port", city: "Chittagong", country: "Bangladesh" },
];

export class VendorRepository {
  static async findMany(where = {}) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.vendor.findMany({
          where,
          orderBy: { createdAt: 'desc' }
        });
      } catch (error) {
        console.error('Vendor search failed, falling back to mock');
      }
    }
    return demoVendors;
  }

  static async create(data: any) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.vendor.create({ data });
      } catch (error) {
        console.error('Vendor creation failed');
      }
    }
    return { ...data, id: `offline-${Date.now()}` };
  }
}
