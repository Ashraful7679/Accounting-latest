"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoanController = void 0;
const database_1 = __importDefault(require("../../config/database"));
const FinanceRepository_1 = require("../../repositories/FinanceRepository");
class LoanController {
    async getLoans(request, reply) {
        const { id: companyId } = request.params;
        const loans = await FinanceRepository_1.FinanceRepository.findLoans(companyId);
        return reply.send({ success: true, data: loans });
    }
    async createLoan(request, reply) {
        const { id: companyId } = request.params;
        const data = request.body;
        const loan = await database_1.default.loan.create({
            data: {
                ...data,
                companyId,
                principalAmount: Number(data.principalAmount),
                outstandingBalance: Number(data.outstandingBalance),
                interestRate: Number(data.interestRate),
                startDate: new Date(data.startDate),
                endDate: data.endDate ? new Date(data.endDate) : null
            }
        });
        return reply.status(201).send({ success: true, data: loan });
    }
    async updateLoan(request, reply) {
        const { loanId } = request.params;
        const data = request.body;
        const loan = await database_1.default.loan.update({
            where: { id: loanId },
            data: {
                ...data,
                principalAmount: data.principalAmount ? Number(data.principalAmount) : undefined,
                outstandingBalance: data.outstandingBalance ? Number(data.outstandingBalance) : undefined,
                interestRate: data.interestRate ? Number(data.interestRate) : undefined,
                startDate: data.startDate ? new Date(data.startDate) : undefined,
                endDate: data.endDate ? new Date(data.endDate) : undefined
            }
        });
        return reply.send({ success: true, data: loan });
    }
    async deleteLoan(request, reply) {
        const { loanId } = request.params;
        await database_1.default.loan.delete({ where: { id: loanId } });
        return reply.send({ success: true, message: 'Loan deleted' });
    }
}
exports.LoanController = LoanController;
//# sourceMappingURL=loan.controller.js.map