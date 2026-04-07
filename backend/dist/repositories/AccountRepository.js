"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountRepository = void 0;
const database_1 = __importDefault(require("../config/database"));
const systemMode_1 = require("../lib/systemMode");
const accounts_1 = require("../lib/mockData/accounts");
class AccountRepository {
    static async findMany(where = {}, take, skip) {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            try {
                return await database_1.default.account.findMany({
                    where,
                    take,
                    skip,
                    include: { accountType: true },
                    orderBy: { code: 'asc' }
                });
            }
            catch (error) {
                console.error('AccountRepository error, falling back to mock:', error);
            }
        }
        // OFFLINE or FAILED LIVE
        return accounts_1.demoAccounts;
    }
    static async findAccountTypes() {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            try {
                return await database_1.default.accountType.findMany();
            }
            catch (error) {
                console.error('AccountType search failed');
            }
        }
        return [
            { id: "asset-id", name: "ASSET", type: "DEBIT" },
            { id: "liability-id", name: "LIABILITY", type: "CREDIT" },
            { id: "equity-id", name: "EQUITY", type: "CREDIT" },
            { id: "income-id", name: "INCOME", type: "CREDIT" },
            { id: "expense-id", name: "EXPENSE", type: "DEBIT" },
        ];
    }
    static async findAccountTypeById(id) {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            try {
                return await database_1.default.accountType.findUnique({ where: { id } });
            }
            catch (error) {
                console.error('AccountType search failed');
            }
        }
        const types = [
            { id: "asset-id", name: "ASSET", type: "DEBIT" },
            { id: "liability-id", name: "LIABILITY", type: "CREDIT" },
            { id: "equity-id", name: "EQUITY", type: "CREDIT" },
            { id: "income-id", name: "INCOME", type: "CREDIT" },
            { id: "expense-id", name: "EXPENSE", type: "DEBIT" },
        ];
        return types.find(t => t.id === id);
    }
    static async create(data) {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            try {
                return await database_1.default.account.create({ data });
            }
            catch (error) {
                console.error('Account creation failed');
            }
        }
        return { ...data, id: `offline-${Date.now()}` };
    }
    static async findByCategory(companyId, category) {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            try {
                return await database_1.default.account.findFirst({
                    where: { companyId, category, isActive: true }
                });
            }
            catch (error) {
                console.error(`Account search by category ${category} failed`);
            }
        }
        return accounts_1.demoAccounts.find(a => a.category === category && a.companyId === companyId);
    }
    static async findById(id) {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            try {
                return await database_1.default.account.findUnique({
                    where: { id },
                    include: { accountType: true }
                });
            }
            catch (error) {
                console.error('AccountRepository error:', error);
            }
        }
        return accounts_1.demoAccounts.find(a => a.id === id);
    }
}
exports.AccountRepository = AccountRepository;
//# sourceMappingURL=AccountRepository.js.map