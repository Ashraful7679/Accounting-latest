import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const company = await prisma.company.findFirst();
  console.log('---START---');
  console.log(JSON.stringify({ companyId: company?.id }));
  console.log('---END---');
  process.exit(0);
}
main();
