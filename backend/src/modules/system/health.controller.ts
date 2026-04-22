import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';

export class HealthController {
  async checkIntegrity(request: FastifyRequest, reply: FastifyReply) {
    try {
      const issues = [];
      
      // 1. Unbalanced Journal Entries
      const unbalancedJournals = await prisma.$queryRaw`
        SELECT "id", "entryNumber", "totalDebit", "totalCredit" 
        FROM "JournalEntry"
        WHERE ROUND("totalDebit"::numeric, 2) != ROUND("totalCredit"::numeric, 2)
        AND "deletedAt" IS NULL
      `;
      // Check if it's an array and has elements
      if (Array.isArray(unbalancedJournals) && unbalancedJournals.length > 0) {
        issues.push({ 
          type: 'UNBALANCED_JOURNALS', 
          count: unbalancedJournals.length, 
          description: 'Journal entries where debits do not equal credits',
          items: unbalancedJournals 
        });
      }

      // 2. Orphaned Journal Lines (Line has entryId but entry doesn't exist)
      const orphanedJournalLines = await prisma.$queryRaw`
        SELECT l."id", l."accountId", l."debit", l."credit"
        FROM "JournalEntryLine" l
        LEFT JOIN "JournalEntry" e ON l."journalEntryId" = e."id"
        WHERE e."id" IS NULL
      `;
      if (Array.isArray(orphanedJournalLines) && orphanedJournalLines.length > 0) {
        issues.push({ 
          type: 'ORPHANED_JOURNAL_LINES', 
          count: orphanedJournalLines.length, 
          description: 'Journal lines that are missing a parent journal entry',
          items: orphanedJournalLines 
        });
      }

      // 3. Orphaned Invoices (Missing Customer, though schema might allow it temporarily, an approved invoice shouldn't lack a customer)
      const orphanedInvoices = await prisma.invoice.findMany({
        where: { customerId: null, deletedAt: null, status: 'APPROVED' },
        select: { id: true, invoiceNumber: true }
      });
      if (orphanedInvoices.length > 0) {
        issues.push({ 
          type: 'ORPHANED_INVOICES', 
          count: orphanedInvoices.length, 
          description: 'Approved invoices missing a customer',
          items: orphanedInvoices 
        });
      }

      const isHealthy = issues.length === 0;

      return reply.send({
        success: true,
        isHealthy,
        issues,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({
        success: false,
        error: { message: error.message || 'Health check failed' }
      });
    }
  }
}
