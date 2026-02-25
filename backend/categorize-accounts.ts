import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function categorize() {
  const accounts = await prisma.account.findMany();
  
  for (const account of accounts) {
    let type = 'NONE';
    const name = account.name.toLowerCase();

    // Operating Inflows
    if (name.includes('export') || name.includes('sales') || name.includes('income') || name.includes('revenue')) {
      type = 'OPERATING';
    }
    // Operating Outflows
    else if (name.includes('fabric') || name.includes('accessories') || name.includes('salary') || name.includes('wage') || 
             name.includes('utility') || name.includes('electricity') || name.includes('gas') || name.includes('water') ||
             name.includes('factory') || name.includes('bank charge') || name.includes('commission')) {
      type = 'OPERATING';
    }
    // Investing
    else if (name.includes('machine') || name.includes('building') || name.includes('equipment') || name.includes('asset') && !name.includes('cash') && !name.includes('bank')) {
      type = 'INVESTING';
    }
    // Financing
    else if (name.includes('loan') || name.includes('capital') || name.includes('equity') || name.includes('dividend') || name.includes('ltr') || name.includes('pad')) {
      type = 'FINANCING';
    }

    if (type !== 'NONE') {
      await prisma.account.update({
        where: { id: account.id },
        data: { cashFlowType: type }
      });
      console.log(`Categorized ${account.name} as ${type}`);
    }
  }
}

categorize()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
