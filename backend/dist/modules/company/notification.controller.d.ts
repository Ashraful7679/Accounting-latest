import { FastifyRequest, FastifyReply } from 'fastify';
export declare class NotificationController {
    /**
     * Auto-generate notifications from real database events.
     * Scans for: overdue invoices, expiring LCs, pending journals, active loans.
     * Deduplicates so the same event does not create duplicate alerts.
     */
    generate(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    /**
     * List all (unread first) notifications for a company.
     */
    list(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    /**
     * Mark a single notification as read.
     */
    markRead(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    /**
     * Mark ALL notifications for a company as read.
     */
    markAllRead(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    /**
     * Delete (dismiss) a single notification.
     */
    delete(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    /**
     * Notify stakeholders of a status change (Push Model).
     * Generates both a Notification and an Activity Log.
     */
    static notifyStatusChange(params: {
        companyId: string;
        entityType: 'Invoice' | 'JournalEntry' | 'LC' | 'PurchaseOrder' | 'EmployeeExpense' | 'PI';
        entityId: string;
        entityNumber: string;
        oldStatus?: string;
        newStatus: string;
        performedById: string;
        reason?: string | null;
    }): Promise<void>;
    /**
     * Static utility to log an activity from anywhere in the backend.
     */
    static logActivity(params: {
        companyId: string;
        entityType: string;
        entityId: string;
        action: string;
        performedById: string;
        targetUserId?: string | null;
        branchId?: string | null;
        metadata?: any;
    }): Promise<{
        id: string;
        createdAt: Date;
        companyId: string;
        entityType: string;
        entityId: string;
        branchId: string | null;
        action: string;
        performedById: string;
        targetUserId: string | null;
        metadata: import("../../generated/client/runtime/library").JsonValue | null;
    }>;
    /**
     * List structured activities for a company (dynamic feed).
     */
    listActivities(request: FastifyRequest, reply: FastifyReply): Promise<never>;
}
//# sourceMappingURL=notification.controller.d.ts.map