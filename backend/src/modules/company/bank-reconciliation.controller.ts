import { FastifyRequest, FastifyReply } from 'fastify';
import { BankReconciliationRepository } from '../../repositories/BankReconciliationRepository';
import { SequenceService } from './sequence.service';
import prismaBase from '../../config/database';
import { SYSTEM_MODE } from '../../lib/systemMode';

// BankReconciliation model not yet migrated — cast to any for forward-compat
const prisma = prismaBase as any;

export class BankReconciliationController {
  static async create(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: companyId } = request.params as { id: string };
      const data: any = request.body;

      const sequence = await SequenceService.generateDocumentNumber(companyId, 'bill');
      data.reconciliationNumber = sequence;
      data.companyId = companyId;

      const reconciliation = await BankReconciliationRepository.create(data);
      return reply.send(reconciliation);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async findAll(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: companyId } = request.params as { id: string };
      const reconciliations = await BankReconciliationRepository.findMany({ companyId });
      return reply.send(reconciliations);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async findById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { reconciliationId } = request.params as { reconciliationId: string };
      const reconciliation = await BankReconciliationRepository.findById(reconciliationId);
      return reply.send(reconciliation);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async update(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { reconciliationId } = request.params as { reconciliationId: string };
      const data: any = request.body;
      const reconciliation = await BankReconciliationRepository.update(reconciliationId, data);
      return reply.send(reconciliation);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async delete(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { reconciliationId } = request.params as { reconciliationId: string };
      await BankReconciliationRepository.delete(reconciliationId);
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async importStatement(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { reconciliationId } = request.params as { reconciliationId: string };
      const { lines } = request.body as any;

      await BankReconciliationRepository.addLines(reconciliationId, lines);
      const reconciliation = await BankReconciliationRepository.findById(reconciliationId);
      return reply.send(reconciliation);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async matchTransactions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { reconciliationId, accountId } = request.params as { reconciliationId: string; accountId: string };
      const reconciliation = await BankReconciliationRepository.findById(reconciliationId) as any;

      if (!reconciliation) {
        return reply.status(404).send({ error: 'Reconciliation not found' });
      }

      if (SYSTEM_MODE !== 'LIVE') {
        return reply.send({ success: true });
      }

      const journalLines = await prisma.journalEntryLine.findMany({
        where: { accountId, journalEntry: { companyId: reconciliation.companyId } },
        include: { journalEntry: true, account: true },
        orderBy: { journalEntry: { date: 'asc' } }
      });

      const statementLines = (reconciliation.lines || []).filter((l: any) => l.type === 'STATEMENT');
      const matched = [];
      for (const stmtLine of statementLines) {
        const stmtAmount = stmtLine.credit - stmtLine.debit;
        const matchedJournalLine = journalLines.find((jl: any) => {
          const jlAmount = jl.debit - jl.credit;
          return Math.abs(jlAmount - stmtAmount) < 0.01;
        });

        if (matchedJournalLine) {
          await BankReconciliationRepository.reconcileLine(stmtLine.id, matchedJournalLine.id);
          matched.push({ statementLine: stmtLine.id, journalLine: matchedJournalLine.id });
        }
      }

      return reply.send({ matched });
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }

  static async approve(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { reconciliationId } = request.params as { reconciliationId: string };

      if (SYSTEM_MODE !== 'LIVE') {
        return reply.send({ success: true });
      }

      const reconciliation = await prisma.bankReconciliation.findUnique({
        where: { id: reconciliationId }
      });

      if (!reconciliation) {
        return reply.status(404).send({ error: 'Reconciliation not found' });
      }

      const updated = await prisma.bankReconciliation.update({
        where: { id: reconciliationId },
        data: { status: 'COMPLETED' },
        include: { account: true, lines: true }
      });

      return reply.send(updated);
    } catch (error: any) {
      return reply.status(400).send({ error: error.message });
    }
  }
}