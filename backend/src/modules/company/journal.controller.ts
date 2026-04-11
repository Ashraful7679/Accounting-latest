import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { TransactionRepository } from '../../repositories/TransactionRepository';
import { NotificationController } from './notification.controller';
import { NotFoundError, ForbiddenError, ValidationError } from '../../middleware/errorHandler';
import { BaseCompanyController } from './base.controller';

export class JournalController extends BaseCompanyController {
  // ============ JOURNALS ============
  async getJournals(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { limit, page } = request.query as { limit?: string; page?: string };
    
    const take = limit ? parseInt(limit) : undefined;
    const skip = (page && take) ? (parseInt(page) - 1) * take : undefined;

    const journals = await TransactionRepository.findJournals({ companyId }, take, skip);
    return reply.send({ success: true, data: journals });
  }

  async getJournal(request: FastifyRequest, reply: FastifyReply) {
    const { journalId } = request.params as { journalId: string };
    const journal = await TransactionRepository.findJournalById(journalId);
    if (!journal) throw new NotFoundError('Journal not found');
    return reply.send({ success: true, data: journal });
  }

  async createJournal(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const data = request.body as any;
    const userId = (request.user as any).id;
    
    try {
      const entryNumber = await this.generateDocumentNumber(companyId, 'journal');

      if (!data.lines || !Array.isArray(data.lines)) {
        throw new ValidationError('Journal lines are required and must be an array');
      }

      const lineDebit = (l: any): number =>
        l.debitCredit !== undefined ? (l.debitCredit === 'debit' ? Number(l.amount) : 0) : Number(l.debit || 0);
      const lineCredit = (l: any): number =>
        l.debitCredit !== undefined ? (l.debitCredit === 'credit' ? Number(l.amount) : 0) : Number(l.credit || 0);

      const totalDebit = data.lines.reduce((sum: number, line: any) => sum + lineDebit(line), 0);
      const totalCredit = data.lines.reduce((sum: number, line: any) => sum + lineCredit(line), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new ValidationError(`Debit (${totalDebit}) and Credit (${totalCredit}) must be equal`);
      }

      if (!data.date) {
        throw new ValidationError('Transaction date is required');
      }

      const journalDate = new Date(data.date);
      const role = await this.getUserRole(userId, companyId);
      const isOwnerOrAdmin = role === 'Owner' || role === 'Admin';

      const status = (role === 'Accountant' || isOwnerOrAdmin) ? 'PENDING_VERIFICATION' : 'DRAFT';

      const journal = await TransactionRepository.createJournal({
        description: data.description || null,
        reference: data.reference || null,
        currencyId: data.currencyId || null,
        exchangeRate: Number(data.exchangeRate || 1),
        date: journalDate,
        entryNumber,
        companyId,
        totalDebit,
        totalCredit,
        createdById: userId,
        status,
        lines: {
          create: (data.lines || []).map((l: any, idx: number) => {
            const debit = lineDebit(l);
            const credit = lineCredit(l);
            const rate = Number(l.exchangeRate || data.exchangeRate || 1);
            if (!l.accountId) {
              throw new ValidationError(`Line ${idx + 1} is missing an Account ID`);
            }
            return {
              accountId: l.accountId,
              projectId: l.projectId || null,
              costCenterId: l.costCenterId || null,
              customerId: l.customerId || null,
              vendorId: l.vendorId || null,
              description: l.description || null,
              debit,
              credit,
              debitBase: l.debitBase != null ? Number(l.debitBase) : debit * rate,
              creditBase: l.creditBase != null ? Number(l.creditBase) : credit * rate,
              debitForeign: l.debitForeign != null ? Number(l.debitForeign) : debit,
              creditForeign: l.creditForeign != null ? Number(l.creditForeign) : credit,
              exchangeRate: rate,
            };
          }),
        },
      });
      
      await NotificationController.logActivity({
        companyId,
        entityType: 'journal',
        entityId: journal.id,
        action: 'CREATED',
        performedById: userId,
        metadata: { docNumber: entryNumber }
      });

      if (status === 'PENDING_VERIFICATION') {
        await prisma.notification.create({
          data: {
            companyId,
            type: 'PENDING_JOURNAL',
            severity: 'WARNING',
            title: 'New Voucher Awaiting Verification',
            message: `Journal ${entryNumber} has been created and is awaiting verification.`,
            entityType: 'JournalEntry',
            entityId: journal.id
          }
        });
      }

      return reply.status(201).send({ success: true, data: journal });
    } catch (error: any) {
      console.error('[CreateJournal] CRITICAL ERROR:', error);
      return reply.status(error.statusCode || 500).send({ 
        success: false, 
        error: {
          message: error.message || 'Internal server error during journal creation',
          detail: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      });
    }
  }

  async updateJournal(request: FastifyRequest, reply: FastifyReply) {
    const { journalId } = request.params as { journalId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;
    const data = request.body as any;

    const role = await this.getUserRole(userId, companyId);
    const journal = await (prisma as any).journalEntry.findUnique({ where: { id: journalId } });

    if (!journal) throw new NotFoundError('Journal not found');

    if (!this.canEdit(journal.status, role, userId, journal.createdById)) {
      throw new ForbiddenError('Cannot edit this journal in current status');
    }

    const { lines, ...otherData } = data;

    const updated = await prisma.$transaction(async (tx: any) => {
      if (lines) {
        await tx.journalEntryLine.deleteMany({ where: { journalEntryId: journalId } });
      }

      return await tx.journalEntry.update({
        where: { id: journalId },
        data: {
          ...otherData,
          date: otherData.date ? new Date(otherData.date) : undefined,
          lines: lines ? {
            create: lines.map((l: any) => ({
              accountId: l.accountId,
              description: l.description,
              debit: l.debitCredit === 'debit' ? Number(l.amount) : 0,
              credit: l.debitCredit === 'credit' ? Number(l.amount) : 0,
              debitBase: l.debitCredit === 'debit' ? Number(l.amount) : 0,
              creditBase: l.debitCredit === 'credit' ? Number(l.amount) : 0,
            }))
          } : undefined
        },
        include: { lines: true },
      });
    });

    return reply.send({ success: true, data: updated });
  }

  async deleteJournal(request: FastifyRequest, reply: FastifyReply) {
    const { journalId } = request.params as { journalId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;

    const role = await this.getUserRole(userId, companyId);
    const journal = await prisma.journalEntry.findUnique({ where: { id: journalId } });

    if (!journal) throw new NotFoundError('Journal not found');

    if (!this.canDelete(journal.status, role)) {
      throw new ForbiddenError('Cannot delete this journal');
    }

    await prisma.journalEntry.delete({ where: { id: journalId } });
    return reply.send({ success: true, message: 'Journal deleted' });
  }

  async verifyJournal(request: FastifyRequest, reply: FastifyReply) {
    const { journalId } = request.params as { journalId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;

    const role = await this.getUserRole(userId, companyId);
    const journal = await prisma.journalEntry.findUnique({ where: { id: journalId } });

    if (!journal) throw new NotFoundError('Journal not found');

    if (!this.canVerify(journal.status, role)) {
      throw new ForbiddenError('Cannot verify this journal');
    }

    const updated = await prisma.journalEntry.update({
      where: { id: journalId },
      data: {
        status: 'VERIFIED',
        verifiedById: userId,
        verifiedAt: new Date(),
      },
    });

    await NotificationController.notifyStatusChange({
      companyId: journal.companyId,
      entityType: 'JournalEntry',
      entityId: journal.id,
      entityNumber: journal.entryNumber,
      oldStatus: journal.status,
      newStatus: 'VERIFIED',
      performedById: userId
    });

    return reply.send({ success: true, data: updated });
  }

  async rejectJournal(request: FastifyRequest, reply: FastifyReply) {
    const { journalId } = request.params as { journalId: string };
    const { id: companyId } = request.params as { id: string };
    const { reason } = request.body as { reason: string };
    const userId = (request.user as any).id;

    const role = await this.getUserRole(userId, companyId);
    const journal = await prisma.journalEntry.findUnique({ where: { id: journalId } });

    if (!journal) throw new NotFoundError('Journal not found');

    const canReject =
      (journal.status === 'PENDING_VERIFICATION' && (role === 'Manager' || role === 'Owner' || role === 'Admin')) ||
      (journal.status === 'PENDING_APPROVAL' && (role === 'Owner' || role === 'Admin')) ||
      (journal.status === 'VERIFIED' && (role === 'Owner' || role === 'Admin'));

    if (!canReject) {
      throw new ForbiddenError('Cannot reject this journal');
    }

    const updated = await prisma.journalEntry.update({
      where: { id: journalId },
      data: {
        status: 'REJECTED',
        rejectedById: userId,
        rejectionReason: reason,
      },
    });

    await NotificationController.notifyStatusChange({
      companyId: journal.companyId,
      entityType: 'JournalEntry',
      entityId: journal.id,
      entityNumber: journal.entryNumber,
      oldStatus: journal.status,
      newStatus: 'REJECTED',
      performedById: userId,
      reason
    });

    return reply.send({ success: true, data: updated });
  }

  async retrieveJournal(request: FastifyRequest, reply: FastifyReply) {
    const { journalId } = request.params as { journalId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;

    const role = await this.getUserRole(userId, companyId);
    if (role !== 'Accountant' && role !== 'Owner' && role !== 'Admin') {
      throw new ForbiddenError('Insufficient permissions to retrieve journals');
    }

    const updated = await prisma.journalEntry.update({
      where: { id: journalId },
      data: { status: 'DRAFT', rejectionReason: null },
    });

    await NotificationController.notifyStatusChange({
      companyId,
      entityType: 'JournalEntry',
      entityId: journalId,
      entityNumber: updated.entryNumber,
      oldStatus: 'REJECTED',
      newStatus: 'DRAFT',
      performedById: userId
    });

    return reply.send({ success: true, data: updated });
  }

  async submitJournal(request: FastifyRequest, reply: FastifyReply) {
    const { journalId } = request.params as { journalId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;

    const role = await this.getUserRole(userId, companyId);
    if (role !== 'Accountant' && role !== 'Owner' && role !== 'Admin') {
      throw new ForbiddenError('Insufficient permissions to submit journals');
    }

    const journal = await prisma.journalEntry.findUnique({ where: { id: journalId } });
    if (!journal) throw new NotFoundError('Journal not found');
    if (journal.status !== 'DRAFT' && journal.status !== 'REJECTED') {
      throw new ValidationError('Only DRAFT or REJECTED journals can be submitted');
    }

    const updated = await prisma.journalEntry.update({
      where: { id: journalId },
      data: { status: 'PENDING_VERIFICATION' },
    });

    await NotificationController.notifyStatusChange({
      companyId,
      entityType: 'JournalEntry',
      entityId: journalId,
      entityNumber: updated.entryNumber,
      oldStatus: journal.status,
      newStatus: 'PENDING_VERIFICATION',
      performedById: userId
    });

    return reply.send({ success: true, data: updated });
  }

  async approveJournal(request: FastifyRequest, reply: FastifyReply) {
    const { journalId } = request.params as { journalId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;

    const role = await this.getUserRole(userId, companyId);
    const journal = await prisma.journalEntry.findUnique({
      where: { id: journalId },
      include: { lines: { include: { account: { include: { accountType: true } } } } }
    });

    if (!journal) throw new NotFoundError('Journal not found');

    if (!this.canApprove(journal.status, role)) {
      throw new ForbiddenError(`Cannot approve this journal from current status: ${journal.status}`);
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      const jrnl = await tx.journalEntry.update({
        where: { id: journalId },
        data: {
          status: 'APPROVED',
          approvedById: userId,
          approvedAt: new Date(),
        },
      });

      await NotificationController.notifyStatusChange({
        companyId: journal.companyId,
        entityType: 'JournalEntry',
        entityId: journal.id,
        entityNumber: journal.entryNumber,
        oldStatus: journal.status,
        newStatus: 'APPROVED',
        performedById: userId
      });

      const isOwnerOrAdmin = role === 'Owner' || role === 'Admin';

      for (const line of journal.lines) {
        const isDebitType = (line.account as any).accountType.type === 'DEBIT';
        const balanceChange = isDebitType
          ? (Number(line.debitBase) - Number(line.creditBase))
          : (Number(line.creditBase) - Number(line.debitBase));

        const potentialBalance = Number(line.account.currentBalance) + balanceChange;

        if (potentialBalance < 0 && !(line.account as any).allowNegative && !isOwnerOrAdmin) {
          throw new ValidationError(
            `Transaction rejected: ${line.account.name} balance (${potentialBalance.toLocaleString()}) would be negative.`
          );
        }

        await tx.account.update({
          where: { id: line.accountId },
          data: {
            currentBalance: {
              increment: balanceChange
            }
          }
        });
      }

      return jrnl;
    });

    return reply.send({ success: true, data: updated });
  }
}
