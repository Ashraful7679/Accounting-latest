"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JournalController = void 0;
const database_1 = __importDefault(require("../../config/database"));
const TransactionRepository_1 = require("../../repositories/TransactionRepository");
const notification_controller_1 = require("./notification.controller");
const errorHandler_1 = require("../../middleware/errorHandler");
const base_controller_1 = require("./base.controller");
class JournalController extends base_controller_1.BaseCompanyController {
    // ============ JOURNALS ============
    async getJournals(request, reply) {
        const { id: companyId } = request.params;
        const { limit, page } = request.query;
        const take = limit ? parseInt(limit) : undefined;
        const skip = (page && take) ? (parseInt(page) - 1) * take : undefined;
        const journals = await TransactionRepository_1.TransactionRepository.findJournals({ companyId }, take, skip);
        return reply.send({ success: true, data: journals });
    }
    async getJournal(request, reply) {
        const { journalId } = request.params;
        const journal = await TransactionRepository_1.TransactionRepository.findJournalById(journalId);
        if (!journal)
            throw new errorHandler_1.NotFoundError('Journal not found');
        return reply.send({ success: true, data: journal });
    }
    async createJournal(request, reply) {
        const { id: companyId } = request.params;
        const data = request.body;
        const userId = request.user.id;
        try {
            const entryNumber = await this.generateDocumentNumber(companyId, 'journal');
            if (!data.lines || !Array.isArray(data.lines)) {
                throw new errorHandler_1.ValidationError('Journal lines are required and must be an array');
            }
            const lineDebit = (l) => l.debitCredit !== undefined ? (l.debitCredit === 'debit' ? Number(l.amount) : 0) : Number(l.debit || 0);
            const lineCredit = (l) => l.debitCredit !== undefined ? (l.debitCredit === 'credit' ? Number(l.amount) : 0) : Number(l.credit || 0);
            const totalDebit = data.lines.reduce((sum, line) => sum + lineDebit(line), 0);
            const totalCredit = data.lines.reduce((sum, line) => sum + lineCredit(line), 0);
            if (Math.abs(totalDebit - totalCredit) > 0.01) {
                throw new errorHandler_1.ValidationError(`Debit (${totalDebit}) and Credit (${totalCredit}) must be equal`);
            }
            if (!data.date) {
                throw new errorHandler_1.ValidationError('Transaction date is required');
            }
            const journalDate = new Date(data.date);
            const role = await this.getUserRole(userId, companyId);
            const isOwnerOrAdmin = role === 'Owner' || role === 'Admin';
            const status = (role === 'Accountant' || isOwnerOrAdmin) ? 'PENDING_VERIFICATION' : 'DRAFT';
            const journal = await TransactionRepository_1.TransactionRepository.createJournal({
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
                    create: (data.lines || []).map((l, idx) => {
                        const debit = lineDebit(l);
                        const credit = lineCredit(l);
                        const rate = Number(l.exchangeRate || data.exchangeRate || 1);
                        if (!l.accountId) {
                            throw new errorHandler_1.ValidationError(`Line ${idx + 1} is missing an Account ID`);
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
            await notification_controller_1.NotificationController.logActivity({
                companyId,
                entityType: 'journal',
                entityId: journal.id,
                action: 'CREATED',
                performedById: userId,
                metadata: { docNumber: entryNumber }
            });
            if (status === 'PENDING_VERIFICATION') {
                await database_1.default.notification.create({
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
        }
        catch (error) {
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
    async updateJournal(request, reply) {
        const { journalId } = request.params;
        const { id: companyId } = request.params;
        const userId = request.user.id;
        const data = request.body;
        const role = await this.getUserRole(userId, companyId);
        const journal = await database_1.default.journalEntry.findUnique({ where: { id: journalId } });
        if (!journal)
            throw new errorHandler_1.NotFoundError('Journal not found');
        if (!this.canEdit(journal.status, role, userId, journal.createdById)) {
            throw new errorHandler_1.ForbiddenError('Cannot edit this journal in current status');
        }
        const { lines, ...otherData } = data;
        const updated = await database_1.default.$transaction(async (tx) => {
            if (lines) {
                await tx.journalEntryLine.deleteMany({ where: { journalEntryId: journalId } });
            }
            return await tx.journalEntry.update({
                where: { id: journalId },
                data: {
                    ...otherData,
                    date: otherData.date ? new Date(otherData.date) : undefined,
                    lines: lines ? {
                        create: lines.map((l) => ({
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
    async deleteJournal(request, reply) {
        const { journalId } = request.params;
        const { id: companyId } = request.params;
        const userId = request.user.id;
        const role = await this.getUserRole(userId, companyId);
        const journal = await database_1.default.journalEntry.findUnique({ where: { id: journalId } });
        if (!journal)
            throw new errorHandler_1.NotFoundError('Journal not found');
        if (!this.canDelete(journal.status, role)) {
            throw new errorHandler_1.ForbiddenError('Cannot delete this journal');
        }
        await database_1.default.journalEntry.delete({ where: { id: journalId } });
        return reply.send({ success: true, message: 'Journal deleted' });
    }
    async verifyJournal(request, reply) {
        const { journalId } = request.params;
        const { id: companyId } = request.params;
        const userId = request.user.id;
        const role = await this.getUserRole(userId, companyId);
        const journal = await database_1.default.journalEntry.findUnique({ where: { id: journalId } });
        if (!journal)
            throw new errorHandler_1.NotFoundError('Journal not found');
        if (!this.canVerify(journal.status, role)) {
            throw new errorHandler_1.ForbiddenError('Cannot verify this journal');
        }
        const updated = await database_1.default.journalEntry.update({
            where: { id: journalId },
            data: {
                status: 'VERIFIED',
                verifiedById: userId,
                verifiedAt: new Date(),
            },
        });
        await notification_controller_1.NotificationController.notifyStatusChange({
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
    async rejectJournal(request, reply) {
        const { journalId } = request.params;
        const { id: companyId } = request.params;
        const { reason } = request.body;
        const userId = request.user.id;
        const role = await this.getUserRole(userId, companyId);
        const journal = await database_1.default.journalEntry.findUnique({ where: { id: journalId } });
        if (!journal)
            throw new errorHandler_1.NotFoundError('Journal not found');
        const canReject = (journal.status === 'PENDING_VERIFICATION' && (role === 'Manager' || role === 'Owner' || role === 'Admin')) ||
            (journal.status === 'PENDING_APPROVAL' && (role === 'Owner' || role === 'Admin')) ||
            (journal.status === 'VERIFIED' && (role === 'Owner' || role === 'Admin'));
        if (!canReject) {
            throw new errorHandler_1.ForbiddenError('Cannot reject this journal');
        }
        const updated = await database_1.default.journalEntry.update({
            where: { id: journalId },
            data: {
                status: 'REJECTED',
                rejectedById: userId,
                rejectionReason: reason,
            },
        });
        await notification_controller_1.NotificationController.notifyStatusChange({
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
    async retrieveJournal(request, reply) {
        const { journalId } = request.params;
        const { id: companyId } = request.params;
        const userId = request.user.id;
        const role = await this.getUserRole(userId, companyId);
        if (role !== 'Accountant' && role !== 'Owner' && role !== 'Admin') {
            throw new errorHandler_1.ForbiddenError('Insufficient permissions to retrieve journals');
        }
        const updated = await database_1.default.journalEntry.update({
            where: { id: journalId },
            data: { status: 'DRAFT', rejectionReason: null },
        });
        await notification_controller_1.NotificationController.notifyStatusChange({
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
    async submitJournal(request, reply) {
        const { journalId } = request.params;
        const { id: companyId } = request.params;
        const userId = request.user.id;
        const role = await this.getUserRole(userId, companyId);
        if (role !== 'Accountant' && role !== 'Owner' && role !== 'Admin') {
            throw new errorHandler_1.ForbiddenError('Insufficient permissions to submit journals');
        }
        const journal = await database_1.default.journalEntry.findUnique({ where: { id: journalId } });
        if (!journal)
            throw new errorHandler_1.NotFoundError('Journal not found');
        if (journal.status !== 'DRAFT' && journal.status !== 'REJECTED') {
            throw new errorHandler_1.ValidationError('Only DRAFT or REJECTED journals can be submitted');
        }
        const updated = await database_1.default.journalEntry.update({
            where: { id: journalId },
            data: { status: 'PENDING_VERIFICATION' },
        });
        await notification_controller_1.NotificationController.notifyStatusChange({
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
    async approveJournal(request, reply) {
        const { journalId } = request.params;
        const { id: companyId } = request.params;
        const userId = request.user.id;
        const role = await this.getUserRole(userId, companyId);
        const journal = await database_1.default.journalEntry.findUnique({
            where: { id: journalId },
            include: { lines: { include: { account: { include: { accountType: true } } } } }
        });
        if (!journal)
            throw new errorHandler_1.NotFoundError('Journal not found');
        if (!this.canApprove(journal.status, role)) {
            throw new errorHandler_1.ForbiddenError(`Cannot approve this journal from current status: ${journal.status}`);
        }
        const updated = await database_1.default.$transaction(async (tx) => {
            const jrnl = await tx.journalEntry.update({
                where: { id: journalId },
                data: {
                    status: 'APPROVED',
                    approvedById: userId,
                    approvedAt: new Date(),
                },
            });
            await notification_controller_1.NotificationController.notifyStatusChange({
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
                const isDebitType = line.account.accountType.type === 'DEBIT';
                const balanceChange = isDebitType
                    ? (Number(line.debitBase) - Number(line.creditBase))
                    : (Number(line.creditBase) - Number(line.debitBase));
                const potentialBalance = Number(line.account.currentBalance) + balanceChange;
                if (potentialBalance < 0 && !line.account.allowNegative && !isOwnerOrAdmin) {
                    throw new errorHandler_1.ValidationError(`Transaction rejected: ${line.account.name} balance (${potentialBalance.toLocaleString()}) would be negative.`);
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
exports.JournalController = JournalController;
//# sourceMappingURL=journal.controller.js.map