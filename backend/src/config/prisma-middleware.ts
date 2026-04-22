import { Prisma } from '@prisma/client';

/**
 * Middleware to support soft-delete and multi-tenant scoping.
 * Although multi-tenancy is mostly handled in services, this layer ensures
 * that 'isDeleted' is ALWAYS respected globally unless explicitly overriden.
 */
export function registerSoftDelete(prisma: any) {
  prisma.$use(async (params: Prisma.MiddlewareParams, next: any) => {
    // 1. SOFT DELETE: Intercept 'delete' and 'deleteMany'
    if (params.action === 'delete') {
      params.action = 'update';
      params.args['data'] = { isDeleted: true, deletedAt: new Date() };
    }
    if (params.action === 'deleteMany') {
      params.action = 'updateMany';
      if (params.args.data) {
        params.args.data['isDeleted'] = true;
        params.args.data['deletedAt'] = new Date();
      } else {
        params.args['data'] = { isDeleted: true, deletedAt: new Date() };
      }
    }

    // 2. FILTERING: Intercept 'findFirst', 'findMany', 'count' to exclude deleted items
    // Only apply if the model has an 'isDeleted' field
    const softDeleteModels = [
      'Account', 'JournalEntry', 'Invoice', 'Bill', 'PurchaseOrder', 
      'ProformaInvoice', 'Product', 'Vendor', 'Customer', 'Employee', 'Company'
    ];

    if (softDeleteModels.includes(params.model || '')) {
      if (params.action === 'findUnique' || params.action === 'findFirst') {
        params.action = 'findFirst'; // findUnique doesn't support 'where' modification easily
        params.args.where = { ...params.args.where, isDeleted: false };
      }
      if (params.action === 'findMany' || params.action === 'count') {
        if (params.args.where) {
          if (params.args.where.isDeleted === undefined) {
            params.args.where = { ...params.args.where, isDeleted: false };
          }
        } else {
          params.args.where = { isDeleted: false };
        }
      }
    }

    return next(params);
  });
}
