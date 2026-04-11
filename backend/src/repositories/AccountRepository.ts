import prisma from '../config/database';
import { SYSTEM_MODE } from '../lib/systemMode';
import { demoAccounts } from '../lib/mockData/accounts';

export class AccountRepository {
  static async findMany(where = {}, take?: number, skip?: number) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.account.findMany({
          where,
          take,
          skip,
          include: { accountType: true },
          orderBy: { code: 'asc' }
        });
      } catch (error) {
        console.error('AccountRepository error, falling back to mock:', error);
      }
    }
    
    // OFFLINE or FAILED LIVE
    return demoAccounts;
  }

  static async findAccountTypes() {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.accountType.findMany();
      } catch (error) {
        console.error('AccountType search failed');
      }
    }
    return [
      { id: "asset-id", name: "ASSET", type: "DEBIT" },
      { id: "liability-id", name: "LIABILITY", type: "CREDIT" },
      { id: "equity-id", name: "EQUITY", type: "CREDIT" },
      { id: "income-id", name: "INCOME", type: "CREDIT" },
      { id: "expense-id", name: "EXPENSE", type: "DEBIT" },
    ];
  }

  static async findAccountTypeById(id: string) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.accountType.findUnique({ where: { id } });
      } catch (error) {
        console.error('AccountType search failed');
      }
    }
    const types = [
      { id: "asset-id", name: "ASSET", type: "DEBIT" },
      { id: "liability-id", name: "LIABILITY", type: "CREDIT" },
      { id: "equity-id", name: "EQUITY", type: "CREDIT" },
      { id: "income-id", name: "INCOME", type: "CREDIT" },
      { id: "expense-id", name: "EXPENSE", type: "DEBIT" },
    ];
    return types.find(t => t.id === id);
  }

  static async create(data: any) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.account.create({ data });
      } catch (error) {
        console.error('Account creation failed');
      }
    }
    return { ...data, id: `offline-${Date.now()}` };
  }

  static async findByCategory(companyId: string, category: string) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.account.findFirst({
          where: { companyId, category, isActive: true }
        });
      } catch (error) {
        console.error(`Account search by category ${category} failed`);
      }
    }
    return demoAccounts.find(a => a.category === category && (a as any).companyId === companyId);
  }

  static async findById(id: string) {
    if (SYSTEM_MODE === "LIVE") {
      try {
        return await prisma.account.findUnique({
          where: { id },
          include: { accountType: true }
        });
      } catch (error) {
        console.error('AccountRepository error:', error);
      }
    }
    return demoAccounts.find(a => a.id === id);
  }

  static async ensureSystemAccount(companyId: string, name: string, category: string, typeName: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE') {
    const existing = await prisma.account.findFirst({
      where: { companyId, category }
    });

    if (existing) return existing;

    const accountType = await prisma.accountType.findFirst({
      where: { name: typeName }
    });

    if (!accountType) throw new Error(`Account type ${typeName} not found`);

    // Generate a code if it doesn't exist
    // For simplicity, we'll prefix with 'SYS-' or similar, or just let users rename it later
    const code = `${category.substring(0, 3).toUpperCase()}-${Math.floor(Math.random() * 9000) + 1000}`;

    return await prisma.account.create({
      data: {
        name,
        code,
        category,
        companyId,
        accountTypeId: accountType.id,
        isActive: true,
        isSystem: true
      }
    });
  }
}
