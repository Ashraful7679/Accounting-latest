"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReconcileController = void 0;
const database_1 = __importDefault(require("../../config/database"));
const errorHandler_1 = require("../../middleware/errorHandler");
class ReconcileController {
    async getReconcileLines(request, reply) {
        const { id: companyId } = request.params;
        const { accountId, startDate, endDate } = request.query;
        if (!accountId) {
            throw new errorHandler_1.ValidationError('Bank Account ID is required');
        }
        const where = {
            accountId,
            journalEntry: {
                companyId,
                status: 'APPROVED'
            },
            reconciled: false
        };
        if (startDate || endDate) {
            where.journalEntry.date = {};
            if (startDate)
                where.journalEntry.date.gte = new Date(startDate);
            if (endDate)
                where.journalEntry.date.lte = new Date(endDate);
        }
        const lines = await database_1.default.journalEntryLine.findMany({
            where,
            include: {
                journalEntry: true,
                account: true
            },
            orderBy: { journalEntry: { date: 'asc' } }
        });
        return reply.send({ success: true, data: lines });
    }
    async markAsReconciled(request, reply) {
        const { lineIds } = request.body;
        if (!lineIds || !lineIds.length) {
            throw new errorHandler_1.ValidationError('No transactions selected');
        }
        await database_1.default.journalEntryLine.updateMany({
            where: { id: { in: lineIds } },
            data: {
                reconciled: true,
                reconciledAt: new Date()
            }
        });
        return reply.send({ success: true, message: 'Transactions reconciled successfully' });
    }
}
exports.ReconcileController = ReconcileController;
//# sourceMappingURL=reconcile.controller.js.map