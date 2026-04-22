
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testTransferError() {
  const companyId = '235280c2-f037-4249-8696-bc38738a190e';
  
  try {
    // 1. Find any account
    const account = await prisma.account.findFirst({
      where: { companyId }
    });
    
    if (!account) {
      console.log('No bank account found for testing');
      return;
    }

    console.log('Creating a dummy transfer payment...');
    const pmt = await (prisma as any).payment.create({
      data: {
        paymentNumber: `TRF-TEST-${Date.now()}`,
        companyId,
        date: new Date(),
        amount: 100,
        method: 'TRANSFER',
        description: 'Test Transfer',
        accountId: account.id,
        status: 'PENDING_VERIFICATION'
      }
    });
    console.log('Created payment:', pmt.id);

    console.log('Listing payments...');
    const payments = await (prisma as any).payment.findMany({
      where: { companyId, method: 'TRANSFER' },
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
    
    // Cleanup
    await (prisma as any).payment.delete({ where: { id: pmt.id } });
    console.log('Cleanup done');
    
    process.exit(0);
  } catch (error: any) {
    console.error('Error in transfer test:', error);
    process.exit(1);
  }
}

testTransferError();
