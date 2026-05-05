import prisma from '../config/database';
import { SYSTEM_MODE } from '../lib/systemMode';

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
        let depreciationAmount = 0;
        if (asset.depreciationMethod === 'STRAIGHT_LINE') {
          depreciationAmount = (asset.purchaseValue - asset.salvageValue) / asset.usefulLife / 12;
        } else if (asset.depreciationMethod === 'DECLINING_BALANCE') {
          depreciationAmount = (asset.currentValue * (asset.depreciationRate || 0.2)) / 12;
        }

        const newAccumulated = asset.accumulatedDepreciation + depreciationAmount;
        const newCurrentValue = asset.purchaseValue - newAccumulated;
        const newStatus = newCurrentValue <= asset.salvageValue ? 'FULLY_DEPRECATED' : 'ACTIVE';
        const isDepreciated = newCurrentValue <= asset.salvageValue;

        await p.fixedAsset.update({
          where: { id: asset.id },
          data: {
            accumulatedDepreciation: newAccumulated,
            currentValue: Math.max(newCurrentValue, asset.salvageValue),
            status: newStatus,
            isDepreciated,
            lastDepreciationDate: now
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