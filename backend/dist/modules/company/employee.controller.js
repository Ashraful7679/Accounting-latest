"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeController = void 0;
const database_1 = __importDefault(require("../../config/database"));
const TransactionRepository_1 = require("../../repositories/TransactionRepository");
const AccountRepository_1 = require("../../repositories/AccountRepository");
const notification_controller_1 = require("./notification.controller");
const errorHandler_1 = require("../../middleware/errorHandler");
const base_controller_1 = require("./base.controller");
class EmployeeController extends base_controller_1.BaseCompanyController {
    // ============================================
    // EMPLOYEE MANAGEMENT
    // ============================================
    async getEmployees(request, reply) {
        const { id: companyId } = request.params;
        const employees = await database_1.default.employee.findMany({
            where: { companyId },
            orderBy: { createdAt: 'desc' },
        });
        return reply.send({ success: true, data: employees });
    }
    async createEmployee(request, reply) {
        try {
            const { id: companyId } = request.params;
            const { firstName, lastName, email, phone, designation, department, joinDate, salary } = request.body;
            if (!firstName || !lastName) {
                throw new errorHandler_1.ValidationError('First name and last name are required');
            }
            const employeeCode = await this.generateDocumentNumber(companyId, 'employee');
            const employee = await database_1.default.$transaction(async (tx) => {
                const emp = await tx.employee.create({
                    data: {
                        employeeCode,
                        firstName: String(firstName),
                        lastName: String(lastName),
                        email: email || null,
                        phone: phone || null,
                        designation: designation || null,
                        department: department || null,
                        joinDate: joinDate ? new Date(joinDate) : null,
                        salary: salary ? parseFloat(salary) : 0,
                        companyId,
                    },
                });
                // Automated Ledger Account (Salary Payable)
                await TransactionRepository_1.TransactionRepository.ensureEntityAccount(tx, companyId, emp.id, `${emp.firstName} ${emp.lastName}`, emp.employeeCode, 'PAYABLE');
                return emp;
            });
            return reply.send({ success: true, data: employee });
        }
        catch (error) {
            console.error('Error creating employee:', error);
            return reply.status(error.statusCode || 500).send({ success: false, error: error.message || 'Internal server error' });
        }
    }
    async updateEmployee(request, reply) {
        const { employeeId } = request.params;
        const data = request.body;
        const employee = await database_1.default.employee.update({
            where: { id: employeeId },
            data: {
                ...data,
                joinDate: data.joinDate ? new Date(data.joinDate) : undefined,
            },
        });
        return reply.send({ success: true, data: employee });
    }
    async deleteEmployee(request, reply) {
        const { employeeId } = request.params;
        await database_1.default.employee.delete({ where: { id: employeeId } });
        return reply.send({ success: true });
    }
    // ============================================
    // SALARY PAYMENTS
    // ============================================
    async paySalary(request, reply) {
        const { id: companyId, employeeId } = request.params;
        const { amount, date, description } = request.body;
        const userId = request.user.id;
        try {
            const journal = await database_1.default.$transaction(async (tx) => {
                return await TransactionRepository_1.TransactionRepository.generateSalaryJournal(tx, {
                    companyId,
                    employeeId,
                    amount,
                    date: date || new Date(),
                    description,
                    userId
                });
            });
            await notification_controller_1.NotificationController.logActivity({
                companyId,
                entityType: 'Employee',
                entityId: employeeId,
                action: 'PAY_SALARY_DRAFT',
                performedById: userId,
                metadata: { amount, journalId: journal.id }
            });
            return reply.send({ success: true, data: journal, message: 'Draft Salary Journal created successfully' });
        }
        catch (error) {
            console.error('Salary payment failed:', error);
            return reply.status(500).send({ success: false, message: error.message || 'Internal server error' });
        }
    }
    // ============================================
    // EMPLOYEE ADVANCES
    // ============================================
    async getEmployeeAdvances(request, reply) {
        const { id: companyId } = request.params;
        const advances = await database_1.default.employeeAdvance.findMany({
            where: { companyId },
            include: { employee: true, account: true },
            orderBy: { date: 'desc' },
        });
        return reply.send({ success: true, data: advances });
    }
    async createEmployeeAdvance(request, reply) {
        const { id: companyId } = request.params;
        const { employeeId, amount, purpose, date, paymentMethod, accountId } = request.body;
        const advance = await database_1.default.employeeAdvance.create({
            data: {
                employeeId,
                amount: parseFloat(amount),
                purpose,
                date: new Date(date),
                paymentMethod,
                accountId,
                companyId,
            },
        });
        return reply.send({ success: true, data: advance });
    }
    async updateEmployeeAdvance(request, reply) {
        const { id: companyId, advanceId } = request.params;
        const data = request.body;
        const userId = request.user.id;
        const existing = await database_1.default.employeeAdvance.findUnique({ where: { id: advanceId } });
        if (!existing)
            throw new errorHandler_1.NotFoundError('Advance not found');
        const role = await this.getUserRole(userId, companyId);
        if (!this.canEdit(existing.status, role)) {
            throw new errorHandler_1.ForbiddenError('Cannot edit this advance in current status');
        }
        const advance = await database_1.default.employeeAdvance.update({
            where: { id: advanceId },
            data: {
                ...data,
                date: data.date ? new Date(data.date) : undefined,
            },
        });
        return reply.send({ success: true, data: advance });
    }
    async deleteEmployeeAdvance(request, reply) {
        const { id: companyId, advanceId } = request.params;
        const userId = request.user.id;
        const existing = await database_1.default.employeeAdvance.findUnique({ where: { id: advanceId } });
        if (!existing)
            throw new errorHandler_1.NotFoundError('Advance not found');
        const role = await this.getUserRole(userId, companyId);
        if (!this.canDelete(existing.status, role)) {
            throw new errorHandler_1.ForbiddenError('Cannot delete this advance');
        }
        await database_1.default.employeeAdvance.delete({ where: { id: advanceId } });
        return reply.send({ success: true });
    }
    async verifyEmployeeAdvance(request, reply) {
        const { id: companyId, advanceId } = request.params;
        const userId = request.user.id;
        const advance = await database_1.default.employeeAdvance.findUnique({ where: { id: advanceId } });
        if (!advance)
            throw new errorHandler_1.NotFoundError('Advance not found');
        const role = await this.getUserRole(userId, companyId);
        if (!this.canVerify(advance.status, role)) {
            throw new errorHandler_1.ForbiddenError(`Cannot verify this advance from current status: ${advance.status}`);
        }
        const updated = await database_1.default.employeeAdvance.update({
            where: { id: advanceId },
            data: { status: 'VERIFIED' },
        });
        return reply.send({ success: true, data: updated });
    }
    async approveEmployeeAdvance(request, reply) {
        try {
            const { id: companyId, advanceId } = request.params;
            const userId = request.user.id;
            const advance = await database_1.default.employeeAdvance.findUnique({
                where: { id: advanceId },
                include: { employee: true },
            });
            if (!advance)
                throw new errorHandler_1.NotFoundError('Advance not found');
            const entryNumber = await this.generateDocumentNumber(companyId, 'journal');
            const cashAccount = await AccountRepository_1.AccountRepository.findByCategory(companyId, 'CASH');
            const bankAccount = await AccountRepository_1.AccountRepository.findByCategory(companyId, 'BANK');
            const advanceAccount = await database_1.default.account.findFirst({
                where: {
                    companyId,
                    OR: [
                        { category: 'ASSET' },
                        { name: { contains: 'Advance', mode: 'insensitive' } }
                    ],
                    isActive: true
                },
            });
            const employeePayableAccount = await database_1.default.account.findFirst({
                where: {
                    companyId,
                    OR: [{ category: 'AP' }, { name: { contains: 'Employee', mode: 'insensitive' } }],
                    isActive: true
                },
            });
            const creditAccountId = (advance.accountId || cashAccount?.id || bankAccount?.id);
            const debitAccountId = (employeePayableAccount?.id || advanceAccount?.id || creditAccountId);
            if (!debitAccountId || !creditAccountId) {
                throw new errorHandler_1.ValidationError('Required accounts (Cash/Bank or Employee/Advance) not found.');
            }
            const journal = await database_1.default.journalEntry.create({
                data: {
                    entryNumber,
                    date: advance.date,
                    companyId,
                    createdById: userId,
                    status: 'APPROVED',
                    totalDebit: advance.amount,
                    totalCredit: advance.amount,
                    lines: {
                        create: [
                            {
                                accountId: debitAccountId,
                                debit: advance.amount,
                                credit: 0,
                                debitBase: advance.amount,
                                creditBase: 0,
                                exchangeRate: 1,
                            },
                            {
                                accountId: creditAccountId,
                                debit: 0,
                                credit: advance.amount,
                                debitBase: 0,
                                creditBase: advance.amount,
                                exchangeRate: 1,
                            },
                        ],
                    },
                },
            });
            await database_1.default.employeeAdvance.update({
                where: { id: advanceId },
                data: { status: 'APPROVED', journalEntryId: journal.id },
            });
            return reply.send({ success: true, data: { advance, journal } });
        }
        catch (error) {
            return reply.status(error.statusCode || 500).send({ success: false, error: error.message || 'Internal server error' });
        }
    }
    // ============================================
    // EMPLOYEE LOANS
    // ============================================
    async getEmployeeLoans(request, reply) {
        const { id: companyId } = request.params;
        const loans = await database_1.default.employeeLoan.findMany({
            where: { companyId },
            include: { employee: true, repayments: true },
            orderBy: { startDate: 'desc' },
        });
        return reply.send({ success: true, data: loans });
    }
    async createEmployeeLoan(request, reply) {
        const { id: companyId } = request.params;
        const { employeeId, principalAmount, interestRate, installments, startDate, purpose } = request.body;
        const principal = parseFloat(principalAmount);
        const rate = parseFloat(interestRate || 0);
        const interestAmount = (principal * rate * (installments / 12)) / 100;
        const totalAmount = principal + interestAmount;
        const loan = await database_1.default.employeeLoan.create({
            data: {
                employeeId,
                principalAmount: principal,
                interestRate: rate,
                interestAmount,
                totalAmount,
                installments: parseInt(installments) || 1,
                startDate: new Date(startDate),
                purpose,
                companyId,
            },
        });
        return reply.send({ success: true, data: loan });
    }
    async updateEmployeeLoan(request, reply) {
        const { loanId } = request.params;
        const data = request.body;
        const loan = await database_1.default.employeeLoan.update({
            where: { id: loanId },
            data: {
                ...data,
                startDate: data.startDate ? new Date(data.startDate) : undefined,
            },
        });
        return reply.send({ success: true, data: loan });
    }
    async deleteEmployeeLoan(request, reply) {
        const { loanId } = request.params;
        await database_1.default.employeeLoan.delete({ where: { id: loanId } });
        return reply.send({ success: true });
    }
    async verifyEmployeeLoan(request, reply) {
        const { id: companyId, loanId } = request.params;
        const userId = request.user.id;
        const loan = await database_1.default.employeeLoan.findUnique({ where: { id: loanId } });
        if (!loan)
            throw new errorHandler_1.NotFoundError('Loan not found');
        const role = await this.getUserRole(userId, companyId);
        if (!this.canVerify(loan.status, role))
            throw new errorHandler_1.ForbiddenError('Cannot verify this loan');
        const updated = await database_1.default.employeeLoan.update({ where: { id: loanId }, data: { status: 'VERIFIED' } });
        return reply.send({ success: true, data: updated });
    }
    async approveEmployeeLoan(request, reply) {
        try {
            const { id: companyId, loanId } = request.params;
            const userId = request.user.id;
            const loan = await database_1.default.employeeLoan.findUnique({ where: { id: loanId }, include: { employee: true } });
            if (!loan)
                throw new errorHandler_1.NotFoundError('Loan not found');
            const entryNumber = await this.generateDocumentNumber(companyId, 'journal');
            const creditAccountId = (await AccountRepository_1.AccountRepository.findByCategory(companyId, 'CASH'))?.id;
            const loanAccount = await database_1.default.account.findFirst({
                where: { companyId, name: { contains: 'Loan', mode: 'insensitive' }, isActive: true }
            });
            const debitAccountId = (loanAccount?.id || creditAccountId);
            if (!debitAccountId || !creditAccountId)
                throw new errorHandler_1.ValidationError('Required accounts not found.');
            await database_1.default.journalEntry.create({
                data: {
                    entryNumber, date: loan.startDate, companyId, createdById: userId, status: 'APPROVED',
                    totalDebit: loan.totalAmount, totalCredit: loan.totalAmount,
                    lines: {
                        create: [
                            { accountId: debitAccountId, debit: loan.principalAmount, credit: 0, debitBase: loan.principalAmount, creditBase: 0, exchangeRate: 1 },
                            { accountId: debitAccountId, debit: loan.interestAmount, credit: 0, debitBase: loan.interestAmount, creditBase: 0, exchangeRate: 1 },
                            { accountId: creditAccountId, debit: 0, credit: loan.totalAmount, debitBase: 0, creditBase: loan.totalAmount, exchangeRate: 1 },
                        ],
                    },
                },
            });
            await database_1.default.employeeLoan.update({ where: { id: loanId }, data: { status: 'ACTIVE' } });
            return reply.send({ success: true });
        }
        catch (error) {
            return reply.status(500).send({ success: false, error: error.message });
        }
    }
    async getLoanRepayments(request, reply) {
        const { loanId } = request.params;
        const repayments = await database_1.default.employeeLoanRepayment.findMany({
            where: { loanId },
            orderBy: { paymentDate: 'desc' },
        });
        return reply.send({ success: true, data: repayments });
    }
    async createLoanRepayment(request, reply) {
        const { id: companyId } = request.params;
        const { loanId, amount, paymentDate, principalPaid, interestPaid } = request.body;
        const repayment = await database_1.default.employeeLoanRepayment.create({
            data: {
                loanId,
                amount: parseFloat(amount),
                principalPaid: parseFloat(principalPaid || amount),
                interestPaid: parseFloat(interestPaid || 0),
                paymentDate: new Date(paymentDate),
                status: 'DRAFT',
                companyId
            }
        });
        return reply.send({ success: true, data: repayment });
    }
    async verifyLoanRepayment(request, reply) {
        const { id: companyId, repaymentId } = request.params;
        const userId = request.user.id;
        const repayment = await database_1.default.employeeLoanRepayment.findUnique({ where: { id: repaymentId } });
        if (!repayment)
            throw new errorHandler_1.NotFoundError('Repayment not found');
        const role = await this.getUserRole(userId, companyId);
        if (!this.canVerify(repayment.status, role))
            throw new errorHandler_1.ForbiddenError('Cannot verify this repayment');
        const updated = await database_1.default.employeeLoanRepayment.update({ where: { id: repaymentId }, data: { status: 'VERIFIED' } });
        return reply.send({ success: true, data: updated });
    }
    async approveLoanRepayment(request, reply) {
        const { id: companyId, repaymentId } = request.params;
        const userId = request.user.id;
        const repayment = await database_1.default.employeeLoanRepayment.findUnique({ where: { id: repaymentId } });
        if (!repayment)
            throw new errorHandler_1.NotFoundError('Repayment not found');
        const updated = await database_1.default.employeeLoanRepayment.update({ where: { id: repaymentId }, data: { status: 'APPROVED' } });
        return reply.send({ success: true, data: updated });
    }
    // ============================================
    // EMPLOYEE EXPENSES
    // ============================================
    async getEmployeeExpenses(request, reply) {
        const { id: companyId } = request.params;
        const expenses = await database_1.default.employeeExpense.findMany({
            where: { companyId },
            include: { employee: true, account: true },
            orderBy: { date: 'desc' },
        });
        return reply.send({ success: true, data: expenses });
    }
    async createEmployeeExpense(request, reply) {
        const { id: companyId } = request.params;
        const { employeeId, amount, date, description, category, accountId } = request.body;
        const expense = await database_1.default.employeeExpense.create({
            data: {
                companyId,
                employeeId,
                amount: parseFloat(amount),
                date: new Date(date),
                description,
                category: category || 'OTHER',
                accountId, // Account to debit (The expense account)
                status: 'DRAFT'
            }
        });
        return reply.send({ success: true, data: expense });
    }
    async updateEmployeeExpense(request, reply) {
        const { id: companyId, expenseId } = request.params;
        const data = request.body;
        const userId = request.user.id;
        const existing = await database_1.default.employeeExpense.findUnique({ where: { id: expenseId } });
        if (!existing)
            throw new errorHandler_1.NotFoundError('Expense not found');
        const role = await this.getUserRole(userId, companyId);
        if (!this.canEdit(existing.status, role))
            throw new errorHandler_1.ForbiddenError('Cannot edit this expense');
        const expense = await database_1.default.employeeExpense.update({
            where: { id: expenseId },
            data: {
                ...data,
                date: data.date ? new Date(data.date) : undefined,
            }
        });
        return reply.send({ success: true, data: expense });
    }
    async deleteEmployeeExpense(request, reply) {
        const { id: companyId, expenseId } = request.params;
        const userId = request.user.id;
        const existing = await database_1.default.employeeExpense.findUnique({ where: { id: expenseId } });
        if (!existing)
            throw new errorHandler_1.NotFoundError('Expense not found');
        const role = await this.getUserRole(userId, companyId);
        if (!this.canDelete(existing.status, role))
            throw new errorHandler_1.ForbiddenError('Cannot delete this expense');
        await database_1.default.employeeExpense.delete({ where: { id: expenseId } });
        return reply.send({ success: true, message: 'Expense deleted successfully' });
    }
    async verifyEmployeeExpense(request, reply) {
        const { id: companyId, expenseId } = request.params;
        const userId = request.user.id;
        const expense = await database_1.default.employeeExpense.findUnique({ where: { id: expenseId } });
        if (!expense)
            throw new errorHandler_1.NotFoundError('Expense not found');
        const role = await this.getUserRole(userId, companyId);
        if (!this.canVerify(expense.status, role))
            throw new errorHandler_1.ForbiddenError('Cannot verify this expense');
        const updated = await database_1.default.employeeExpense.update({ where: { id: expenseId }, data: { status: 'VERIFIED' } });
        return reply.send({ success: true, data: updated });
    }
    async approveEmployeeExpense(request, reply) {
        try {
            const { id: companyId, expenseId } = request.params;
            const userId = request.user.id;
            const expense = await database_1.default.employeeExpense.findUnique({
                where: { id: expenseId },
                include: { employee: true }
            });
            if (!expense)
                throw new errorHandler_1.NotFoundError('Expense not found');
            const entryNumber = await this.generateDocumentNumber(companyId, 'journal');
            // Debit: Expense Account, Credit: Employee Payable
            const employeePayableAccount = await database_1.default.account.findFirst({
                where: {
                    companyId,
                    OR: [{ category: 'AP' }, { name: { contains: 'Employee', mode: 'insensitive' } }],
                    isActive: true
                },
            });
            if (!expense.accountId || !employeePayableAccount) {
                throw new errorHandler_1.ValidationError('Required accounts (Expense or Employee Payable) not found.');
            }
            const journal = await database_1.default.journalEntry.create({
                data: {
                    entryNumber,
                    date: expense.date,
                    companyId,
                    createdById: userId,
                    status: 'APPROVED',
                    totalDebit: expense.amount,
                    totalCredit: expense.amount,
                    lines: {
                        create: [
                            {
                                accountId: expense.accountId,
                                debit: expense.amount,
                                credit: 0,
                                debitBase: expense.amount,
                                creditBase: 0,
                                exchangeRate: 1,
                            },
                            {
                                accountId: employeePayableAccount.id,
                                debit: 0,
                                credit: expense.amount,
                                debitBase: 0,
                                creditBase: expense.amount,
                                exchangeRate: 1,
                            },
                        ],
                    },
                },
            });
            await database_1.default.employeeExpense.update({
                where: { id: expenseId },
                data: { status: 'APPROVED', journalEntryId: journal.id },
            });
            return reply.send({ success: true, data: { expense, journal } });
        }
        catch (error) {
            return reply.status(error.statusCode || 500).send({ success: false, error: error.message || 'Internal server error' });
        }
    }
}
exports.EmployeeController = EmployeeController;
//# sourceMappingURL=employee.controller.js.map