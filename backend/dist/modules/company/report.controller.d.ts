import { FastifyRequest, FastifyReply } from 'fastify';
import { BaseCompanyController } from './base.controller';
export declare class ReportController extends BaseCompanyController {
    getDashboardStats(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    getAccountBalances(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    getTrialBalance(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    getLedger(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    getProfitLoss(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    getBalanceSheet(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    getAgingReport(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    searchReceivables(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    getLCLiability(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    private _calculateBalanceSheet;
    private _calculatePnL;
    private _calculateCashFlow;
}
//# sourceMappingURL=report.controller.d.ts.map