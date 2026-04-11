import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addMissingAccounts() {
  console.log('--- Adding Missing Revenue & Expense Accounts to All Companies ---');
  
  const companies = await prisma.company.findMany();
  const allAccountTypes = await prisma.accountType.findMany();
  
  const incomeType = allAccountTypes.find(at => at.name === 'INCOME');
  const expenseType = allAccountTypes.find(at => at.name === 'EXPENSE');

  if (!incomeType || !expenseType) {
    console.error('Missing INCOME or EXPENSE account types in database.');
    return;
  }

  for (const company of companies) {
    console.log(`Checking accounts for ${company.name}...`);
    
    // Check Revenue
    const revenueAcc = await prisma.account.findFirst({
      where: { companyId: company.id, name: 'Revenue' }
    });
    const revenueCode = `${company.code}-4000`;
    const revenueByCode = await prisma.account.findUnique({
      where: { code: revenueCode }
    });

    if (!revenueAcc && !revenueByCode) {
      console.log(`Creating Revenue account for ${company.name}`);
      await prisma.account.create({
        data: {
          code: revenueCode,
          name: 'Revenue',
          companyId: company.id,
          accountTypeId: incomeType.id,
          isActive: true,
          openingBalance: 0,
          currentBalance: 0
        }
      });
    }

    // Check Expense
    const expenseAcc = await prisma.account.findFirst({
      where: { companyId: company.id, name: 'Expense' }
    });
    const expenseCode = `${company.code}-5000`;
    const expenseByCode = await prisma.account.findUnique({
      where: { code: expenseCode }
    });

    if (!expenseAcc && !expenseByCode) {
      console.log(`Creating Expense account for ${company.name}`);
      await prisma.account.create({
        data: {
          code: expenseCode,
          name: 'Expense',
          companyId: company.id,
          accountTypeId: expenseType.id,
          isActive: true,
          openingBalance: 0,
          currentBalance: 0
        }
      });
    }
  }

  console.log('--- Default Accounts Sync Complete! ---');
}

addMissingAccounts()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
