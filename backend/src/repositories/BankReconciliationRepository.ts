// BankReconciliation model not yet in Prisma schema.
// All methods are stubbed to return empty/null safely until
// the model is added via migration.

export class BankReconciliationRepository {
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

  static async addLines(_id: string, _lines: any[]): Promise<null> {
    return null;
  }

  static async reconcileLine(
    _lineId: string,
    _journalEntryLineId?: string,
    _paymentId?: string
  ): Promise<null> {
    return null;
  }
}