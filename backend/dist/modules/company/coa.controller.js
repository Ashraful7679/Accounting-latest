"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoaController = void 0;
const database_1 = __importDefault(require("../../config/database"));
const AccountRepository_1 = require("../../repositories/AccountRepository");
const errorHandler_1 = require("../../middleware/errorHandler");
const base_controller_1 = require("./base.controller");
class CoaController extends base_controller_1.BaseCompanyController {
    // ============ ACCOUNTS ============
    async getAccounts(request, reply) {
        const { id: companyId } = request.params;
        const { limit, page } = request.query;
        const take = limit ? parseInt(limit) : undefined;
        const skip = (page && take) ? (parseInt(page) - 1) * take : undefined;
        const accounts = await AccountRepository_1.AccountRepository.findMany({ companyId }, take, skip);
        return reply.send({ success: true, data: accounts });
    }
    async createAccount(request, reply) {
        const { id: companyId } = request.params;
        const { code, name, accountTypeId, parentId, openingBalance, cashFlowType, category } = request.body;
        let accountCode = code;
        // If no code provided, auto-generate based on account type
        if (!accountCode) {
            const accountType = await database_1.default.accountType.findUnique({ where: { id: accountTypeId } });
            if (parentId) {
                // Get parent account and derive code from its serial
                const parent = await database_1.default.account.findUnique({ where: { id: parentId } });
                if (parent) {
                    // Get count of existing children under this parent
                    const siblingCount = await database_1.default.account.count({ where: { parentId } });
                    const parentPrefix = parent.code.substring(0, parent.code.length - 2);
                    accountCode = `${parentPrefix}${String(siblingCount + 1).padStart(2, '0')}`;
                }
            }
            else if (accountType) {
                // Generate code based on account type
                const typeCodeMap = {
                    'ASSET': { prefix: 'A-1', min: 100, max: 999 },
                    'LIABILITY': { prefix: 'L-1', min: 100, max: 999 },
                    'EQUITY': { prefix: 'E-1', min: 100, max: 999 },
                    'INCOME': { prefix: 'I-1', min: 100, max: 999 },
                    'EXPENSE': { prefix: 'X-1', min: 100, max: 999 },
                };
                const config = typeCodeMap[accountType.name];
                if (config) {
                    // Find next available code in range
                    const existing = await database_1.default.account.findMany({
                        where: {
                            companyId,
                            code: { startsWith: config.prefix }
                        },
                        orderBy: { code: 'desc' },
                        take: 1
                    });
                    let nextNum = config.min;
                    if (existing.length > 0) {
                        const lastCode = existing[0].code;
                        const lastNum = parseInt(lastCode.replace(/[^0-9]/g, ''));
                        if (lastNum < config.max) {
                            nextNum = lastNum + 1;
                        }
                    }
                    accountCode = `${config.prefix}${String(nextNum).padStart(3, '0')}`;
                }
            }
        }
        if (!accountCode) {
            return reply.status(400).send({ success: false, error: 'Could not generate account code' });
        }
        const openBal = parseFloat(openingBalance) || 0;
        const account = await AccountRepository_1.AccountRepository.create({
            code: accountCode,
            name,
            companyId,
            accountTypeId,
            parentId: parentId || null,
            openingBalance: openBal,
            currentBalance: openBal,
            cashFlowType,
            category: category || 'NONE'
        });
        return reply.status(201).send({ success: true, data: account });
    }
    async updateAccount(request, reply) {
        const { accountId } = request.params;
        const { code, name, accountTypeId, parentId, openingBalance, isActive, cashFlowType, category } = request.body;
        const existingAccount = await database_1.default.account.findUnique({ where: { id: accountId } });
        if (!existingAccount)
            throw new errorHandler_1.NotFoundError('Account not found');
        const account = await database_1.default.account.update({
            where: { id: accountId },
            data: {
                name: name ?? existingAccount.name,
                isActive: isActive ?? existingAccount.isActive,
                cashFlowType: cashFlowType ?? existingAccount.cashFlowType,
                code: code ?? existingAccount.code,
                accountTypeId: accountTypeId ?? existingAccount.accountTypeId,
                parentId: parentId === null ? null : (parentId ?? existingAccount.parentId),
                openingBalance: openingBalance !== undefined ? parseFloat(openingBalance) : existingAccount.openingBalance,
                category: category ?? existingAccount.category
            },
        });
        return reply.send({ success: true, data: account });
    }
    async getAccountTypes(request, reply) {
        const types = await AccountRepository_1.AccountRepository.findAccountTypes();
        return reply.send({ success: true, data: types });
    }
    async healBalances(request, reply) {
        const { id: companyId } = request.params;
        // 1. Get all accounts for this company
        const accounts = await database_1.default.account.findMany({
            where: { companyId },
            include: { accountType: true }
        });
        // 2. Wrap in a transaction for safety
        await database_1.default.$transaction(async (tx) => {
            for (const account of accounts) {
                // Reset to opening balance
                let balance = Number(account.openingBalance) || 0;
                // Get all approved ledger lines for this account
                const lines = await tx.journalEntryLine.findMany({
                    where: {
                        accountId: account.id,
                        journalEntry: { status: 'APPROVED' }
                    }
                });
                // Sum up movements
                const isDebitType = account.accountType.type === 'DEBIT';
                for (const line of lines) {
                    const change = isDebitType
                        ? (Number(line.debitBase) - Number(line.creditBase))
                        : (Number(line.creditBase) - Number(line.debitBase));
                    balance += change;
                }
                // Update Account
                await tx.account.update({
                    where: { id: account.id },
                    data: { currentBalance: balance }
                });
            }
        });
        return reply.send({ success: true, message: 'All account balances have been synchronized with the ledger.' });
    }
}
exports.CoaController = CoaController;
//# sourceMappingURL=coa.controller.js.map