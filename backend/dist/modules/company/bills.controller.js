"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillsController = void 0;
const database_1 = __importDefault(require("../../config/database"));
const errorHandler_1 = require("../../middleware/errorHandler");
const TransactionRepository_1 = require("../../repositories/TransactionRepository");
class BillsController {
    async getBills(request, reply) {
        const { id: companyId } = request.params;
        const bills = await database_1.default.bill.findMany({
            where: { companyId },
            include: { vendor: true, payments: { select: { id: true, amount: true, status: true, date: true } } },
            orderBy: { createdAt: 'desc' },
        });
        return reply.send({ success: true, data: bills });
    }
    async getBill(request, reply) {
        const { billId } = request.params;
        const bill = await database_1.default.bill.findUnique({
            where: { id: billId },
            include: { vendor: true, payments: true },
        });
        if (!bill)
            throw new errorHandler_1.NotFoundError('Bill not found');
        return reply.send({ success: true, data: bill });
    }
    async createBill(request, reply) {
        const { id: companyId } = request.params;
        const { vendorId, subtotal, taxAmount, dueDate, description } = request.body;
        if (!vendorId)
            throw new errorHandler_1.ValidationError('Vendor is required');
        if (!subtotal || Number(subtotal) <= 0)
            throw new errorHandler_1.ValidationError('Subtotal must be a positive number');
        const sub = Number(subtotal);
        const tax = Number(taxAmount || 0);
        const billNumber = `BILL-${companyId.slice(0, 6).toUpperCase()}-${Date.now()}`;
        const bill = await database_1.default.bill.create({
            data: {
                billNumber,
                companyId,
                vendorId,
                subtotal: sub,
                taxAmount: tax,
                total: sub + tax,
                dueDate: dueDate ? new Date(dueDate) : undefined,
                status: 'DRAFT',
            },
            include: { vendor: true },
        });
        return reply.status(201).send({ success: true, data: bill });
    }
    async updateBill(request, reply) {
        const { billId } = request.params;
        const { vendorId, subtotal, taxAmount, dueDate, status } = request.body;
        const existing = await database_1.default.bill.findUnique({ where: { id: billId } });
        if (!existing)
            throw new errorHandler_1.NotFoundError('Bill not found');
        if (existing.status === 'PAID')
            throw new errorHandler_1.ForbiddenError('Cannot edit a paid bill');
        if (existing.status === 'APPROVED' && status !== 'PAID') {
            throw new errorHandler_1.ForbiddenError('Approved bills can only be marked PAID via a payment');
        }
        const sub = subtotal != null ? Number(subtotal) : existing.subtotal;
        const tax = taxAmount != null ? Number(taxAmount) : existing.taxAmount;
        const bill = await database_1.default.bill.update({
            where: { id: billId },
            data: {
                vendorId: vendorId ?? existing.vendorId,
                subtotal: sub,
                taxAmount: tax,
                total: sub + tax,
                dueDate: dueDate ? new Date(dueDate) : existing.dueDate,
                status: status ?? existing.status,
            },
            include: { vendor: true },
        });
        return reply.send({ success: true, data: bill });
    }
    async deleteBill(request, reply) {
        const { billId } = request.params;
        const existing = await database_1.default.bill.findUnique({ where: { id: billId } });
        if (!existing)
            throw new errorHandler_1.NotFoundError('Bill not found');
        if (existing.status !== 'DRAFT')
            throw new errorHandler_1.ForbiddenError('Only DRAFT bills can be deleted');
        await database_1.default.bill.delete({ where: { id: billId } });
        return reply.send({ success: true, message: 'Bill deleted successfully' });
    }
    async approveBill(request, reply) {
        const { id: companyId, billId } = request.params;
        const userId = request.user.id;
        const bill = await database_1.default.bill.findUnique({ where: { id: billId }, include: { vendor: true } });
        if (!bill)
            throw new errorHandler_1.NotFoundError('Bill not found');
        if (bill.status !== 'DRAFT')
            throw new errorHandler_1.ForbiddenError(`Cannot approve bill with status: ${bill.status}`);
        const updated = await database_1.default.$transaction(async (tx) => {
            const b = await tx.bill.update({ where: { id: billId }, data: { status: 'APPROVED' } });
            // Auto-journal: Dr Expense / Cr Accounts Payable
            await TransactionRepository_1.TransactionRepository.generateBillJournal(tx, bill, companyId, userId);
            return b;
        });
        return reply.send({ success: true, data: updated });
    }
}
exports.BillsController = BillsController;
//# sourceMappingURL=bills.controller.js.map