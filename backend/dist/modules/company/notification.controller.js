"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const database_1 = __importDefault(require("../../config/database"));
class NotificationController {
    /**
     * Auto-generate notifications from real database events.
     * Scans for: overdue invoices, expiring LCs, pending journals, active loans.
     * Deduplicates so the same event does not create duplicate alerts.
     */
    async generate(request, reply) {
        const { id: companyId } = request.params;
        const now = new Date();
        const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        // ── 1. Overdue Invoices ────────────────────────────────────────────
        const overdueInvoices = await database_1.default.invoice.findMany({
            where: {
                companyId,
                status: 'APPROVED',
                dueDate: { lt: now },
            },
            select: { id: true, invoiceNumber: true, total: true, dueDate: true },
            take: 10,
        });
        for (const inv of overdueInvoices) {
            const existing = await database_1.default.notification.findFirst({
                where: { companyId, type: 'OVERDUE_INVOICE', entityId: inv.id, isRead: false },
            });
            if (!existing) {
                const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
                await database_1.default.notification.create({
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
        const expiringLCs = await database_1.default.lC.findMany({
            where: {
                companyId,
                status: 'OPEN',
                expiryDate: { lte: in7Days, gte: now },
            },
            select: { id: true, lcNumber: true, amount: true, currency: true, expiryDate: true },
            take: 10,
        });
        for (const lc of expiringLCs) {
            const existing = await database_1.default.notification.findFirst({
                where: { companyId, type: 'LC_EXPIRY', entityId: lc.id, isRead: false },
            });
            if (!existing) {
                const daysLeft = Math.floor((new Date(lc.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                await database_1.default.notification.create({
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
        const pendingJournalCount = await database_1.default.journalEntry.count({
            where: { companyId, status: 'PENDING_VERIFICATION' },
        });
        if (pendingJournalCount > 0) {
            const existing = await database_1.default.notification.findFirst({
                where: { companyId, type: 'PENDING_JOURNAL', isRead: false },
            });
            if (!existing) {
                await database_1.default.notification.create({
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
        const dueLoans = await database_1.default.loan.findMany({
            where: {
                companyId,
                status: 'ACTIVE',
                endDate: { lte: in30Days, gte: now },
            },
            select: { id: true, loanNumber: true, outstandingBalance: true, endDate: true },
            take: 5,
        });
        for (const loan of dueLoans) {
            const existing = await database_1.default.notification.findFirst({
                where: { companyId, type: 'LOAN_DUE', entityId: loan.id, isRead: false },
            });
            if (!existing) {
                const daysLeft = Math.floor((new Date(loan.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                await database_1.default.notification.create({
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
    async list(request, reply) {
        const { id: companyId } = request.params;
        const notifications = await database_1.default.notification.findMany({
            where: { companyId },
            orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
            take: 50,
        });
        const unreadCount = notifications.filter((n) => !n.isRead).length;
        return reply.send({ success: true, data: { notifications, unreadCount } });
    }
    /**
     * Mark a single notification as read.
     */
    async markRead(request, reply) {
        const { notifId } = request.params;
        await database_1.default.notification.update({
            where: { id: notifId },
            data: { isRead: true },
        });
        return reply.send({ success: true, message: 'Marked as read.' });
    }
    /**
     * Mark ALL notifications for a company as read.
     */
    async markAllRead(request, reply) {
        const { id: companyId } = request.params;
        await database_1.default.notification.updateMany({
            where: { companyId, isRead: false },
            data: { isRead: true },
        });
        return reply.send({ success: true, message: 'All notifications marked as read.' });
    }
    /**
     * Delete (dismiss) a single notification.
     */
    async delete(request, reply) {
        const { notifId } = request.params;
        await database_1.default.notification.delete({ where: { id: notifId } });
        return reply.send({ success: true, message: 'Notification dismissed.' });
    }
    /**
     * Notify stakeholders of a status change (Push Model).
     * Generates both a Notification and an Activity Log.
     */
    static async notifyStatusChange(params) {
        try {
            let severity = 'INFO';
            let title = '';
            let message = '';
            const actionText = params.newStatus.replace('_', ' ');
            switch (params.newStatus) {
                case 'PENDING_VERIFICATION':
                    severity = 'INFO';
                    title = `Pending Verification: ${params.entityNumber}`;
                    message = `${params.entityType} ${params.entityNumber} has been submitted and is awaiting verification.`;
                    break;
                case 'VERIFIED':
                    severity = 'INFO';
                    title = `Verified: ${params.entityNumber}`;
                    message = `${params.entityType} ${params.entityNumber} has been verified and is awaiting final approval.`;
                    break;
                case 'PENDING_APPROVAL':
                    severity = 'INFO';
                    title = `Pending Approval: ${params.entityNumber}`;
                    message = `${params.entityType} ${params.entityNumber} is awaiting final approval.`;
                    break;
                case 'APPROVED':
                    severity = 'INFO';
                    title = `Approved: ${params.entityNumber}`;
                    message = `${params.entityType} ${params.entityNumber} has been fully approved.`;
                    break;
                case 'REJECTED':
                    severity = 'DANGER';
                    title = `Rejected: ${params.entityNumber}`;
                    message = `${params.entityType} ${params.entityNumber} was rejected. ${params.reason ? `Reason: ${params.reason}` : ''}`;
                    break;
                default:
                    title = `Status Updated: ${params.entityNumber}`;
                    message = `${params.entityType} ${params.entityNumber} status changed to ${actionText}.`;
            }
            // 1. Create Notification for the company
            await database_1.default.notification.create({
                data: {
                    companyId: params.companyId,
                    type: 'STATUS_CHANGE',
                    severity,
                    title,
                    message,
                    entityType: params.entityType,
                    entityId: params.entityId,
                },
            });
            // 2. Log Activity
            await this.logActivity({
                companyId: params.companyId,
                entityType: params.entityType,
                entityId: params.entityId,
                action: `STATUS_REACHED_${params.newStatus}`,
                performedById: params.performedById,
                metadata: {
                    oldStatus: params.oldStatus,
                    newStatus: params.newStatus,
                    entityNumber: params.entityNumber,
                    reason: params.reason
                }
            });
        }
        catch (error) {
            console.error('Failed to generate status change notification:', error);
        }
    }
    /**
     * Static utility to log an activity from anywhere in the backend.
     */
    static async logActivity(params) {
        try {
            return await database_1.default.activityLog.create({
                data: {
                    companyId: params.companyId,
                    entityType: params.entityType,
                    entityId: params.entityId,
                    action: params.action,
                    performedById: params.performedById,
                    targetUserId: params.targetUserId,
                    branchId: params.branchId,
                    metadata: params.metadata || {},
                },
            });
        }
        catch (error) {
            console.error('Failed to log activity:', error);
            return null;
        }
    }
    /**
     * List structured activities for a company (dynamic feed).
     */
    async listActivities(request, reply) {
        const { id: companyId } = request.params;
        const { branchId } = request.query;
        const where = { companyId };
        if (branchId)
            where.branchId = branchId;
        const activities = await database_1.default.activityLog.findMany({
            where,
            include: {
                performedBy: {
                    select: { firstName: true, lastName: true, id: true }
                },
                targetUser: {
                    select: { firstName: true, lastName: true, id: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        return reply.send({ success: true, data: activities });
    }
}
exports.NotificationController = NotificationController;
//# sourceMappingURL=notification.controller.js.map