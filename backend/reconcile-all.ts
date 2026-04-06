import { PrismaClient } from '@prisma/client';
import { TransactionRepository } from './src/repositories/TransactionRepository';
import process from 'process';

const prisma = new PrismaClient();

async function reconcileAll() {
  console.log('--- Starting Global Data Reconciliation ---');
  
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error('No user found to perform reconciliation.');
    return;
  }
  const userId = user.id;
  console.log(`Using System User: ${userId}`);

  // 1. Re-generate all APPROVED Invoice Journals
  const invoices = await prisma.invoice.findMany({ where: { status: 'APPROVED' } });
  console.log(`Found ${invoices.length} approved invoices.`);
  for (const inv of invoices) {
    await prisma.$transaction(async (tx) => {
      await TransactionRepository.generateInvoiceJournal(tx, inv, inv.companyId, userId);
    });
    process.stdout.write('.');
  }
  console.log('\nInvoice journals synced.');

  // 2. Re-generate all APPROVED Bill Journals
  const bills = await prisma.bill.findMany({ where: { status: 'APPROVED' } });
  console.log(`Found ${bills.length} approved bills.`);
  for (const bill of bills) {
    await prisma.$transaction(async (tx) => {
      await TransactionRepository.generateBillJournal(tx, bill, bill.companyId, userId);
    });
    process.stdout.write('.');
  }
  console.log('\nBill journals synced.');

  // 3. Re-generate all APPROVED Payment Journals
  const payments = await prisma.payment.findMany({ where: { status: 'APPROVED' } });
  console.log(`Found ${payments.length} approved payments.`);
  for (const pmt of payments) {
    try {
      await prisma.$transaction(async (tx: any) => {
        // Determine type based on linked entities
        let type: any = 'PURCHASE'; // Default
        if (pmt.invoiceId) {
          const inv = await tx.invoice.findUnique({ where: { id: pmt.invoiceId } });
          if (inv) type = inv.type;
        } else if (pmt.lcId) {
          const lc = await tx.lC.findUnique({ where: { id: pmt.lcId } });
          if (lc) type = lc.type === 'EXPORT' ? 'LC_EXPORT' : 'LC_IMPORT';
        }
        
        await TransactionRepository.generatePaymentJournal(tx, pmt, pmt.companyId, userId, type);
      }, { timeout: 10000 });
      process.stdout.write('.');
    } catch (err: any) {
      console.error(`\nError processing payment ${pmt.id}: ${err.message}`);
      if (err.meta) console.error('Meta:', err.meta);
    }
  }
  console.log('\nPayment journals synced.');

  // 4. Sync All Account Balances (The "Effect")
  const companies = await prisma.company.findMany();
  for (const company of companies) {
    console.log(`Syncing balances for company: ${company.name}...`);
    const accounts = await prisma.account.findMany({
      where: { companyId: company.id },
      include: { accountType: true }
    });

    await prisma.$transaction(async (tx) => {
      for (const account of accounts) {
        let balance = Number(account.openingBalance) || 0;
        const lines = await tx.journalEntryLine.findMany({
          where: {
            accountId: account.id,
            journalEntry: { status: 'APPROVED' }
          }
        });

        const isDebitType = account.accountType.name === 'ASSET' || account.accountType.name === 'EXPENSE';
        // Note: Better skip hardcoded names and use type field if possible
        const isDR = account.accountType.type === 'DEBIT';

        for (const line of lines) {
          const change = isDR
            ? (Number(line.debitBase) - Number(line.creditBase))
            : (Number(line.creditBase) - Number(line.debitBase));
          balance += change;
        }

        await tx.account.update({
          where: { id: account.id },
          data: { currentBalance: balance }
        });
      }
    });
  }

  console.log('\n--- Reconciliation Complete! ---');
}

reconcileAll()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
