import prisma from '../config/database';
import { SequenceService } from '../modules/company/sequence.service';

interface FindManyOptions {
  companyId: string;
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
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

export class ProductRepository {
  static async findMany(options: FindManyOptions): Promise<PaginatedResult<any>> {
    const { companyId, page = 1, limit = 20, search, isActive } = options;
    
    const where: any = { companyId };
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } }
      ];
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          code: true,
          name: true,
          sku: true,
          description: true,
          unitType: true,
          unitPrice: true,
          stockAmount: true,
          isActive: true,
          currency: true,
          type: true,
          updatedAt: true,
          createdAt: true,
        }
      }),
      prisma.product.count({ where })
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
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
  }>) {
    return prisma.product.update({ where: { id }, data });
  }

  static async delete(id: string) {
    return prisma.product.delete({ where: { id } });
  }

  static async adjustStock(productId: string, adjustmentAmount: number, userId: string, notes?: string) {
    return await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        include: { company: true }
      });

      if (!product) throw new Error('Product not found');

      const oldAmount = product.stockAmount;
      const diff = adjustmentAmount;
      const newAmount = oldAmount + diff;

      if (diff === 0) return product;

      let inventoryAccount = await tx.account.findFirst({
        where: { companyId: product.companyId, category: 'INVENTORY' }
      });

      if (!inventoryAccount) {
        const assetType = await tx.accountType.findFirst({ where: { name: 'ASSET' } });
        inventoryAccount = await tx.account.create({
          data: {
            name: 'Inventory Asset',
            code: await SequenceService.generateDocumentNumber(product.companyId, 'account', tx),
            category: 'INVENTORY',
            companyId: product.companyId,
            accountTypeId: assetType!.id,
            isActive: true
          }
        });
      }

      let adjustmentAccount = await tx.account.findFirst({
        where: { companyId: product.companyId, category: 'ADJUSTMENT' }
      });

      if (!adjustmentAccount) {
        const expenseType = await tx.accountType.findFirst({ where: { name: 'EXPENSE' } });
        adjustmentAccount = await tx.account.create({
          data: {
            name: 'Inventory Adjustment',
            code: await SequenceService.generateDocumentNumber(product.companyId, 'account', tx),
            category: 'ADJUSTMENT',
            companyId: product.companyId,
            accountTypeId: expenseType!.id,
            isActive: true
          }
        });
      }

      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: { stockAmount: newAmount }
      });

      const valueDiff = Math.abs(diff * product.unitPrice);
      
      const entryNumber = await SequenceService.generateDocumentNumber(product.companyId, 'journal', tx);
      
      const journalEntry = await tx.journalEntry.create({
        data: {
          entryNumber,
          date: new Date(),
          description: notes || `Stock Adjustment for ${product.name}: ${oldAmount} -> ${newAmount} (Adj: ${diff > 0 ? '+' : ''}${diff})`,
          companyId: product.companyId,
          status: 'APPROVED',
          createdById: userId,
          totalDebit: valueDiff,
          totalCredit: valueDiff,
        }
      });

      if (diff > 0) {
        await tx.journalEntryLine.create({
          data: {
            journalEntryId: journalEntry.id,
            accountId: inventoryAccount.id,
            debit: valueDiff,
            credit: 0
          }
        });
        await tx.journalEntryLine.create({
          data: {
            journalEntryId: journalEntry.id,
            accountId: adjustmentAccount.id,
            debit: 0,
            credit: valueDiff
          }
        });
      } else {
        await tx.journalEntryLine.create({
          data: {
            journalEntryId: journalEntry.id,
            accountId: adjustmentAccount.id,
            debit: valueDiff,
            credit: 0
          }
        });
        await tx.journalEntryLine.create({
          data: {
            journalEntryId: journalEntry.id,
            accountId: inventoryAccount.id,
            debit: 0,
            credit: valueDiff
          }
        });
      }

      return updatedProduct;
    });
  }
}