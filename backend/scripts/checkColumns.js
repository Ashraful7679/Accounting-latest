const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check all tables from schema that might need deletedAt
  const tables = [
    'SalesOrder', 'Product', 'Notification', 'ActivityLog', 
    'LC', 'PI', 'Loan', 'Employee', 'EmployeeAdvance', 
    'EmployeeLoan', 'EmployeeExpense'
  ];
  
  for (const table of tables) {
    try {
      // Try to add deletedAt column
      await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;`);
      console.log('Added/verified deletedAt for', table);
    } catch(e) {
      // Table might not exist, check
      console.log('Check', table, '-', e.message.includes('does not exist') ? 'Table does not exist' : e.message);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(console.error);