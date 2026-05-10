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

      // CASCADE LOGIC: Ensure children (lines) are also soft-deleted
      // This maintains financial integrity in reports that aggregate lines directly.
      const cascades: Record<string, { model: string, foreignKey: string }[]> = {
        'Invoice': [{ model: 'invoiceLine', foreignKey: 'invoiceId' }],
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
            // We use the prisma instance passed to registerSoftDelete
            await prisma[target.model].updateMany({
              where: { [target.foreignKey]: params.args.where.id },
              data: { deletedAt: new Date() }
            });
          } catch (e) {
            console.error(`[SoftDelete Cascade Error] Failed to cascade for ${params.model} to ${target.model}:`, e);
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
      // Note: Cascade for deleteMany is more complex and depends on retrieval of IDs first.
      // For now, we prioritize single-item deletion which is standard in ERP UI.
    }

    // 2. FILTERING: Intercept 'findFirst', 'findMany', 'count' to exclude deleted items
    // Only apply if the model has a 'deletedAt' field
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

    if (softDeleteModels.includes(params.model || '')) {
      if (params.action === 'findUnique' || params.action === 'findFirst') {
        params.action = 'findFirst';
        
        if (params.args.where) {
          const prismaOperators = ['contains', 'mode', 'gte', 'lte', 'gt', 'lt', 'in', 'not', 'equals', 'search', 'startsWith', 'endsWith'];
          const whereKeys = Object.keys(params.args.where);
          for (const key of whereKeys) {
            const value = params.args.where[key];
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              const valueKeys = Object.keys(value);
              const hasOperator = valueKeys.some(k => prismaOperators.includes(k));
              
              if (!hasOperator) {
                delete params.args.where[key];
                params.args.where = { ...params.args.where, ...value };
              }
            }
          }
        }
        
        params.args.where = { ...params.args.where, deletedAt: null };
      }
      if (params.action === 'findMany' || params.action === 'count' || params.action === 'aggregate' || params.action === 'groupBy') {
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
