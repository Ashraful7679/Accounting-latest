import prisma from '../../config/database';
import { SequenceService } from '../company/sequence.service';

export class EquityService {
  /**
   * Automates the creation of a Capital Account and the initial investment journal entry.
   */
  static async handleOpeningCapital(companyId: string, ownerId: string, openingCapital: number, userId: string) {
    if (openingCapital <= 0) return;

    return await prisma.$transaction(async (tx: any) => {
      // 1. Fetch Company and Owner Details
      const company = await tx.company.findUnique({ where: { id: companyId } });
      const userCompany = await tx.userCompany.findFirst({
        where: { userId: ownerId, companyId },
        include: { user: true }
      });

      if (!company || !userCompany) throw new Error('Company or Owner link not found');

      const ownerShortId = ownerId.split('-')[0].toUpperCase();
      const accountName = `Capital Account - ${userCompany.user.firstName} ${userCompany.user.lastName}`;
      const accountCode = userCompany.capitalAccountCode || `CAP-O-${company.code}-${ownerShortId}`;

      // 2. Ensure Capital Account exists in COA
      let capitalAccount = await tx.account.findFirst({
        where: { companyId, name: accountName, isActive: true }
      });

      if (!capitalAccount) {
        const equityType = await tx.accountType.findUnique({ where: { name: 'EQUITY' } });
        capitalAccount = await tx.account.create({
          data: {
            code: accountCode,
            name: accountName,
            accountTypeId: equityType!.id,
            companyId,
            category: 'EQUITY',
            cashFlowType: 'FINANCING',
            isActive: true
          }
        });
      }

      // 3. Find a Cash/Bank account for the debit side
      const settlementAccount = await tx.account.findFirst({
        where: { companyId, category: 'CASH', isActive: true }
      }) || await tx.account.findFirst({
        where: { companyId, category: 'BANK', isActive: true }
      });

      if (!settlementAccount) throw new Error('No Cash or Bank account found to deposit opening capital.');

      // 4. Create Journal Entry: Dr Cash/Bank, Cr Capital
      const entryNum = await SequenceService.generateDocumentNumber(companyId, 'journal', tx);
      const journal = await tx.journalEntry.create({
        data: {
          entryNumber: entryNum,
          date: new Date(),
          companyId,
          createdById: userId,
          status: 'POSTED',
          description: `Opening Capital Investment - ${userCompany.user.firstName}`,
          reference: 'OPENING-CAPITAL',
          totalDebit: openingCapital,
          totalCredit: openingCapital,
          lines: {
            create: [
              { 
                accountId: settlementAccount.id, 
                debit: openingCapital, credit: 0, 
                debitBase: openingCapital, creditBase: 0, 
                description: `Initial Capital Deposit from ${userCompany.user.firstName}` 
              },
              { 
                accountId: capitalAccount.id, 
                debit: 0, credit: openingCapital, 
                debitBase: 0, creditBase: openingCapital, 
                description: `Equity Credit for ${userCompany.user.firstName}` 
              },
            ]
          }
        }
      });

      // 5. Update UserCompany balance
      await tx.userCompany.update({
        where: { id: userCompany.id },
        data: { 
          currentCapitalBalance: { increment: openingCapital },
          capitalAccountCode: accountCode
        }
      });

      return journal;
    });
  }
}
