const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get Product table structure from production
  const result = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'Product'
    ORDER BY ordinal_position;
  `);
  console.log('Product table columns in production:');
  console.log(result);
}

main()
  .then(() => prisma.$disconnect())
  .catch(console.error);