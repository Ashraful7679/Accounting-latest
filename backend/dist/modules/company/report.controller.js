"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportController = void 0;
const database_1 = __importDefault(require("../../config/database"));
const base_controller_1 = require("./base.controller");
class ReportController extends base_controller_1.BaseCompanyController {
    async getDashboardStats(request, reply) {
        const { id: companyId } = request.params;
        const [balanceSheet, pnl, cashflow] = await Promise.all([
            this._calculateBalanceSheet(companyId),
            this._calculatePnL(companyId),
            this._calculateCashFlow(companyId)
        ]);
        return reply.send({
            success: true,
            data: {
                totalAssets: balanceSheet.totalAssets,
                totalLiabilities: balanceSheet.totalLiabilities,
                netProfit: pnl.netProfit,
                cashBalance: cashflow.endingCash
            }
        });
    }
    async getAccountBalances(request, reply) {
        const { id: companyId } = request.params;
        const accounts = await database_1.default.account.findMany({
            where: { companyId },
            include: { accountType: true }
        });
        return reply.send({ success: true, data: accounts });
    }
    async getTrialBalance(request, reply) {
        const { id: companyId } = request.params;
        const accounts = await database_1.default.account.findMany({
            where: { companyId },
            orderBy: { code: 'asc' }
        });
        return reply.send({ success: true, data: accounts });
    }
    async getLedger(request, reply) {
        const { id: companyId } = request.params;
        const { accountId, startDate, endDate } = request.query;
        const query = {
            where: {
                accountId,
                journalEntry: {
                    companyId,
                    status: 'APPROVED',
                    ...(startDate || endDate ? {
                        date: {
                            ...(startDate ? { gte: new Date(startDate) } : {}),
                            ...(endDate ? { lte: new Date(endDate) } : {}),
                        }
                    } : {})
                }
            },
            include: {
                journalEntry: true
            },
            orderBy: {
                journalEntry: { date: 'asc' }
            }
        };
        const lines = await database_1.default.journalEntryLine.findMany(query);
        let runningBalance = 0;
        const data = lines.map(line => {
            const effect = line.debit - line.credit;
            runningBalance += effect;
            return {
                id: line.id,
                date: line.journalEntry.date,
                reference: line.journalEntry.entryNumber,
                description: line.description || line.journalEntry.description,
                debit: line.debit,
                credit: line.credit,
                balance: runningBalance
            };
        });
        return reply.send({ success: true, data });
    }
    async getProfitLoss(request, reply) {
        const { id: companyId } = request.params;
        const pnl = await this._calculatePnL(companyId);
        return reply.send({ success: true, data: pnl });
    }
    async getBalanceSheet(request, reply) {
        const { id: companyId } = request.params;
        const bs = await this._calculateBalanceSheet(companyId);
        return reply.send({ success: true, data: bs });
    }
    async getAgingReport(request, reply) {
        const { id: companyId } = request.params;
        const { type } = request.query;
        const invoices = await database_1.default.invoice.findMany({
            where: {
                companyId,
                type: type === 'AP' ? 'PURCHASE' : 'SALE',
                status: { in: ['APPROVED', 'PARTIALLY_PAID'] }
            },
            include: {
                customer: true,
                vendor: true,
                payments: true
            }
        });
        const buckets = {
            current: 0,
            '1-30': 0,
            '31-60': 0,
            '61-90': 0,
            '90+': 0
        };
        invoices.forEach(inv => {
            const paid = inv.payments.reduce((sum, p) => sum + p.amount, 0);
            const balance = inv.total - paid;
            if (balance <= 0)
                return;
            const dueDate = inv.dueDate || inv.invoiceDate;
            const daysOverdue = Math.floor((new Date().getTime() - new Date(dueDate).getTime()) / (1000 * 3600 * 24));
            if (daysOverdue <= 0)
                buckets.current += balance;
            else if (daysOverdue <= 30)
                buckets['1-30'] += balance;
            else if (daysOverdue <= 60)
                buckets['31-60'] += balance;
            else if (daysOverdue <= 90)
                buckets['61-90'] += balance;
            else
                buckets['90+'] += balance;
        });
        return reply.send({ success: true, data: buckets });
    }
    async searchReceivables(request, reply) {
        const { id: companyId } = request.params;
        const { query, type } = request.query;
        const invoices = await database_1.default.invoice.findMany({
            where: {
                companyId,
                type: type === 'PURCHASE' ? 'PURCHASE' : 'SALE',
                status: { in: ['APPROVED', 'PARTIALLY_PAID'] },
                OR: query ? [
                    { invoiceNumber: { contains: query, mode: 'insensitive' } },
                    { customer: { name: { contains: query, mode: 'insensitive' } } },
                    { vendor: { name: { contains: query, mode: 'insensitive' } } }
                ] : undefined
            },
            include: {
                customer: true,
                vendor: true,
                payments: true
            },
            orderBy: { createdAt: 'desc' }
        });
        const results = invoices.map(inv => {
            const paid = inv.payments.reduce((sum, p) => sum + p.amount, 0);
            const balance = inv.total - paid;
            return {
                id: inv.id,
                number: inv.invoiceNumber,
                date: inv.invoiceDate,
                entity: inv.customer?.name || inv.vendor?.name || 'Unknown',
                total: inv.total,
                paid,
                balance,
                daysOverdue: Math.floor((new Date().getTime() - new Date(inv.dueDate || inv.invoiceDate).getTime()) / (1000 * 3600 * 24))
            };
        }).filter(r => r.balance > 0);
        return reply.send({ success: true, data: results });
    }
    async getLCLiability(request, reply) {
        const { id: companyId } = request.params;
        const lcs = await database_1.default.lC.findMany({
            where: {
                companyId,
                status: { in: ['OPEN', 'AMENDED'] }
            }
        });
        const totalLiability = lcs.reduce((sum, lc) => sum + lc.amount, 0);
        const count = lcs.length;
        return reply.send({
            success: true,
            data: {
                totalLiability,
                count,
                lcs: lcs.map(lc => ({
                    id: lc.id,
                    number: lc.lcNumber,
                    type: lc.type,
                    amount: lc.amount,
                    expiryDate: lc.expiryDate,
                    bank: lc.bankName
                }))
            }
        });
    }
    async _calculateBalanceSheet(companyId) {
        const accounts = await database_1.default.account.findMany({ where: { companyId } });
        return {
            totalAssets: accounts.filter(a => a.code.startsWith('1')).reduce((s, a) => s + a.currentBalance, 0),
            totalLiabilities: accounts.filter(a => a.code.startsWith('2')).reduce((s, a) => s + a.currentBalance, 0),
            totalEquity: accounts.filter(a => a.code.startsWith('3')).reduce((s, a) => s + a.currentBalance, 0),
        };
    }
    async _calculatePnL(companyId) {
        const accounts = await database_1.default.account.findMany({ where: { companyId } });
        const revenue = accounts.filter(a => a.code.startsWith('4')).reduce((s, a) => s + a.currentBalance, 0);
        const expenses = accounts.filter(a => a.code.startsWith('5')).reduce((s, a) => s + a.currentBalance, 0);
        return {
            revenue,
            expenses,
            netProfit: revenue - expenses
        };
    }
    async _calculateCashFlow(companyId) {
        const accounts = await database_1.default.account.findMany({ where: { companyId, category: { in: ['CASH', 'BANK'] } } });
        return {
            endingCash: accounts.reduce((s, a) => s + a.currentBalance, 0)
        };
    }
}
exports.ReportController = ReportController;
//# sourceMappingURL=report.controller.js.map