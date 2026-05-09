const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Product table columns that might be missing
  const columns = [
    'stockAmount REAL DEFAULT 0',
    'unitType TEXT DEFAULT \'PCS\'',
    'isActive BOOLEAN DEFAULT true',
    'currency TEXT DEFAULT \'BDT\'',
    'type TEXT DEFAULT \'Sales\'',
    'deletedAt TIMESTAMP'
  ];
  
  for (const col of columns) {
    try {
      const colName = col.split(' ')[0];
      await prisma.$executeRawUnsafe(`ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS ${colName} ${col.split(' ').slice(1).join(' ')};`);
      console.log('Added', colName, 'to Product');
    } catch(e) {
      console.log('Skip', col.split(' ')[0], '-', e.message.includes('already exists') ? 'exists' : 'error');
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(console.error);