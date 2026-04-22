import prisma from '../../config/database';
import { SequenceService } from '../company/sequence.service';
import { AccountRepository } from '../../repositories/AccountRepository';

export class TradeAutomationService {
  /**
   * Processes the approval of a Letter of Credit (LC).
   * Generates required accounting journals for margin, commission, and loans.
   */
  static async approveLC(lcId: string, userId: string): Promise<any> {
    return await prisma.$transaction(async (tx: any) => {
      const lc = await tx.lC.findUnique({ 
        where: { id: lcId },
        include: { customer: true, vendor: true }
      });

      if (!lc) throw new Error('LC not found');
      if (lc.status !== 'OPEN' && lc.status !== 'REJECTED') {
        throw new Error(`Cannot approve LC with status: ${lc.status}`);
      }

      const lcAmountBDT = Number(lc.amount) * Number(lc.conversionRate || 1);
      const journalsCreated: string[] = [];

      // 1. Find the bank account
      const bankAccount = await tx.account.findFirst({
        where: { 
          companyId: lc.companyId, 
          name: { contains: lc.bankName, mode: 'insensitive' }, 
          category: 'BANK', 
          isActive: true 
        }
      }) || await tx.account.findFirst({ where: { companyId: lc.companyId, category: 'BANK' } });

      if (!bankAccount) throw new Error('No valid bank account found for this LC.');

      // 2. LC Margin Deposit Journal
      if (Number(lc.marginPercentage) > 0) {
        const marginAmount = Math.round(lcAmountBDT * (Number(lc.marginPercentage) / 100) * 100) / 100;
        const marginAccount = await this.ensureSpecialAccount(tx, lc.companyId, 'LC Margin Deposit', 'ASSET', 'LC_MARGIN');

        const entryNum = await SequenceService.generateDocumentNumber(lc.companyId, 'journal', tx);
        await tx.journalEntry.create({
          data: {
            entryNumber: entryNum,
            date: new Date(),
            companyId: lc.companyId,
            createdById: userId,
            status: 'POSTED',
            description: `LC Margin Deposit - ${lc.lcNumber} (${lc.marginPercentage}%)`,
            reference: lc.lcNumber,
            totalDebit: marginAmount,
            totalCredit: marginAmount,
            lines: {
              create: [
                { 
                  accountId: marginAccount.id, 
                  debit: marginAmount, credit: 0, 
                  debitBase: marginAmount, creditBase: 0, 
                  description: `LC Margin - ${lc.lcNumber}` 
                },
                { 
                  accountId: bankAccount.id, 
                  debit: 0, credit: marginAmount, 
                  debitBase: 0, creditBase: marginAmount, 
                  description: `LC Margin Deducted - ${lc.lcNumber}` 
                },
              ]
            }
          }
        });
        journalsCreated.push('margin_deposit');
      }

      // 3. LC Commission Journal
      if (Number(lc.commissionRate) > 0) {
        const commissionAmount = Math.round(lcAmountBDT * (Number(lc.commissionRate) / 100) * 100) / 100;
        const chargesAccount = await this.ensureSpecialAccount(tx, lc.companyId, 'LC Commission & Charges', 'EXPENSE', 'BANK_CHARGE');

        const entryNum = await SequenceService.generateDocumentNumber(lc.companyId, 'journal', tx);
        await tx.journalEntry.create({
          data: {
            entryNumber: entryNum,
            date: new Date(),
            companyId: lc.companyId,
            createdById: userId,
            status: 'POSTED',
            description: `LC Commission - ${lc.lcNumber} (${lc.commissionRate}%)`,
            reference: lc.lcNumber,
            totalDebit: commissionAmount,
            totalCredit: commissionAmount,
            lines: {
              create: [
                { 
                  accountId: chargesAccount.id, 
                  debit: commissionAmount, credit: 0, 
                  debitBase: commissionAmount, creditBase: 0, 
                  description: `LC Commission - ${lc.lcNumber}` 
                },
                { 
                  accountId: bankAccount.id, 
                  debit: 0, credit: commissionAmount, 
                  debitBase: 0, creditBase: commissionAmount, 
                  description: `LC Commission Paid - ${lc.lcNumber}` 
                },
              ]
            }
          }
        });
        journalsCreated.push('commission');
      }

      // 4. Update LC status
      const updatedLC = await tx.lC.update({
        where: { id: lcId },
        data: { status: 'APPROVED' }
      });

      return { lc: updatedLC, journalsCreated };
    });
  }

  /**
   * Distributes additional costs (freight, customs, insurance) across PI items.
   * Proportions are calculated based on the value (total BDT) of each line item.
   */
  static async distributeLandedCosts(
    piId: string, 
    costs: { description: string, amount: number, accountId: string }[], 
    userId: string
  ) {
    return await prisma.$transaction(async (tx: any) => {
      const pi = await tx.pI.findUnique({
        where: { id: piId },
        include: { lines: true }
      });

      if (!pi) throw new Error('Proforma Invoice (PI) not found');
      if (pi.lines.length === 0) throw new Error('PI has no lines to distribute costs over');

      const totalAdditionalCosts = costs.reduce((sum, c) => sum + c.amount, 0);
      const piTotalValue = pi.lines.reduce((sum: number, line: any) => sum + line.total, 0);

      // 1. Update each line with its portion of landed cost
      for (const line of pi.lines) {
        const proportion = line.total / piTotalValue;
        const lineLandedCost = totalAdditionalCosts * proportion;
        const perUnitLandedCost = lineLandedCost / line.quantity;

        await tx.pILine.update({
          where: { id: line.id },
          data: {
            landedCostAmount: { increment: perUnitLandedCost },
            totalLandedCost: { increment: lineLandedCost }
          }
        });
      }

      // 2. Create Journals for each cost item
      for (const cost of costs) {
        const entryNum = await SequenceService.generateDocumentNumber(pi.companyId, 'journal', tx);
        const inventoryAccount = await this.ensureSpecialAccount(tx, pi.companyId, 'Inventory in Transit', 'ASSET', 'INVENTORY');

        await tx.journalEntry.create({
          data: {
            entryNumber: entryNum,
            date: new Date(),
            companyId: pi.companyId,
            createdById: userId,
            status: 'POSTED',
            description: `Landed Cost: ${cost.description} (PI: ${pi.piNumber})`,
            reference: pi.piNumber,
            totalDebit: cost.amount,
            totalCredit: cost.amount,
            lines: {
              create: [
                { 
                  accountId: inventoryAccount.id, 
                  debit: cost.amount, credit: 0, 
                  debitBase: cost.amount, creditBase: 0, 
                  description: `Capitalized Cost: ${cost.description}` 
                },
                { 
                  accountId: cost.accountId, 
                  debit: 0, credit: cost.amount, 
                  debitBase: 0, creditBase: cost.amount, 
                  description: `Payment for ${cost.description}` 
                },
              ]
            }
          }
        });
      }

      return { success: true, totalDistributed: totalAdditionalCosts };
    });
  }

  /**
   * Helper to ensure a specific system account exists for trade operations.
   */
  private static async ensureSpecialAccount(tx: any, companyId: string, name: string, typeName: string, category: string) {
    let account = await tx.account.findFirst({
      where: { companyId, category, isActive: true }
    });

    if (!account) {
      const accountType = await tx.accountType.findUnique({ where: { name: typeName } });
      account = await tx.account.create({
        data: {
          code: await SequenceService.generateDocumentNumber(companyId, 'account', tx),
          name,
          accountTypeId: accountType!.id,
          companyId,
          category,
          isActive: true
        }
      });
    }
    return account;
  }
}
