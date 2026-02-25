
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const companyId = '498a49fa-03bb-43c2-ab5b-bb8690eb7a62';
  const journals = await prisma.journalEntry.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    include: { createdBy: true }
  });

  console.log('---START---');
  journals.forEach(j => {
    console.log(`${j.entryNumber} | ${j.status} | ${j.createdAt}`);
  });
  console.log('---END---');
}

main().catch(console.error).finally(() => prisma.$disconnect());
