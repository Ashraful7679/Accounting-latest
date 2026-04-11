import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { TransactionRepository } from '../../repositories/TransactionRepository';
import { AccountRepository } from '../../repositories/AccountRepository';
import { NotificationController } from './notification.controller';
import { NotFoundError, ForbiddenError, ValidationError } from '../../middleware/errorHandler';
import { BaseCompanyController } from './base.controller';

export class EmployeeController extends BaseCompanyController {
  // ============================================
  // EMPLOYEE MANAGEMENT
  // ============================================

  async getEmployees(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const employees = await prisma.employee.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ success: true, data: employees });
  }

  async createEmployee(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: companyId } = request.params as { id: string };
      const { firstName, lastName, email, phone, designation, department, joinDate, salary } = request.body as any;

      if (!firstName || !lastName) {
        throw new ValidationError('First name and last name are required');
      }

      const employeeCode = await this.generateDocumentNumber(companyId, 'employee');

      const employee = await prisma.$transaction(async (tx) => {
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
        await TransactionRepository.ensureEntityAccount(tx, companyId, emp.id, `${emp.firstName} ${emp.lastName}`, emp.employeeCode, 'PAYABLE');

        return emp;
      });

      return reply.send({ success: true, data: employee });
    } catch (error: any) {
      console.error('Error creating employee:', error);
      return reply.status(error.statusCode || 500).send({ success: false, error: error.message || 'Internal server error' });
    }
  }

  async updateEmployee(request: FastifyRequest, reply: FastifyReply) {
    const { employeeId } = request.params as { employeeId: string };
    const data = request.body as any;

    const employee = await prisma.employee.update({
      where: { id: employeeId },
      data: {
        ...data,
        joinDate: data.joinDate ? new Date(data.joinDate) : undefined,
      },
    });

    return reply.send({ success: true, data: employee });
  }

  async deleteEmployee(request: FastifyRequest, reply: FastifyReply) {
    const { employeeId } = request.params as { employeeId: string };
    await prisma.employee.delete({ where: { id: employeeId } });
    return reply.send({ success: true });
  }

  // ============================================
  // SALARY PAYMENTS
  // ============================================

  async paySalary(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, employeeId } = request.params as { id: string; employeeId: string };
    const { amount, date, description } = request.body as any;
    const userId = (request.user as any).id;

    try {
      const journal = await prisma.$transaction(async (tx) => {
        return await TransactionRepository.generateSalaryJournal(tx, {
          companyId,
          employeeId,
          amount,
          date: date || new Date(),
          description,
          userId
        });
      });

      await NotificationController.logActivity({
        companyId,
        entityType: 'Employee',
        entityId: employeeId,
        action: 'PAY_SALARY_DRAFT',
        performedById: userId,
        metadata: { amount, journalId: journal.id }
      });

      return reply.send({ success: true, data: journal, message: 'Draft Salary Journal created successfully' });
    } catch (error: any) {
      console.error('Salary payment failed:', error);
      return reply.status(500).send({ success: false, message: error.message || 'Internal server error' });
    }
  }

  // ============================================
  // EMPLOYEE ADVANCES
  // ============================================

  async getEmployeeAdvances(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const advances = await prisma.employeeAdvance.findMany({
      where: { companyId },
      include: { employee: true, account: true },
      orderBy: { date: 'desc' },
    });
    return reply.send({ success: true, data: advances });
  }

  async createEmployeeAdvance(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { employeeId, amount, purpose, date, paymentMethod, accountId } = request.body as any;

    const advance = await prisma.employeeAdvance.create({
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

  async updateEmployeeAdvance(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, advanceId } = request.params as { id: string, advanceId: string };
    const data = request.body as any;
    const userId = (request.user as any).id;

    const existing = await prisma.employeeAdvance.findUnique({ where: { id: advanceId } });
    if (!existing) throw new NotFoundError('Advance not found');

    const role = await this.getUserRole(userId, companyId);
    if (!this.canEdit(existing.status, role)) {
      throw new ForbiddenError('Cannot edit this advance in current status');
    }

    const advance = await prisma.employeeAdvance.update({
      where: { id: advanceId },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
      },
    });

    return reply.send({ success: true, data: advance });
  }

  async deleteEmployeeAdvance(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, advanceId } = request.params as { id: string, advanceId: string };
    const userId = (request.user as any).id;

    const existing = await prisma.employeeAdvance.findUnique({ where: { id: advanceId } });
    if (!existing) throw new NotFoundError('Advance not found');

    const role = await this.getUserRole(userId, companyId);
    if (!this.canDelete(existing.status, role)) {
      throw new ForbiddenError('Cannot delete this advance');
    }

    await prisma.employeeAdvance.delete({ where: { id: advanceId } });
    return reply.send({ success: true });
  }

  async verifyEmployeeAdvance(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, advanceId } = request.params as { id: string; advanceId: string };
    const userId = (request.user as any).id;

    const advance = await prisma.employeeAdvance.findUnique({ where: { id: advanceId } });
    if (!advance) throw new NotFoundError('Advance not found');

    const role = await this.getUserRole(userId, companyId);
    if (!this.canVerify(advance.status, role)) {
      throw new ForbiddenError(`Cannot verify this advance from current status: ${advance.status}`);
    }

    const updated = await prisma.employeeAdvance.update({
      where: { id: advanceId },
      data: { status: 'VERIFIED' },
    });

    return reply.send({ success: true, data: updated });
  }

  async approveEmployeeAdvance(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: companyId, advanceId } = request.params as { id: string; advanceId: string };
      const userId = (request.user as any).id;

      const advance = await prisma.employeeAdvance.findUnique({
        where: { id: advanceId },
        include: { employee: true },
      });

      if (!advance) throw new NotFoundError('Advance not found');

      const entryNumber = await this.generateDocumentNumber(companyId, 'journal');
      
      const cashAccount = await AccountRepository.findByCategory(companyId, 'CASH');
      const bankAccount = await AccountRepository.findByCategory(companyId, 'BANK');
      
      const advanceAccount = await prisma.account.findFirst({
        where: { 
          companyId, 
          OR: [
            { category: 'ASSET' },
            { name: { contains: 'Advance', mode: 'insensitive' } }
          ],
          isActive: true 
        },
      });

      const employeePayableAccount = await prisma.account.findFirst({
        where: { 
          companyId, 
          OR: [ { category: 'AP' }, { name: { contains: 'Employee', mode: 'insensitive' } } ],
          isActive: true 
        },
      });

      const creditAccountId = (advance.accountId || cashAccount?.id || bankAccount?.id) as string;
      const debitAccountId = (employeePayableAccount?.id || advanceAccount?.id || creditAccountId) as string;

      if (!debitAccountId || !creditAccountId) {
        throw new ValidationError('Required accounts (Cash/Bank or Employee/Advance) not found.');
      }

      const journal = await prisma.journalEntry.create({
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

      await prisma.employeeAdvance.update({
        where: { id: advanceId },
        data: { status: 'APPROVED', journalEntryId: journal.id },
      });

      return reply.send({ success: true, data: { advance, journal } });
    } catch (error: any) {
      return reply.status(error.statusCode || 500).send({ success: false, error: error.message || 'Internal server error' });
    }
  }

  // ============================================
  // EMPLOYEE LOANS
  // ============================================

  async getEmployeeLoans(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const loans = await prisma.employeeLoan.findMany({
      where: { companyId },
      include: { employee: true, repayments: true },
      orderBy: { startDate: 'desc' },
    });
    return reply.send({ success: true, data: loans });
  }

  async createEmployeeLoan(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { employeeId, principalAmount, interestRate, installments, startDate, purpose, interestMethod } = request.body as any;

    const principal = parseFloat(principalAmount);
    const rate = parseFloat(interestRate || 0);
    const n = parseInt(installments) || 1;
    const method = interestMethod || 'FLAT';

    let interestAmount: number;
    let monthlyInstallment: number;

    if (method === 'REDUCING' && rate > 0) {
      // Standard EMI (Reducing Balance): EMI = P * r * (1+r)^n / ((1+r)^n - 1)
      const r = rate / 12 / 100; // monthly rate
      const factor = Math.pow(1 + r, n);
      monthlyInstallment = principal * r * factor / (factor - 1);
      const totalAmount = monthlyInstallment * n;
      interestAmount = totalAmount - principal;
    } else {
      // Flat-rate: Interest = P * (annualRate/100) * (months/12)
      interestAmount = principal * (rate / 100) * (n / 12);
      monthlyInstallment = (principal + interestAmount) / n;
    }

    const totalAmount = principal + interestAmount;

    const loan = await prisma.employeeLoan.create({
      data: {
        employeeId,
        principalAmount: principal,
        interestRate: rate,
        interestAmount: Math.round(interestAmount * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        installments: n,
        startDate: new Date(startDate),
        purpose: purpose ? `${purpose}${method === 'REDUCING' ? ' [REDUCING]' : ' [FLAT]'}` : (method === 'REDUCING' ? '[REDUCING]' : '[FLAT]'),
        companyId,
      },
    });
    return reply.send({ success: true, data: { ...loan, monthlyInstallment: Math.round(monthlyInstallment * 100) / 100, interestMethod: method } });
  }

  async updateEmployeeLoan(request: FastifyRequest, reply: FastifyReply) {
    const { loanId } = request.params as { loanId: string };
    const data = request.body as any;
    const loan = await prisma.employeeLoan.update({
      where: { id: loanId },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
      },
    });
    return reply.send({ success: true, data: loan });
  }

  async deleteEmployeeLoan(request: FastifyRequest, reply: FastifyReply) {
    const { loanId } = request.params as { loanId: string };
    await prisma.employeeLoan.delete({ where: { id: loanId } });
    return reply.send({ success: true });
  }

  async verifyEmployeeLoan(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, loanId } = request.params as { id: string; loanId: string };
    const userId = (request.user as any).id;
    const loan = await prisma.employeeLoan.findUnique({ where: { id: loanId } });
    if (!loan) throw new NotFoundError('Loan not found');
    const role = await this.getUserRole(userId, companyId);
    if (!this.canVerify(loan.status, role)) throw new ForbiddenError('Cannot verify this loan');
    const updated = await prisma.employeeLoan.update({ where: { id: loanId }, data: { status: 'VERIFIED' } });
    return reply.send({ success: true, data: updated });
  }

  async approveEmployeeLoan(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: companyId, loanId } = request.params as { id: string; loanId: string };
      const userId = (request.user as any).id;
      const loan = await prisma.employeeLoan.findUnique({ where: { id: loanId }, include: { employee: true } });
      if (!loan) throw new NotFoundError('Loan not found');

      const entryNumber = await this.generateDocumentNumber(companyId, 'journal');
      const creditAccountId = (await AccountRepository.findByCategory(companyId, 'CASH'))?.id as string;
      const loanAccount = await prisma.account.findFirst({
        where: { companyId, name: { contains: 'Loan', mode: 'insensitive' }, isActive: true }
      });
      const debitAccountId = (loanAccount?.id || creditAccountId) as string;

      if (!debitAccountId || !creditAccountId) throw new ValidationError('Required accounts not found.');

      await prisma.journalEntry.create({
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

      await prisma.employeeLoan.update({ where: { id: loanId }, data: { status: 'ACTIVE' } });
      return reply.send({ success: true });
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message });
    }
  }

  async getLoanRepayments(request: FastifyRequest, reply: FastifyReply) {
    const { loanId } = request.params as { loanId: string };
    const repayments = await prisma.employeeLoanRepayment.findMany({
      where: { loanId },
      orderBy: { paymentDate: 'desc' },
    });
    return reply.send({ success: true, data: repayments });
  }

  async createLoanRepayment(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { loanId, amount, paymentDate, principalPaid, interestPaid } = request.body as any;
    const repayment = await prisma.employeeLoanRepayment.create({
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

  async verifyLoanRepayment(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, repaymentId } = request.params as { id: string; repaymentId: string };
    const userId = (request.user as any).id;
    const repayment = await prisma.employeeLoanRepayment.findUnique({ where: { id: repaymentId } });
    if (!repayment) throw new NotFoundError('Repayment not found');
    const role = await this.getUserRole(userId, companyId);
    if (!this.canVerify(repayment.status, role)) throw new ForbiddenError('Cannot verify this repayment');
    const updated = await prisma.employeeLoanRepayment.update({ where: { id: repaymentId }, data: { status: 'VERIFIED' } });
    return reply.send({ success: true, data: updated });
  }

  async approveLoanRepayment(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, repaymentId } = request.params as { id: string; repaymentId: string };
    const userId = (request.user as any).id;
    const repayment = await prisma.employeeLoanRepayment.findUnique({
      where: { id: repaymentId },
      include: { loan: { include: { employee: true } } }
    });
    if (!repayment) throw new NotFoundError('Repayment not found');

    // Create journal entry for the repayment: Dr Cash/Bank, Cr Loan Receivable (principal) + Interest Income (interest)
    const entryNumber = await this.generateDocumentNumber(companyId, 'journal');
    const cashAccount = await AccountRepository.findByCategory(companyId, 'CASH');
    const bankAccount = await AccountRepository.findByCategory(companyId, 'BANK');
    const creditAccountId = (bankAccount?.id || cashAccount?.id) as string;

    // Find the loan account (debit side of original loan)
    const loanAccount = await prisma.account.findFirst({
      where: { companyId, name: { contains: 'Loan', mode: 'insensitive' }, isActive: true }
    });
    const loanAccountId = loanAccount?.id || creditAccountId;

    const journalLines: any[] = [];

    // Dr Cash/Bank for total repayment amount
    journalLines.push({
      accountId: creditAccountId,
      debit: repayment.amount,
      credit: 0,
      debitBase: repayment.amount,
      creditBase: 0,
      exchangeRate: 1,
      description: `Loan repayment received - ${(repayment as any).loan?.employee?.name || 'Employee'}`
    });

    // Cr Loan Receivable for principal portion
    if (repayment.principalPaid > 0) {
      journalLines.push({
        accountId: loanAccountId,
        debit: 0,
        credit: repayment.principalPaid,
        debitBase: 0,
        creditBase: repayment.principalPaid,
        exchangeRate: 1,
        description: `Loan principal repayment`
      });
    }

    // Cr Interest Income for interest portion (use loan account if no separate interest income account)
    if (repayment.interestPaid > 0) {
      const interestAccount = await prisma.account.findFirst({
        where: { companyId, name: { contains: 'Interest Income', mode: 'insensitive' }, isActive: true }
      });
      journalLines.push({
        accountId: interestAccount?.id || loanAccountId,
        debit: 0,
        credit: repayment.interestPaid,
        debitBase: 0,
        creditBase: repayment.interestPaid,
        exchangeRate: 1,
        description: `Loan interest received`
      });
    }

    await prisma.journalEntry.create({
      data: {
        entryNumber,
        date: repayment.paymentDate,
        companyId,
        createdById: userId,
        status: 'APPROVED',
        description: `Employee loan repayment - ${(repayment as any).loan?.employee?.name || 'Employee'}`,
        totalDebit: repayment.amount,
        totalCredit: repayment.amount,
        lines: { create: journalLines },
      }
    });

    // Check if loan is fully repaid by summing all approved repayments
    const loan = (repayment as any).loan;
    if (loan) {
      const allRepayments = await prisma.employeeLoanRepayment.findMany({
        where: { loanId: loan.id, status: 'APPROVED' }
      });
      const totalPrincipalPaid = allRepayments.reduce((s: number, r: any) => s + r.principalPaid, 0) + repayment.principalPaid;
      if (totalPrincipalPaid >= loan.principalAmount) {
        await prisma.employeeLoan.update({
          where: { id: loan.id },
          data: { status: 'COMPLETED' }
        });
      }
    }

    const updated = await prisma.employeeLoanRepayment.update({ where: { id: repaymentId }, data: { status: 'APPROVED' } });
    return reply.send({ success: true, data: updated });
  }

  // ============================================
  // EMPLOYEE EXPENSES
  // ============================================

  async getEmployeeExpenses(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const expenses = await prisma.employeeExpense.findMany({
      where: { companyId },
      include: { employee: true, account: true },
      orderBy: { date: 'desc' },
    });
    return reply.send({ success: true, data: expenses });
  }

  async createEmployeeExpense(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { employeeId, amount, date, description, category, accountId } = request.body as any;

    const expense = await prisma.employeeExpense.create({
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

  async updateEmployeeExpense(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, expenseId } = request.params as { id: string; expenseId: string };
    const data = request.body as any;
    const userId = (request.user as any).id;

    const existing = await prisma.employeeExpense.findUnique({ where: { id: expenseId } });
    if (!existing) throw new NotFoundError('Expense not found');

    const role = await this.getUserRole(userId, companyId);
    if (!this.canEdit(existing.status, role)) throw new ForbiddenError('Cannot edit this expense');

    const expense = await prisma.employeeExpense.update({
      where: { id: expenseId },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
      }
    });

    return reply.send({ success: true, data: expense });
  }

  async deleteEmployeeExpense(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, expenseId } = request.params as { id: string; expenseId: string };
    const userId = (request.user as any).id;

    const existing = await prisma.employeeExpense.findUnique({ where: { id: expenseId } });
    if (!existing) throw new NotFoundError('Expense not found');

    const role = await this.getUserRole(userId, companyId);
    if (!this.canDelete(existing.status, role)) throw new ForbiddenError('Cannot delete this expense');

    await prisma.employeeExpense.delete({ where: { id: expenseId } });
    return reply.send({ success: true, message: 'Expense deleted successfully' });
  }

  async verifyEmployeeExpense(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, expenseId } = request.params as { id: string; expenseId: string };
    const userId = (request.user as any).id;

    const expense = await prisma.employeeExpense.findUnique({ where: { id: expenseId } });
    if (!expense) throw new NotFoundError('Expense not found');

    const role = await this.getUserRole(userId, companyId);
    if (!this.canVerify(expense.status, role)) throw new ForbiddenError('Cannot verify this expense');

    const updated = await prisma.employeeExpense.update({ where: { id: expenseId }, data: { status: 'VERIFIED' } });
    return reply.send({ success: true, data: updated });
  }

  async approveEmployeeExpense(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: companyId, expenseId } = request.params as { id: string; expenseId: string };
      const userId = (request.user as any).id;

      const expense = await prisma.employeeExpense.findUnique({
        where: { id: expenseId },
        include: { employee: true }
      });

      if (!expense) throw new NotFoundError('Expense not found');

      const entryNumber = await this.generateDocumentNumber(companyId, 'journal');
      
      // Debit: Expense Account, Credit: Employee Payable
      const employeePayableAccount = await prisma.account.findFirst({
        where: { 
          companyId, 
          OR: [ { category: 'AP' }, { name: { contains: 'Employee', mode: 'insensitive' } } ],
          isActive: true 
        },
      });

      if (!expense.accountId || !employeePayableAccount) {
        throw new ValidationError('Required accounts (Expense or Employee Payable) not found.');
      }

      const journal = await prisma.journalEntry.create({
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

      await prisma.employeeExpense.update({
        where: { id: expenseId },
        data: { status: 'APPROVED', journalEntryId: journal.id },
      });

      return reply.send({ success: true, data: { expense, journal } });
    } catch (error: any) {
      return reply.status(error.statusCode || 500).send({ success: false, error: error.message || 'Internal server error' });
    }
  }
}
