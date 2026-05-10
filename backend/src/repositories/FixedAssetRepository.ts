import prisma from '../config/database';
import { SYSTEM_MODE } from '../lib/systemMode';
import { TransactionRepository } from './TransactionRepository';

interface FindManyOptions {
  companyId: string;
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
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

const emptyResult = { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };

export class FixedAssetRepository {
  static async findMany(options: FindManyOptions): Promise<PaginatedResult<any>> {
    if (SYSTEM_MODE !== 'LIVE') return emptyResult;
    
    try {
      const p = prisma as any;
      if (!p.fixedAsset) return emptyResult;
      
      const { companyId, page = 1, limit = 20, search, status } = options;
      const where: any = { companyId };
      if (status) where.status = status;
      if (search) {
        where.OR = [
          { assetName: { contains: search } },
          { assetNumber: { contains: search } }
        ];
      }

      const skip = (page - 1) * limit;
      const [data, total] = await Promise.all([
        p.fixedAsset.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        p.fixedAsset.count({ where })
      ]);

      return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    } catch {
      return emptyResult;
    }
  }

  static async findById(id: string): Promise<any> {
    if (SYSTEM_MODE !== 'LIVE') return null;
    try {
      const p = prisma as any;
      return p.fixedAsset?.findUnique?.({ where: { id } }) || null;
    } catch {
      return null;
    }
  }

  static async create(data: any): Promise<any> {
    if (SYSTEM_MODE !== 'LIVE') return { ...data, id: `offline-${Date.now()}` };
    try {
      const p = prisma as any;
      return p.fixedAsset?.create?.({ data: { ...data, currentValue: data.purchaseValue } }) || data;
    } catch {
      return data;
    }
  }

  static async update(id: string, data: any): Promise<any> {
    if (SYSTEM_MODE !== 'LIVE') return { id, ...data };
    try {
      const p = prisma as any;
      return p.fixedAsset?.update?.({ where: { id }, data }) || data;
    } catch {
      return data;
    }
  }

  static async delete(id: string): Promise<void> {
    if (SYSTEM_MODE !== 'LIVE') return;
    try {
      const p = prisma as any;
      await p.fixedAsset?.delete?.({ where: { id } });
    } catch {}
  }

  static async verifyAsset(id: string, userId: string): Promise<any> {
    if (SYSTEM_MODE !== 'LIVE') return { id, status: 'VERIFIED' };
    const p = prisma as any;
    return await p.fixedAsset.update({
      where: { id },
      data: {
        status: 'VERIFIED',
        verifiedById: userId,
        verifiedAt: new Date()
      }
    });
  }

  static async approveAsset(id: string, userId: string): Promise<any> {
    if (SYSTEM_MODE !== 'LIVE') return { id, status: 'APPROVED' };
    const p = prisma as any;
    return await p.fixedAsset.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
        depreciationStartDate: new Date()
      }
    });
  }

  static async runDepreciation(companyId: string): Promise<any[]> {
    if (SYSTEM_MODE !== 'LIVE') return [];
    try {
      const p = prisma as any;
      if (!p.fixedAsset) return [];
      
      const assets = await p.fixedAsset.findMany({
        where: { companyId, status: 'ACTIVE', isDepreciated: false }
      });

      const results = [];
      const now = new Date();

      for (const asset of assets) {
        // Only depreciate if approved and active
        if (asset.status !== 'APPROVED' && asset.status !== 'ACTIVE') continue;

        let depreciationAmount = 0;
        if (asset.depreciationMethod === 'STRAIGHT_LINE') {
          depreciationAmount = (asset.purchaseValue - asset.salvageValue) / (asset.usefulLife || 1) / 12;
        } else if (asset.depreciationMethod === 'DECLINING_BALANCE') {
          depreciationAmount = (asset.currentValue * (asset.depreciationRate || 0.2)) / 12;
        }

        if (depreciationAmount <= 0) continue;

        const newAccumulated = asset.accumulatedDepreciation + depreciationAmount;
        const newCurrentValue = asset.purchaseValue - newAccumulated;
        const isDepreciated = newCurrentValue <= asset.salvageValue;
        const newStatus = isDepreciated ? 'FULLY_DEPRECATED' : 'ACTIVE';

        await prisma.$transaction(async (tx: any) => {
          // 1. Update Asset
          await tx.fixedAsset.update({
            where: { id: asset.id },
            data: {
              accumulatedDepreciation: newAccumulated,
              currentValue: Math.max(newCurrentValue, asset.salvageValue),
              status: newStatus,
              isDepreciated,
              lastDepreciationDate: now
            }
          });

          // 2. Create Journal Entry
          if (asset.depreciationAccountId && asset.accumulatedDepreciationAccountId) {
            const entryNumber = `DEP-${asset.assetNumber}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            await tx.journalEntry.create({
              data: {
                entryNumber,
                companyId,
                date: now,
                description: `Monthly Depreciation - ${asset.assetName} (${asset.assetNumber})`,
                reference: asset.assetNumber,
                totalDebit: depreciationAmount,
                totalCredit: depreciationAmount,
                status: 'APPROVED',
                approvedAt: now,
                lines: {
                  create: [
                    {
                      accountId: asset.depreciationAccountId,
                      debit: depreciationAmount,
                      credit: 0,
                      debitBase: depreciationAmount,
                      creditBase: 0,
                      description: `Depreciation Expense - ${asset.assetName}`
                    },
                    {
                      accountId: asset.accumulatedDepreciationAccountId,
                      debit: 0,
                      credit: depreciationAmount,
                      debitBase: 0,
                      creditBase: depreciationAmount,
                      description: `Accumulated Depreciation - ${asset.assetName}`
                    }
                  ]
                }
              }
            });
          }
        });

        results.push({ assetId: asset.id, assetNumber: asset.assetNumber, depreciation: depreciationAmount });
      }

      return results;
    } catch {
      return [];
    }
  }

  static async dispose(assetId: string, saleValue: number, createJournal: boolean): Promise<any> {
    if (SYSTEM_MODE !== 'LIVE') return { assetId, saleValue, gainLoss: 0 };
    try {
      const p = prisma as any;
      if (!p.fixedAsset) return { assetId, saleValue, gainLoss: 0 };
      
      const asset = await p.fixedAsset.findUnique({ where: { id: assetId } });
      if (!asset) throw new Error('Asset not found');

      const gainLoss = saleValue - asset.currentValue;

      await p.fixedAsset.update({
        where: { id: assetId },
        data: { status: 'DISPOSED', isDepreciated: true }
      });

      return { assetId, saleValue, gainLoss, disposedAt: new Date() };
    } catch {
      return { assetId, saleValue, gainLoss: 0 };
    }
  }
}