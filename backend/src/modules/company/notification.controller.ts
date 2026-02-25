import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';

export class NotificationController {
  /**
   * Auto-generate notifications from real database events.
   * Scans for: overdue invoices, expiring LCs, pending journals, active loans.
   * Deduplicates so the same event does not create duplicate alerts.
   */
  async generate(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // ── 1. Overdue Invoices ────────────────────────────────────────────
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        companyId,
        status: 'APPROVED',
        dueDate: { lt: now },
      },
      select: { id: true, invoiceNumber: true, total: true, dueDate: true },
      take: 10,
    });

    for (const inv of overdueInvoices) {
      const existing = await prisma.notification.findFirst({
        where: { companyId, type: 'OVERDUE_INVOICE', entityId: inv.id, isRead: false },
      });
      if (!existing) {
        const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate!).getTime()) / (1000 * 60 * 60 * 24));
        await prisma.notification.create({
          data: {
            companyId,
            type: 'OVERDUE_INVOICE',
            severity: 'DANGER',
            title: `Overdue Invoice: ${inv.invoiceNumber}`,
            message: `Invoice ${inv.invoiceNumber} is ${daysOverdue} day(s) overdue. Amount: ${inv.total.toLocaleString()} BDT.`,
            entityType: 'Invoice',
            entityId: inv.id,
          },
        });
      }
    }

    // ── 2. LCs Expiring within 7 Days ─────────────────────────────────
    const expiringLCs = await prisma.lC.findMany({
      where: {
        companyId,
        status: 'OPEN',
        expiryDate: { lte: in7Days, gte: now },
      },
      select: { id: true, lcNumber: true, amount: true, currency: true, expiryDate: true },
      take: 10,
    });

    for (const lc of expiringLCs) {
      const existing = await prisma.notification.findFirst({
        where: { companyId, type: 'LC_EXPIRY', entityId: lc.id, isRead: false },
      });
      if (!existing) {
        const daysLeft = Math.floor((new Date(lc.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        await prisma.notification.create({
          data: {
            companyId,
            type: 'LC_EXPIRY',
            severity: daysLeft <= 3 ? 'DANGER' : 'WARNING',
            title: `LC Expiry: ${lc.lcNumber}`,
            message: `LC ${lc.lcNumber} expires in ${daysLeft} day(s). Value: ${lc.amount.toLocaleString()} ${lc.currency}.`,
            entityType: 'LC',
            entityId: lc.id,
          },
        });
      }
    }

    // ── 3. Pending Journals (DRAFT status) ────────────────────────────
    const pendingJournalCount = await prisma.journalEntry.count({
      where: { companyId, status: 'PENDING_VERIFICATION' },
    });

    if (pendingJournalCount > 0) {
      const existing = await prisma.notification.findFirst({
        where: { companyId, type: 'PENDING_JOURNAL', isRead: false },
      });
      if (!existing) {
        await prisma.notification.create({
          data: {
            companyId,
            type: 'PENDING_JOURNAL',
            severity: 'INFO',
            title: 'Journals Pending Approval',
            message: `${pendingJournalCount} journal entr${pendingJournalCount > 1 ? 'ies are' : 'y is'} awaiting review and approval.`,
            entityType: 'JournalEntry',
          },
        });
      }
    }

    // ── 4. Active Loans Due within 30 Days ────────────────────────────
    const dueLoans = await prisma.loan.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        endDate: { lte: in30Days, gte: now },
      },
      select: { id: true, loanNumber: true, outstandingBalance: true, endDate: true },
      take: 5,
    });

    for (const loan of dueLoans) {
      const existing = await prisma.notification.findFirst({
        where: { companyId, type: 'LOAN_DUE', entityId: loan.id, isRead: false },
      });
      if (!existing) {
        const daysLeft = Math.floor((new Date(loan.endDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        await prisma.notification.create({
          data: {
            companyId,
            type: 'LOAN_DUE',
            severity: 'WARNING',
            title: `Loan Maturity: ${loan.loanNumber}`,
            message: `Loan ${loan.loanNumber} matures in ${daysLeft} day(s). Outstanding: ${loan.outstandingBalance.toLocaleString()} BDT.`,
            entityType: 'Loan',
            entityId: loan.id,
          },
        });
      }
    }

    return reply.send({ success: true, message: 'Notifications generated successfully.' });
  }

  /**
   * List all (unread first) notifications for a company.
   */
  async list(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };

    const notifications = await prisma.notification.findMany({
      where: { companyId },
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      take: 50,
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return reply.send({ success: true, data: { notifications, unreadCount } });
  }

  /**
   * Mark a single notification as read.
   */
  async markRead(request: FastifyRequest, reply: FastifyReply) {
    const { notifId } = request.params as { notifId: string };

    await prisma.notification.update({
      where: { id: notifId },
      data: { isRead: true },
    });

    return reply.send({ success: true, message: 'Marked as read.' });
  }

  /**
   * Mark ALL notifications for a company as read.
   */
  async markAllRead(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };

    await prisma.notification.updateMany({
      where: { companyId, isRead: false },
      data: { isRead: true },
    });

    return reply.send({ success: true, message: 'All notifications marked as read.' });
  }

  /**
   * Delete (dismiss) a single notification.
   */
  async delete(request: FastifyRequest, reply: FastifyReply) {
    const { notifId } = request.params as { notifId: string };

    await prisma.notification.delete({ where: { id: notifId } });

    return reply.send({ success: true, message: 'Notification dismissed.' });
  }
}
