import { Prisma } from '@prisma/client';

/**
 * Middleware to support soft-delete and multi-tenant scoping.
 * Although multi-tenancy is mostly handled in services, this layer ensures
 * that 'deletedAt' is ALWAYS respected globally unless explicitly overriden.
 */
export function registerSoftDelete(prisma: any) {
  prisma.$use(async (params: Prisma.MiddlewareParams, next: any) => {
    // 1. SOFT DELETE: Intercept 'delete' and 'deleteMany'
    if (params.action === 'delete') {
      params.action = 'update';
      params.args['data'] = { deletedAt: new Date() };
    }
    if (params.action === 'deleteMany') {
      params.action = 'updateMany';
      if (params.args.data) {
        params.args.data['deletedAt'] = new Date();
      } else {
        params.args['data'] = { deletedAt: new Date() };
      }
    }

    // 2. FILTERING: Intercept 'findFirst', 'findMany', 'count' to exclude deleted items
    // Only apply if the model has a 'deletedAt' field
    const softDeleteModels = [
      'Account', 'JournalEntry', 'Invoice', 'Bill', 'PurchaseOrder', 
      'ProformaInvoice', 'Product', 'Vendor', 'Customer', 'Employee', 'Company',
      'LC', 'Loan', 'Project', 'CostCenter', 'Payment', 'ActivityLog', 'PI'
    ];

    if (softDeleteModels.includes(params.model || '')) {
      if (params.action === 'findUnique' || params.action === 'findFirst') {
        params.action = 'findFirst';
        
        // Flatten compound unique keys (e.g., { companyId_code: { companyId, code } } -> { companyId, code })
        // findFirst doesn't support the companyId_code shorthand directly in the same way findUnique does.
        if (params.args.where) {
          const prismaOperators = ['contains', 'mode', 'gte', 'lte', 'gt', 'lt', 'in', 'not', 'equals', 'search', 'startsWith', 'endsWith'];
          const whereKeys = Object.keys(params.args.where);
          for (const key of whereKeys) {
            const value = params.args.where[key];
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              // Check if this object contains any Prisma operators
              const valueKeys = Object.keys(value);
              const hasOperator = valueKeys.some(k => prismaOperators.includes(k));
              
              if (!hasOperator) {
                // This is likely a compound unique key (e.g., companyId_code)
                // We flatten it into the main where clause
                delete params.args.where[key];
                params.args.where = { ...params.args.where, ...value };
              }
            }
          }
        }
        
        params.args.where = { ...params.args.where, deletedAt: null };
      }
      if (params.action === 'findMany' || params.action === 'count') {
        if (params.args.where) {
          if (params.args.where.deletedAt === undefined) {
            params.args.where = { ...params.args.where, deletedAt: null };
          }
        } else {
          params.args.where = { deletedAt: null };
        }
      }
    }

    return next(params);
  });
}
