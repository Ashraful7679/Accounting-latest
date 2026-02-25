import prisma from '../config/database';
import { SYSTEM_MODE } from '../lib/systemMode';

export const demoCustomers = [
  { id: "cus-1", code: "CUS-001", name: "Modern Garments Ltd", email: "info@moderngarments.com", phone: "+8801711223344", address: "Ghazipur, Dhaka", city: "Dhaka", country: "Bangladesh" },
  { id: "cus-2", code: "CUS-002", name: "Elegant Textiles", email: "contact@elegant.com", phone: "+8801811998877", address: "Narayanganj", city: "Dhaka", country: "Bangladesh" },
];

export class CustomerRepository {
  static async findMany(where = {}) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.customer.findMany({
          where,
          orderBy: { createdAt: 'desc' }
        });
      } catch (error) {
        console.error('Customer search failed, falling back to mock');
      }
    }
    return demoCustomers;
  }

  static async create(data: any) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.customer.create({ data });
      } catch (error) {
        console.error('Customer creation failed');
      }
    }
    return { ...data, id: `offline-${Date.now()}` };
  }
}
