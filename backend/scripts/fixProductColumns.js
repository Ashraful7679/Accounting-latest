const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Rename columns to proper names (camelCase)
    await prisma.$executeRawUnsafe(`ALTER TABLE "Product" RENAME COLUMN "stockamount" TO "stockAmount";`);
    console.log('Renamed stockamount -> stockAmount');
    
    // Drop duplicate columns if they exist
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Product" DROP COLUMN IF EXISTS "unittype";`);
      console.log('Dropped duplicate unittype');
    } catch(e) {}
    
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Product" DROP COLUMN IF EXISTS "isactive";`);
      console.log('Dropped duplicate isactive');
    } catch(e) {}
    
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Product" DROP COLUMN IF EXISTS "deletedat";`);
      console.log('Dropped duplicate deletedat');
    } catch(e) {}
    
    console.log('Product table fixed!');
  } catch(e) {
    console.log('Error:', e.message);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(console.error);