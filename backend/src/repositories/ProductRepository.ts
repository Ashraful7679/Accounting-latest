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

  static async adjustStock(productId: string, newAmount: number, userId: string, notes?: string) {
    return await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        include: { company: true }
      });

      if (!product) throw new Error('Product not found');

      const oldAmount = product.stockAmount;
      const diff = newAmount - oldAmount;

      if (diff === 0) return product;

      // Ensure system accounts exist
      // We need AccountRepository but within transaction we should be careful, 
      // but AccountRepository uses prisma. 
      // For simplicity here, we'll use raw prisma within the tx
      
      let inventoryAccount = await tx.account.findFirst({
        where: { companyId: product.companyId, category: 'INVENTORY' }
      });

      if (!inventoryAccount) {
        const assetType = await tx.accountType.findFirst({ where: { name: 'ASSET' } });
        inventoryAccount = await tx.account.create({
          data: {
            name: 'Inventory Asset',
            code: `INV-${Math.floor(Math.random() * 9000) + 1000}`,
            category: 'INVENTORY',
            companyId: product.companyId,
            accountTypeId: assetType!.id,
            isActive: true,
            isSystem: true
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
            code: `ADJ-${Math.floor(Math.random() * 9000) + 1000}`,
            category: 'ADJUSTMENT',
            companyId: product.companyId,
            accountTypeId: expenseType!.id,
            isActive: true,
            isSystem: true
          }
        });
      }

      // Update product stock
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: { stockAmount: newAmount }
      });

      // Calculate financial value (using unitPrice as a proxy for cost for now)
      const valueDiff = Math.abs(diff * product.unitPrice);
      
      // Create Journal Entry
      const entryNumber = `JE-STK-${Date.now().toString().slice(-6)}`;
      
      const journalEntry = await tx.journalEntry.create({
        data: {
          entryNumber,
          date: new Date(),
          description: notes || `Stock Adjustment for ${product.name}: ${oldAmount} -> ${newAmount}`,
          companyId: product.companyId,
          status: 'APPROVED',
          createdById: userId,
          totalDebit: valueDiff,
          totalCredit: valueDiff,
        }
      });

      // Increase Stock: Debit Inventory, Credit Adjustment
      // Decrease Stock: Debit Adjustment, Credit Inventory
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
