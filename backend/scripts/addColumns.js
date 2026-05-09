const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tables = ['PurchaseOrder', 'Invoice', 'JournalEntry', 'Payment', 'Customer', 'Vendor'];
  
  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;`);
      console.log('Added deletedAt to', table);
    } catch(e) {
      console.log('Skipped', table, '-', e.message);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(console.error);