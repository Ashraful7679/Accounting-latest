"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinanceRepository = void 0;
const database_1 = __importDefault(require("../config/database"));
const systemMode_1 = require("../lib/systemMode");
// Simple demo data for finance
const demoLCs = [
    { id: 'lc-1', lcNumber: 'LC-DEMO-2026-01', bankName: 'DBBL', amount: 50000, currency: 'USD', status: 'OPEN', type: 'IMPORT' }
];
const demoLoans = [
    { id: 'loan-1', loanNumber: 'LN-DBBL-4422', bankName: 'DBBL', principalAmount: 2000000, outstandingBalance: 1800000, interestRate: 9, status: 'ACTIVE' }
];
class FinanceRepository {
    static async findLCs(companyId) {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            try {
                return await database_1.default.lC.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
            }
            catch (error) {
                console.error('LC fetch failed, using demo data');
            }
        }
        return demoLCs;
    }
    static async findLoans(companyId) {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            try {
                return await database_1.default.loan.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
            }
            catch (error) {
                console.error('Loan fetch failed, using demo data');
            }
        }
        return demoLoans;
    }
}
exports.FinanceRepository = FinanceRepository;
//# sourceMappingURL=FinanceRepository.js.map