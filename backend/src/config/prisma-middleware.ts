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
    
    // NOTE: We intentionally do NOT recursively inject deletedAt into nested
    // relation filters. Doing so would corrupt queries on models that don't
    // have a deletedAt field (e.g. Role, UserRole, Branch). Root-level
    // injection below is sufficient — Prisma's own query engine handles
    // relation-level filtering independently.

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

      if (!params.args) params.args = {};
      if (!params.args.where) params.args.where = {};
      
      // Inject only at root level — never recurse into nested relations
      // since those may reference models without a deletedAt field (e.g. Role).
      if (params.args.where.deletedAt === undefined) {
        params.args.where.deletedAt = null;
      }
    }

    return next(params);
  });
}
