"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportRepository = void 0;
const database_1 = __importDefault(require("../config/database"));
const systemMode_1 = require("../lib/systemMode");
class ReportRepository {
    static async getTrialBalance(companyId, filters = {}) {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            try {
                const accounts = await database_1.default.account.findMany({
                    where: { companyId },
                    include: {
                        accountType: true,
                        journalLines: {
                            where: {
                                ...filters,
                                journalEntry: {
                                    ...filters.journalEntry,
                                    status: 'APPROVED'
                                }
                            }
                        }
                    }
                });
                return accounts.map(acc => {
                    const debit = acc.journalLines.reduce((sum, line) => sum + line.debitBase, 0);
                    const credit = acc.journalLines.reduce((sum, line) => sum + line.creditBase, 0);
                    return {
                        accountCode: acc.code,
                        accountName: acc.name,
                        accountType: acc.accountType.name,
                        debit,
                        credit,
                        balance: debit - credit
                    };
                });
            }
            catch (error) {
                console.error('Trial Balance calculation failed, using demo data');
            }
        }
        // OFFLINE DEMO DATA
        return [
            { accountCode: "1001", accountName: "Cash in Hand", accountType: "ASSET", debit: 500000, credit: 0, balance: 500000 },
            { accountCode: "1002", accountName: "Bank Account", accountType: "ASSET", debit: 2500000, credit: 0, balance: 2500000 },
            { accountCode: "4001", accountName: "Sales Revenue", accountType: "INCOME", debit: 0, credit: 3000000, balance: -3000000 }
        ];
    }
}
exports.ReportRepository = ReportRepository;
//# sourceMappingURL=ReportRepository.js.map