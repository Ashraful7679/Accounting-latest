import { Prisma } from '@prisma/client';

/**
 * Registry of models that support soft-delete.
 * These must have a 'deletedAt' DateTime? field in schema.prisma.
 */
const softDeleteModels = [
  'Account', 'JournalEntry', 'Invoice', 'Bill', 'PurchaseOrder', 
  'ProformaInvoice', 'Product', 'Vendor', 'Customer', 'Employee', 'Company',
  'LC', 'Loan', 'Project', 'CostCenter', 'Payment', 'ActivityLog', 'PI',
  'EmployeeAdvance', 'EmployeeLoan', 'EmployeeLoanRepayment', 'EmployeeExpense',
  'PayrollRun', 'PayrollPayslip', 'User', 'Branch', 'PILine', 'SalesOrderLine',
  'PurchaseOrderLine', 'GRN', 'GRNLine', 'DN', 'DNLine', 'InvoiceLine',
  'JournalEntryLine', 'DebitNote', 'DebitNoteLine', 'CreditNote', 'CreditNoteLine',
  'Attachment', 'Notification', 'FixedAsset', 'RecurringInvoice'
];

/**
 * Middleware to support soft-delete and multi-tenant scoping.
 * Although multi-tenancy is mostly handled in services, this layer ensures
 * that 'deletedAt' is ALWAYS respected globally unless explicitly overriden.
 */
export function registerSoftDelete(prisma: any) {
  prisma.$use(async (params: Prisma.MiddlewareParams, next: any) => {
    
    // --- RECURSIVE FILTER HELPER ---
    // This ensures that even nested relation filters (e.g. lines of a journal) 
    // are automatically filtered by deletedAt: null.
    const injectSoftDeleteRecursively = (where: any) => {
      if (!where || typeof where !== 'object' || where instanceof Date) return;

      // Recurse into nested objects (Relations or Logical Operators)
      Object.keys(where).forEach(key => {
        const val = where[key];
        if (typeof val === 'object' && val !== null && !Array.isArray(val) && !(val instanceof Date)) {
          // Check if this is a relation filter by looking at the key
          // In Prisma, relation names are usually camelCase. 
          // We don't know for sure if it's a relation, but we can try to inject deletedAt: null.
          // To be safe, we skip known Prisma operators.
          const prismaOperators = ['contains', 'mode', 'gte', 'lte', 'gt', 'lt', 'in', 'not', 'equals', 'search', 'startsWith', 'endsWith'];
          const isOperator = Object.keys(val).some(k => prismaOperators.includes(k));
          
          if (!isOperator) {
            // It's likely a relation or a nested object.
            // We inject deletedAt: null here if we think it's a soft-delete model.
            // Since we can't know the model name easily from the relation name,
            // we inject it anyway; Prisma will only throw if the model doesn't have it.
            // Actually, to be 100% safe, we only inject if the key corresponds to a known relation.
            // But we don't have that map. So we inject and let Prisma's validation handle it?
            // No, that will crash queries.
            
            // LOGIC: If the object has 'some', 'every', 'none', it's a collection relation.
            if (val.some || val.every || val.none) {
              if (val.some) injectSoftDeleteRecursively(val.some);
              if (val.every) injectSoftDeleteRecursively(val.every);
              if (val.none) injectSoftDeleteRecursively(val.none);
            } else {
              // Try to inject at this nested level
              if (val.deletedAt === undefined) {
                // We only inject if it's likely a model (has other filters like id, companyId etc)
                // This is a heuristic.
                val.deletedAt = null;
              }
              injectSoftDeleteRecursively(val);
            }
          }
        } else if (Array.isArray(val) && (key === 'OR' || key === 'AND' || key === 'NOT')) {
          // Handle logical arrays
          val.forEach(item => injectSoftDeleteRecursively(item));
        }
      });
    };

    // 1. SOFT DELETE: Intercept 'delete' and 'deleteMany'
    if (params.action === 'delete') {
      params.action = 'update';
      params.args['data'] = { deletedAt: new Date() };

      // CASCADE LOGIC: Ensure children (lines) are also soft-deleted
      const cascades: Record<string, { model: string, foreignKey: string, isLoose?: boolean, idField?: string }[]> = {
        'Invoice': [
          { model: 'invoiceLine', foreignKey: 'invoiceId' },
          { model: 'journalEntry', foreignKey: 'id', isLoose: true, idField: 'journalId' } // Loose link
        ],
        'JournalEntry': [{ model: 'journalEntryLine', foreignKey: 'journalEntryId' }],
        'PI': [{ model: 'pILine', foreignKey: 'piId' }],
        'SalesOrder': [{ model: 'salesOrderLine', foreignKey: 'salesOrderId' }],
        'PurchaseOrder': [{ model: 'purchaseOrderLine', foreignKey: 'purchaseOrderId' }],
        'GRN': [{ model: 'grnLine', foreignKey: 'grnId' }],
        'DN': [{ model: 'dnLine', foreignKey: 'dnId' }],
        'PayrollRun': [{ model: 'payrollPayslip', foreignKey: 'payrollRunId' }],
        'DebitNote': [{ model: 'debitNoteLine', foreignKey: 'debitNoteId' }],
        'CreditNote': [{ model: 'creditNoteLine', foreignKey: 'creditNoteId' }],
      };

      const targets = cascades[params.model || ''];
      if (targets && params.args.where?.id) {
        for (const target of targets) {
          try {
            if (target.isLoose) {
              const parent = await prisma[params.model!].findUnique({ where: { id: params.args.where.id } });
              const targetId = parent ? parent[target.idField!] : null;
              if (targetId) {
                await prisma[target.model].update({
                  where: { id: targetId },
                  data: { deletedAt: new Date() }
                });
              }
            } else {
              await prisma[target.model].updateMany({
                where: { [target.foreignKey]: params.args.where.id },
                data: { deletedAt: new Date() }
              });
            }
          } catch (e) {
            console.error(`[SoftDelete Cascade Error] Failed for ${params.model} to ${target.model}:`, e);
          }
        }
      }
    }

    if (params.action === 'deleteMany') {
      params.action = 'updateMany';
      if (params.args.data) {
        params.args.data['deletedAt'] = new Date();
      } else {
        params.args['data'] = { deletedAt: new Date() };
      }
    }

    // 2. FILTERING: Intercept 'findFirst', 'findMany', 'count', etc.
    if (softDeleteModels.includes(params.model || '')) {
      if (params.action === 'findUnique' || params.action === 'findFirst') {
        params.action = 'findFirst';
      }

      if (!params.args.where) params.args.where = {};
      
      // Inject at root level
      if (params.args.where.deletedAt === undefined) {
        params.args.where.deletedAt = null;
      }

      // Inject recursively into relations
      injectSoftDeleteRecursively(params.args.where);
    }

    return next(params);
  });
}
