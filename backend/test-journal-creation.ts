
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const companyId = '498a49fa-03bb-43c2-ab5b-bb8690eb7a62';
  const userId = '8ce2fc8c-216d-4064-8516-9aedeb1a2c87'; // Ashraful Sulaiman
  
  // Get an account
  const account = await prisma.account.findFirst({ where: { companyId } });
  if (!account) {
    console.error('No account found for company');
    return;
  }

  console.log('Using account:', account.code);

  const entryNumber = "T-JE-" + Date.now();
  
  try {
    const journal = await prisma.journalEntry.create({
      data: {
        entryNumber,
        companyId,
        date: new Date(),
        description: "Test creation",
        totalDebit: 100,
        totalCredit: 100,
        createdById: userId,
        status: 'PENDING_VERIFICATION',
        lines: {
          create: [
            {
              accountId: account.id,
              debit: 100,
              credit: 0,
              debitBase: 100,
              creditBase: 0,
              debitForeign: 100,
              creditForeign: 0,
              exchangeRate: 1
            },
            {
              accountId: account.id, // Using same account for simplicity
              debit: 0,
              credit: 100,
              debitBase: 0,
              creditBase: 100,
              debitForeign: 0,
              creditForeign: 100,
              exchangeRate: 1
            }
          ]
        }
      }
    });
    console.log('---SUCCESS---');
    console.log('Created journal ID:', journal.id);
  } catch (err: any) {
    console.error('---FAILURE---');
    console.error(err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
