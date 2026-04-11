import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { FinanceRepository } from '../../repositories/FinanceRepository';
import { SequenceService } from './sequence.service';
import { AccountRepository } from '../../repositories/AccountRepository';
import { NotificationController } from './notification.controller';

export class LCController {
  async getLCs(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const lcs = await (prisma as any).lC.findMany({
      where: { companyId },
      include: {
        customer: { select: { name: true, code: true } },
        vendor: { select: { name: true, code: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return reply.send({ success: true, data: lcs });
  }

  async getLCDetail(request: FastifyRequest, reply: FastifyReply) {
    const { lcId } = request.params as { lcId: string };
    const lc = await (prisma as any).lC.findUnique({
      where: { id: lcId },
      include: {
        customer: true,
        vendor: true,
        pis: {
          orderBy: { piDate: 'desc' }
        },
        payments: {
          orderBy: { date: 'desc' },
          include: {
            piAllocations: {
              include: { pi: true }
            }
          }
        },
        _count: {
          select: { pis: true, payments: true }
        }
      }
    });


    if (!lc) {
      return reply.status(404).send({ success: false, message: 'LC not found' });
    }

    return reply.send({ success: true, data: lc });
  }


  async createLC(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { piIds, ...data } = request.body as any;

    const result = await prisma.$transaction(async (tx: any) => {
      // 0. Automate LC Number if not provided
      const lcNumber = data.lcNumber || await SequenceService.generateDocumentNumber(companyId, 'lc', tx);

      // 0a. Automated Bank COA Creation
      if (data.bankName) {
        const trimmedBankName = data.bankName.trim();
        const existingBank = await tx.account.findFirst({
          where: { 
            name: { equals: trimmedBankName, mode: 'insensitive' },
            companyId,
            category: 'BANK'
          }
        });

        if (!existingBank) {
          // Find the Asset account type
          const assetType = await tx.accountType.findUnique({ where: { name: 'ASSET' } });
          const bankParent = await tx.account.findFirst({ where: { companyId, category: 'BANK_PARENT' } });

          if (assetType) {
            // Generate a code for the bank account (e.g., 1010-001)
            const count = await tx.account.count({ where: { companyId, accountTypeId: assetType.id } });
            const bankCode = `1010-${(count + 1).toString().padStart(3, '0')}`;

            await tx.account.create({
              data: {
                code: bankCode,
                name: data.bankName,
                companyId,
                accountTypeId: assetType.id,
                parentId: bankParent?.id || null,
                category: 'BANK',
                isActive: true,
                allowNegative: false
              }
            });
          }
        }
      }

      // Robust date parsing (handle empty strings which cause "Invalid Date")
      const parseDate = (d: any) => d && d !== '' ? new Date(d) : null;
      const issueDate = parseDate(data.issueDate);
      const expiryDate = parseDate(data.expiryDate);

      if (!issueDate || isNaN(issueDate.getTime())) {
        throw new Error('Valid Issue Date is required');
      }
      if (!expiryDate || isNaN(expiryDate.getTime())) {
        throw new Error('Valid Expiry Date is required');
      }

      // 1. Create the LC
      const lc = await tx.lC.create({
        data: {
          ...data,
          lcNumber,
          companyId,
          issueDate,
          expiryDate,
          amount: Number(data.amount),
          conversionRate: data.conversionRate ? Number(data.conversionRate) : 1,
          loanValue: data.loanValue ? Number(data.loanValue) : 0,
          customerId: data.customerId || null,
          vendorId: data.vendorId || null,
          receivedDate: data.receivedDate ? parseDate(data.receivedDate) : null,
          shipmentDate: data.shipmentDate ? parseDate(data.shipmentDate) : null
        }
      });

      // 2. Link PIs if provided
      if (piIds && Array.isArray(piIds) && piIds.length > 0) {
        // Validate total PI amount vs LC amount
        const pis = await (tx as any).pI.findMany({
          where: { id: { in: piIds } }
        });

        const totalPIAmount = pis.reduce((sum: number, pi: any) => sum + pi.amount, 0);
        if (totalPIAmount > Number(data.amount)) {
          throw new Error(`Total PI amount (${totalPIAmount}) cannot exceed LC amount (${data.amount})`);
        }

        await (tx as any).pI.updateMany({
          where: { id: { in: piIds } },
          data: { lcId: lc.id }
        });
      }

      return lc;
    });

    // Log Activity
    await NotificationController.logActivity({
      companyId,
      entityType: 'lc',
      entityId: result.id,
      action: 'CREATED',
      performedById: (request.user as any).id,
      metadata: { docNumber: result.lcNumber }
    });

    return reply.status(201).send({ success: true, data: result });
  }

  async updateLC(request: FastifyRequest, reply: FastifyReply) {
    const { lcId } = request.params as { lcId: string };
    const { piIds, ...data } = request.body as any;

    const result = await prisma.$transaction(async (tx: any) => {
      const existingLC = await tx.lC.findUnique({ 
        where: { id: lcId },
        include: { pis: true }
      });
      if (!existingLC) throw new Error('LC not found');

      // Guard: Prevent modification of approved/closed LCs (except for PIs if unlocked?)
      if (existingLC.status !== 'OPEN' && existingLC.status !== 'REJECTED') {
        throw new Error(`Cannot modify an LC with status: ${existingLC.status}`);
      }

      // Handle PI Associations if provided
      if (piIds !== undefined && Array.isArray(piIds)) {
        // Unlink existing PIs
        await tx.pI.updateMany({
          where: { lcId: lcId },
          data: { lcId: null }
        });

        // Link new PIs
        if (piIds.length > 0) {
          const newPis = await tx.pI.findMany({ where: { id: { in: piIds } } });
          const totalPIAmount = newPis.reduce((sum: number, pi: any) => sum + pi.amount, 0);
          
          const finalLCAmount = data.amount ? Number(data.amount) : existingLC.amount;
          if (totalPIAmount > finalLCAmount) {
            throw new Error(`Total PI amount (${totalPIAmount}) cannot exceed LC amount (${finalLCAmount})`);
          }

          await tx.pI.updateMany({
            where: { id: { in: piIds } },
            data: { lcId: lcId }
          });
        }
      }

      const updatedLC = await tx.lC.update({
        where: { id: lcId },
        data: {
          ...data,
          issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
          amount: data.amount ? Number(data.amount) : undefined,
          conversionRate: data.conversionRate ? Number(data.conversionRate) : undefined,
          loanValue: data.loanValue ? Number(data.loanValue) : undefined,
          customerId: data.customerId || undefined,
          vendorId: data.vendorId || undefined,
          receivedDate: data.receivedDate ? new Date(data.receivedDate) : undefined
        }
      });

      return updatedLC;
    });

    return reply.send({ success: true, data: result });
  }

  async deleteLC(request: FastifyRequest, reply: FastifyReply) {
    const { lcId } = request.params as { lcId: string };
    const existingLC = await (prisma as any).lC.findUnique({ where: { id: lcId } });
    
    if (!existingLC) return reply.status(404).send({ success: false, message: 'LC not found' });

    if (existingLC.status !== 'OPEN' && existingLC.status !== 'REJECTED') {
      return reply.status(400).send({ 
        success: false, 
        message: `Cannot delete an LC with status: ${existingLC.status}` 
      });
    }

    await (prisma as any).lC.delete({ where: { id: lcId } });
    return reply.send({ success: true, message: 'LC deleted' });
  }

  async approveLC(request: FastifyRequest, reply: FastifyReply) {
    const { lcId } = request.params as { id: string; lcId: string };
    const userId = (request.user as any).id;

    // LC Mandatory Attachment Rule (RMG Best Practice)
    const attachmentCount = await prisma.attachment.count({
      where: { entityType: 'LC', entityId: lcId, isActive: true }
    });

    if (attachmentCount === 0) {
      return reply.status(400).send({
        success: false,
        message: 'RMG Policy: At least one document (LC Copy) must be attached before approval.'
      });
    }

    const lc = await (prisma as any).lC.findUnique({ where: { id: lcId } });
    if (!lc) return reply.status(404).send({ success: false, message: 'LC not found' });

    const lcAmountBDT = lc.amount * (lc.conversionRate || 1);
    const journalsCreated: string[] = [];

    // Find the bank account for this LC
    const bankAccount = await prisma.account.findFirst({
      where: { companyId: lc.companyId, name: { contains: lc.bankName, mode: 'insensitive' }, category: 'BANK', isActive: true }
    }) || await AccountRepository.findByCategory(lc.companyId, 'BANK');

    if (!bankAccount) {
      return reply.status(400).send({ success: false, message: 'No bank account found. Create a bank account first.' });
    }

    // 1. LC Margin Deposit Journal
    if (lc.marginPercentage > 0) {
      const marginAmount = Math.round(lcAmountBDT * (lc.marginPercentage / 100) * 100) / 100;

      // Find or create "LC Margin Deposit" account (Asset)
      let marginAccount = await prisma.account.findFirst({
        where: { companyId: lc.companyId, name: { contains: 'LC Margin', mode: 'insensitive' }, isActive: true }
      });
      if (!marginAccount) {
        const assetType = await prisma.accountType.findFirst({ where: { name: 'ASSET' } });
        marginAccount = await prisma.account.create({
          data: {
            code: `ACC-LCM-${new Date().getFullYear()}-0001`,
            name: 'LC Margin Deposit',
            accountTypeId: assetType!.id,
            companyId: lc.companyId,
            category: 'ASSET',
            cashFlowType: 'OPERATING',
          }
        });
      }

      const entryNum = await SequenceService.generateDocumentNumber(lc.companyId, 'journal');
      await prisma.journalEntry.create({
        data: {
          entryNumber: entryNum,
          date: new Date(),
          companyId: lc.companyId,
          createdById: userId,
          status: 'APPROVED',
          description: `LC Margin Deposit - ${lc.lcNumber} (${lc.marginPercentage}%)`,
          reference: lc.lcNumber,
          totalDebit: marginAmount,
          totalCredit: marginAmount,
          lines: {
            create: [
              { accountId: marginAccount.id, debit: marginAmount, credit: 0, debitBase: marginAmount, creditBase: 0, exchangeRate: 1, description: `LC Margin - ${lc.lcNumber}` },
              { accountId: bankAccount.id, debit: 0, credit: marginAmount, debitBase: 0, creditBase: marginAmount, exchangeRate: 1, description: `LC Margin - ${lc.lcNumber}` },
            ]
          }
        }
      });
      journalsCreated.push('margin_deposit');
    }

    // 2. LC Commission / Bank Charges Journal
    if (lc.commissionRate > 0) {
      const commissionAmount = Math.round(lcAmountBDT * (lc.commissionRate / 100) * 100) / 100;

      let chargesAccount = await prisma.account.findFirst({
        where: { companyId: lc.companyId, name: { contains: 'Bank Charge', mode: 'insensitive' }, isActive: true }
      });
      if (!chargesAccount) {
        const expenseType = await prisma.accountType.findFirst({ where: { name: 'EXPENSE' } });
        chargesAccount = await prisma.account.create({
          data: {
            code: `ACC-BC-${new Date().getFullYear()}-0001`,
            name: 'Bank Charges - LC Commission',
            accountTypeId: expenseType!.id,
            companyId: lc.companyId,
            category: 'EXPENSE',
            cashFlowType: 'OPERATING',
          }
        });
      }

      const entryNum = await SequenceService.generateDocumentNumber(lc.companyId, 'journal');
      await prisma.journalEntry.create({
        data: {
          entryNumber: entryNum,
          date: new Date(),
          companyId: lc.companyId,
          createdById: userId,
          status: 'APPROVED',
          description: `LC Commission - ${lc.lcNumber} (${lc.commissionRate}%)`,
          reference: lc.lcNumber,
          totalDebit: commissionAmount,
          totalCredit: commissionAmount,
          lines: {
            create: [
              { accountId: chargesAccount.id, debit: commissionAmount, credit: 0, debitBase: commissionAmount, creditBase: 0, exchangeRate: 1, description: `LC Commission - ${lc.lcNumber}` },
              { accountId: bankAccount.id, debit: 0, credit: commissionAmount, debitBase: 0, creditBase: commissionAmount, exchangeRate: 1, description: `LC Commission - ${lc.lcNumber}` },
            ]
          }
        }
      });
      journalsCreated.push('commission');
    }

    // 3. LC Loan Auto-Creation
    if (lc.loanType !== 'NONE' && lc.loanValue > 0) {
      let loanAmount: number;
      if (lc.loanType === 'PERCENTAGE') {
        loanAmount = Math.round(lcAmountBDT * (lc.loanValue / 100) * 100) / 100;
      } else {
        loanAmount = lc.loanValue;
      }

      // Find or create LC Loan Payable account (Liability)
      let loanAccount = await prisma.account.findFirst({
        where: { companyId: lc.companyId, name: { contains: 'LC Loan', mode: 'insensitive' }, isActive: true }
      });
      if (!loanAccount) {
        const liabilityType = await prisma.accountType.findFirst({ where: { name: 'LIABILITY' } });
        loanAccount = await prisma.account.create({
          data: {
            code: `ACC-LCL-${new Date().getFullYear()}-0001`,
            name: 'LC Loan Payable',
            accountTypeId: liabilityType!.id,
            companyId: lc.companyId,
            category: 'LIABILITY',
            cashFlowType: 'FINANCING',
          }
        });
      }

      // Create Loan record
      const loanNumber = await SequenceService.generateDocumentNumber(lc.companyId, 'lc');
      await prisma.loan.create({
        data: {
          companyId: lc.companyId,
          loanNumber: `LOAN-${loanNumber}`,
          bankName: lc.bankName,
          principalAmount: loanAmount,
          interestRate: 0,
          repaymentTerm: 12,
          startDate: new Date(),
          endDate: lc.expiryDate,
          monthlyInstallment: 0,
          outstandingBalance: loanAmount,
          status: 'ACTIVE',
        }
      });

      // Journal: Dr Bank, Cr LC Loan Payable
      const entryNum = await SequenceService.generateDocumentNumber(lc.companyId, 'journal');
      await prisma.journalEntry.create({
        data: {
          entryNumber: entryNum,
          date: new Date(),
          companyId: lc.companyId,
          createdById: userId,
          status: 'APPROVED',
          description: `LC Loan Disbursement - ${lc.lcNumber}`,
          reference: lc.lcNumber,
          totalDebit: loanAmount,
          totalCredit: loanAmount,
          lines: {
            create: [
              { accountId: bankAccount.id, debit: loanAmount, credit: 0, debitBase: loanAmount, creditBase: 0, exchangeRate: 1, description: `LC Loan - ${lc.lcNumber}` },
              { accountId: loanAccount.id, debit: 0, credit: loanAmount, debitBase: 0, creditBase: loanAmount, exchangeRate: 1, description: `LC Loan - ${lc.lcNumber}` },
            ]
          }
        }
      });
      journalsCreated.push('loan_disbursement');
    }

    // Update LC status
    const updatedLC = await (prisma as any).lC.update({
      where: { id: lcId },
      data: { status: 'APPROVED' }
    });

    return reply.send({ success: true, data: updatedLC, journalsCreated });
  }
}
