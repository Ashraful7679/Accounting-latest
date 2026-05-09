const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Create the SalesOrder table if it doesn't exist
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SalesOrder" (
        "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        "companyId" TEXT NOT NULL,
        "customerId" TEXT,
        "soNumber" TEXT NOT NULL,
        "soDate" TIMESTAMP NOT NULL DEFAULT NOW(),
        "deliveryDate" TIMESTAMP,
        "status" TEXT DEFAULT 'PENDING',
        "totalAmount" REAL DEFAULT 0,
        "totalBDT" REAL DEFAULT 0,
        "currency" TEXT DEFAULT 'USD',
        "exchangeRate" REAL DEFAULT 1,
        "notes" TEXT,
        "deletedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log('Created SalesOrder table');
  } catch(e) {
    console.log('Error:', e.message);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(console.error);