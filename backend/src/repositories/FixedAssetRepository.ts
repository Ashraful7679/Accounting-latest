// FixedAsset / FixedAssetDepreciation models not yet in Prisma schema.
// All methods are stubbed to return empty/null safely until
// the models are added via migration.

export class FixedAssetRepository {
  static async findMany(_where = {}): Promise<any[]> {
    return [];
  }

  static async findById(_id: string): Promise<null> {
    return null;
  }

  static async create(data: any): Promise<any> {
    return { ...data, id: `offline-${Date.now()}` };
  }

  static async update(_id: string, _data: any): Promise<null> {
    return null;
  }

  static async delete(_id: string): Promise<null> {
    return null;
  }

  static async getDepreciationEntries(_fixedAssetId: string): Promise<any[]> {
    return [];
  }

  static async createDepreciation(
    _fixedAssetId: string,
    _period: string,
    _amount: number,
    _accumulated: number,
    _bookValue: number
  ): Promise<null> {
    return null;
  }
}