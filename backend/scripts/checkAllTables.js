const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Tables referenced in dashboard controller with potential missing columns
  const tablesToCheck = [
    'Account', 'AccountType', 'AccountHierarchy',
    'ActivityLog', 'Attachment', 'BackupLog',
    'BankReconciliation', 'Bill', 'BillLine',
    'Company', 'CostCenter', 'CreditNote', 'CreditNoteLine', 'Customer',
    'DebitNote', 'DebitNoteLine',
    'Dimension', 'DocumentFlow',
    'Employee', 'EmployeeAdvance', 'EmployeeExpense', 'EmployeeLoan', 'EmployeeLoanRepayment',
    'ExchangeRate', 
    'FixedAsset',
    'GRN', 'GRNLine',
    'Invoice', 'InvoiceLine',
    'JournalEntry', 'JournalEntryLine',
    'LC', 'Loan',
    'Notification',
    'Payment', 'PaymentAllocation',
    'Period', 'PI', 'PILine', 'Product', 'Project', 'PurchaseOrder', 'PurchaseOrderLine',
    'SalesOrder', 'SalesOrderLine',
    'User', 'UserCompany', 'UserRole',
    'Vendor'
  ];

  console.log('Checking tables in production database...\n');
  
  for (const table of tablesToCheck) {
    try {
      await prisma.$executeRawUnsafe(`SELECT 1 FROM "${table}" LIMIT 1;`);
      console.log('✓', table, '- exists');
    } catch(e) {
      console.log('✗', table, '- MISSING');
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(console.error);