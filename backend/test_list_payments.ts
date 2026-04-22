
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testListPayments() {
  const companyId = '235280c2-f037-4249-8696-bc38738a190e';
  const method = 'TRANSFER';
  
  try {
    console.log('Fetching payments...');
    const payments = await (prisma as any).payment.findMany({
      where: { companyId, method },
      include: { 
        invoice: true, 
        bill: true, 
        account: true,
        lc: true,
        piAllocations: {
          include: { pi: true }
        }
      },
      orderBy: { date: 'desc' }
    });
    console.log('Payments found:', payments.length);
    process.exit(0);
  } catch (error: any) {
    console.error('Error fetching payments:', error);
    process.exit(1);
  }
}

testListPayments();
