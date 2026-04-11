"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentController = void 0;
const database_1 = __importDefault(require("../../config/database"));
const errorHandler_1 = require("../../middleware/errorHandler");
const notification_controller_1 = require("./notification.controller");
const TransactionRepository_1 = require("../../repositories/TransactionRepository");
class PaymentController {
    async createPayment(request, reply) {
        const { id: companyId } = request.params;
        const data = request.body;
        const userId = request.user.id;
        if (!data.amount || data.amount <= 0) {
            throw new errorHandler_1.ValidationError('Valid payment amount is required');
        }
        const { invoiceId, billId, lcId, piAllocations, accountId, date, amount, method, reference, description } = data;
        const paymentDate = date ? new Date(date) : new Date();
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const userRecord = await database_1.default.user.findUnique({
            where: { id: userId },
            include: { userRoles: { include: { role: true } } }
        });
        const isOwnerOrAdmin = userRecord?.userRoles.some((ur) => ['Owner', 'Admin'].includes(ur.role.name)) || false;
        if (paymentDate > today && !isOwnerOrAdmin) {
            throw new errorHandler_1.ValidationError('Future payment dates are only allowed for owners');
        }
        const payment = await database_1.default.$transaction(async (tx) => {
            // 1. Create the Payment record
            const pmt = await tx.payment.create({
                data: {
                    paymentNumber: `PAY-${Date.now()}`,
                    companyId,
                    date: date ? new Date(date) : new Date(),
                    amount: Number(amount),
                    method,
                    reference,
                    description,
                    invoiceId,
                    billId,
                    lcId,
                    accountId,
                    status: 'APPROVED',
                    piAllocations: piAllocations ? {
                        create: piAllocations.map((alloc) => ({
                            piId: alloc.piId,
                            allocatedAmount: Number(alloc.allocatedAmount)
                        }))
                    } : undefined
                }
            });
            // 2. Journal Entry & Status Updates if LC/PI
            if (lcId && piAllocations && piAllocations.length > 0) {
                const lc = await tx.lC.findUnique({
                    where: { id: lcId },
                    include: {
                        pis: { include: { paymentAllocations: true } }
                    }
                });
                if (!lc)
                    throw new errorHandler_1.NotFoundError('LC not found');
                // Auto-journal for LC Payment
                await TransactionRepository_1.TransactionRepository.generatePaymentJournal(tx, pmt, companyId, userId, lc.type === 'EXPORT' ? 'LC_EXPORT' : 'LC_IMPORT');
                // Update PI Statuses
                for (const alloc of piAllocations) {
                    const pi = await tx.pI.findUnique({
                        where: { id: alloc.piId },
                        include: { paymentAllocations: true }
                    });
                    if (pi) {
                        const totalAllocated = pi.paymentAllocations.reduce((sum, a) => sum + a.allocatedAmount, 0) + Number(alloc.allocatedAmount);
                        let piStatus = totalAllocated >= pi.amount ? 'PAID' : 'PARTIALLY_PAID';
                        await tx.pI.update({ where: { id: pi.id }, data: { status: piStatus } });
                    }
                }
                // Update LC Status
                const currentLCPaidTotal = lc.pis.reduce((sum, pi) => {
                    return sum + pi.paymentAllocations.reduce((s, a) => s + a.allocatedAmount, 0);
                }, 0) + piAllocations.reduce((sum, a) => sum + Number(a.allocatedAmount), 0);
                await tx.lC.update({
                    where: { id: lc.id },
                    data: { status: currentLCPaidTotal >= lc.amount ? 'CLOSED' : 'PARTIALLY_PAID' }
                });
            }
            // 3. Invoice/Bill Payment (Sales or Purchase)
            if (invoiceId) {
                const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
                if (!invoice)
                    throw new errorHandler_1.NotFoundError('Invoice not found');
                // Auto-journal for Regular Invoice Payment
                await TransactionRepository_1.TransactionRepository.generatePaymentJournal(tx, pmt, companyId, userId, invoice.type === 'SALES' ? 'SALES' : 'PURCHASE');
                // Update Invoice status logic...
                const previousPayments = await tx.payment.aggregate({
                    where: { invoiceId: invoice.id },
                    _sum: { amount: true }
                });
                const totalPaid = (previousPayments._sum.amount || 0) + Number(amount);
                let newStatus = totalPaid >= invoice.total ? 'PAID' : (totalPaid > 0 ? 'PARTIALLY_PAID' : invoice.status);
                await tx.invoice.update({
                    where: { id: invoice.id },
                    data: { status: newStatus }
                });
            }
            return pmt;
        });
        // Log Activity
        await notification_controller_1.NotificationController.logActivity({
            companyId,
            entityType: 'payment',
            entityId: payment.id,
            action: 'CREATED',
            performedById: userId,
            metadata: { docNumber: payment.paymentNumber }
        });
        return reply.status(201).send({ success: true, data: payment });
    }
    async listPayments(request, reply) {
        const { id: companyId } = request.params;
        const { method, status } = request.query;
        const where = { companyId };
        if (method)
            where.method = method;
        if (status)
            where.status = status;
        const payments = await database_1.default.payment.findMany({
            where,
            include: {
                invoice: true,
                bill: true,
                account: true,
                lc: true,
                piAllocations: {
                    include: { pi: true }
                }
            },
            orderBy: { date: 'desc' }
        });
        return reply.send({ success: true, data: payments });
    }
    async createTransfer(request, reply) {
        const { id: companyId } = request.params;
        const data = request.body;
        const userId = request.user.id;
        const { fromAccountId, toAccountId, amount, date, reference, description } = data;
        if (!amount || amount <= 0) {
            throw new errorHandler_1.ValidationError('Valid transfer amount is required');
        }
        if (!fromAccountId || !toAccountId) {
            throw new errorHandler_1.ValidationError('Source and destination accounts are required');
        }
        if (fromAccountId === toAccountId) {
            throw new errorHandler_1.ValidationError('Source and destination accounts must be different');
        }
        // Create transfer with PENDING_VERIFICATION status
        const transfer = await database_1.default.$transaction(async (tx) => {
            // Create a Payment record for the transfer history
            const pmt = await tx.payment.create({
                data: {
                    paymentNumber: `TRF-${Date.now()}`,
                    companyId,
                    date: date ? new Date(date) : new Date(),
                    amount: Number(amount),
                    method: 'TRANSFER',
                    reference,
                    description: description || 'Account Transfer',
                    accountId: fromAccountId,
                    status: 'PENDING_VERIFICATION' // Set to pending initially
                }
            });
            return pmt;
        });
        await notification_controller_1.NotificationController.logActivity({
            companyId,
            entityType: 'payment',
            entityId: transfer.id,
            action: 'CREATED',
            performedById: userId,
            metadata: { docNumber: transfer.paymentNumber, isTransfer: true, status: 'PENDING_VERIFICATION' }
        });
        return reply.status(201).send({ success: true, data: transfer });
    }
    async verifyTransfer(request, reply) {
        const { paymentId } = request.params;
        const userId = request.user.id;
        const payment = await database_1.default.payment.findUnique({ where: { id: paymentId } });
        if (!payment || payment.method !== 'TRANSFER') {
            throw new errorHandler_1.NotFoundError('Transfer not found');
        }
        if (payment.status !== 'PENDING_VERIFICATION') {
            throw new errorHandler_1.ValidationError('Transfer is not pending verification');
        }
        const updated = await database_1.default.payment.update({
            where: { id: paymentId },
            data: { status: 'APPROVED' }
        });
        await notification_controller_1.NotificationController.logActivity({
            companyId: payment.companyId,
            entityType: 'payment',
            entityId: payment.id,
            action: 'VERIFIED',
            performedById: userId,
            metadata: { docNumber: payment.paymentNumber }
        });
        return reply.send({ success: true, data: updated });
    }
    async approveTransfer(request, reply) {
        const { paymentId } = request.params;
        const userId = request.user.id;
        const { toAccountId } = request.body;
        const payment = await database_1.default.payment.findUnique({ where: { id: paymentId } });
        if (!payment || payment.method !== 'TRANSFER') {
            throw new errorHandler_1.NotFoundError('Transfer not found');
        }
        if (payment.status !== 'APPROVED') {
            throw new errorHandler_1.ValidationError('Transfer must be verified before approval');
        }
        // Generate the journal entry
        await TransactionRepository_1.TransactionRepository.generateTransferJournal(database_1.default, payment, payment.companyId, userId, toAccountId);
        const updated = await database_1.default.payment.update({
            where: { id: paymentId },
            data: { status: 'COMPLETED' }
        });
        await notification_controller_1.NotificationController.logActivity({
            companyId: payment.companyId,
            entityType: 'payment',
            entityId: payment.id,
            action: 'APPROVED',
            performedById: userId,
            metadata: { docNumber: payment.paymentNumber }
        });
        return reply.send({ success: true, data: updated });
    }
}
exports.PaymentController = PaymentController;
//# sourceMappingURL=payment.controller.js.map