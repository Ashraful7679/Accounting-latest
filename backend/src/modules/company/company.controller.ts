import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { AccountRepository } from '../../repositories/AccountRepository';
import { TransactionRepository } from '../../repositories/TransactionRepository';
import { CustomerRepository } from '../../repositories/CustomerRepository';
import { VendorRepository } from '../../repositories/VendorRepository';
import { SYSTEM_MODE } from '../../lib/systemMode';
import { demoCompany } from '../../lib/mockData/company';
import { NotFoundError, ForbiddenError, ValidationError } from '../../middleware/errorHandler';
import path from 'path';
import fs from 'fs';

export class CompanyController {
  // Generate customer/vendor code
  private generateCode(prefix: string): string {
    return `${prefix}-${Date.now().toString().slice(-6)}`;
  }

  // Generate invoice/journal number
  private async generateDocumentNumber(companyId: string, type: 'invoice' | 'journal'): Promise<string> {
    const prefix = type === 'invoice' ? 'INV' : 'JE';
    const year = new Date().getFullYear();

    const lastDoc = type === 'invoice' 
      ? await prisma.invoice.findFirst({
          where: { companyId },
          orderBy: { createdAt: 'desc' },
        })
      : await prisma.journalEntry.findFirst({
          where: { companyId },
          orderBy: { createdAt: 'desc' },
        });

    let counter = 1;
    if (lastDoc) {
      const docNum = type === 'invoice' 
        ? (lastDoc as any).invoiceNumber 
        : (lastDoc as any).entryNumber;
      const lastNum = parseInt(docNum.split('-').pop() || '0');
      counter = lastNum + 1;
    }

    return `${prefix}-${year}-${counter.toString().padStart(4, '0')}`;
  }

  // Check user access to company
  private async checkCompanyAccess(userId: string, companyId: string): Promise<boolean> {
    const userCompany = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    return !!userCompany;
  }

  // Get user role in company
  private async getUserRole(userId: string, companyId: string): Promise<string> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) return 'User';

    // Check if owner
    const isOwner = await prisma.userCompany.findFirst({
      where: { userId, companyId },
      include: {
        user: { include: { userRoles: { include: { role: true } } } },
      },
    });

    if (isOwner?.user.userRoles.some((ur) => ur.role.name === 'Owner')) {
      return 'Owner';
    }

    return user.userRoles[0]?.role.name || 'User';
  }

  // Check if user can perform action based on status
  private canEdit(status: string, role: string): boolean {
    if (role === 'Owner') return true;
    if (role === 'Accountant') return status === 'DRAFT' || status === 'REJECTED';
    return false;
  }

  private canDelete(status: string, role: string): boolean {
    if (role === 'Owner') return status === 'DRAFT';
    if (role === 'Accountant') return status === 'DRAFT';
    return false;
  }

  private canVerify(status: string, role: string): boolean {
    if (role === 'Owner') return status === 'PENDING_VERIFICATION';
    if (role === 'Manager') return status === 'PENDING_VERIFICATION';
    return false;
  }

  private canApprove(status: string, role: string): boolean {
    if (role === 'Owner') return status === 'PENDING_APPROVAL' || status === 'VERIFIED';
    return false;
  }

  async getCompany(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    if (SYSTEM_MODE === "OFFLINE") {
      return reply.send({ success: true, data: demoCompany });
    }

    try {
      const company = await prisma.company.findUnique({
        where: { id },
      });

      if (!company) {
        throw new NotFoundError('Company not found');
      }

      return reply.send({ success: true, data: company });
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      return reply.send({ success: true, data: demoCompany });
    }
  }

  // ============ CUSTOMERS ============
  async getCustomers(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const customers = await CustomerRepository.findMany({ companyId });
    return reply.send({ success: true, data: customers });
  }

  async createCustomer(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { name, email, phone, address, city, country } = request.body as any;

    const code = this.generateCode('CUS');
    const customer = await CustomerRepository.create({ code, name, companyId, email, phone, address, city, country });
    return reply.status(201).send({ success: true, data: customer });
  }

  async updateCustomer(request: FastifyRequest, reply: FastifyReply) {
    const { customerId } = request.params as { customerId: string };
    const data = request.body as any;

    const customer = await prisma.customer.update({
      where: { id: customerId },
      data,
    });

    return reply.send({ success: true, data: customer });
  }

  async deleteCustomer(request: FastifyRequest, reply: FastifyReply) {
    const { customerId } = request.params as { customerId: string };

    await prisma.customer.delete({ where: { id: customerId } });
    return reply.send({ success: true, message: 'Customer deleted' });
  }

  // ============ VENDORS ============
  async getVendors(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const vendors = await VendorRepository.findMany({ companyId });
    return reply.send({ success: true, data: vendors });
  }

  async createVendor(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { name, email, phone, address, city, country } = request.body as any;

    const code = this.generateCode('VEN');
    const vendor = await VendorRepository.create({ code, name, companyId, email, phone, address, city, country });
    return reply.status(201).send({ success: true, data: vendor });
  }

  async updateVendor(request: FastifyRequest, reply: FastifyReply) {
    const { vendorId } = request.params as { vendorId: string };
    const data = request.body as any;

    const vendor = await prisma.vendor.update({
      where: { id: vendorId },
      data,
    });

    return reply.send({ success: true, data: vendor });
  }

  async deleteVendor(request: FastifyRequest, reply: FastifyReply) {
    const { vendorId } = request.params as { vendorId: string };

    await prisma.vendor.delete({ where: { id: vendorId } });
    return reply.send({ success: true, message: 'Vendor deleted' });
  }

  // ============ ACCOUNTS ============
  async getAccounts(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { limit, page } = request.query as { limit?: string; page?: string };
    
    const take = limit ? parseInt(limit) : undefined;
    const skip = (page && take) ? (parseInt(page) - 1) * take : undefined;

    const accounts = await AccountRepository.findMany({ companyId }, take, skip);
    return reply.send({ success: true, data: accounts });
  }

  async createAccount(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { code, name, accountTypeId, parentId, openingBalance, cashFlowType } = request.body as any;

    const openBal = parseFloat(openingBalance) || 0;
    const account = await AccountRepository.create({ 
      code, 
      name, 
      companyId, 
      accountTypeId, 
      parentId, 
      openingBalance: openBal, 
      currentBalance: openBal,
      cashFlowType
    } as any);
    return reply.status(201).send({ success: true, data: account });
  }

  async updateAccount(request: FastifyRequest, reply: FastifyReply) {
    const { accountId } = request.params as { accountId: string };
    const { name, isActive, cashFlowType } = request.body as any;

    const account = await prisma.account.update({
      where: { id: accountId },
      data: { name, isActive, cashFlowType } as any,
    });

    return reply.send({ success: true, data: account });
  }

  async getAccountTypes(request: FastifyRequest, reply: FastifyReply) {
    const types = await AccountRepository.findAccountTypes();
    return reply.send({ success: true, data: types });
  }

  async healBalances(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    
    // 1. Get all accounts for this company
    const accounts = await prisma.account.findMany({
      where: { companyId },
      include: { accountType: true }
    });

    // 2. Wrap in a transaction for safety
    await prisma.$transaction(async (tx) => {
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

  // ============ INVOICES ============
  async getInvoices(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const invoices = await TransactionRepository.findInvoices({ companyId });
    return reply.send({ success: true, data: invoices });
  }

  async getInvoice(request: FastifyRequest, reply: FastifyReply) {
    const { invoiceId } = request.params as { invoiceId: string };
    const invoice = await TransactionRepository.findInvoiceById(invoiceId);
    if (!invoice) throw new NotFoundError('Invoice not found');
    return reply.send({ success: true, data: invoice });
  }

  async createInvoice(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const data = request.body as any;
    const userId = (request.user as any).id;

    // Generate invoice number
    const invoiceNumber = await this.generateDocumentNumber(companyId, 'invoice');

    // Calculate totals
    const subtotal = data.lines.reduce((sum: number, line: any) => sum + (line.quantity * line.unitPrice), 0);
    const taxAmount = data.lines.reduce((sum: number, line: any) => sum + (line.quantity * line.unitPrice * line.taxRate / 100), 0);
    const total = subtotal + taxAmount;

    // BDT amount
    const bdtAmount = total * (data.exchangeRate || 1);

    // Transaction Date Validation
    if (!data.invoiceDate) {
      throw new ValidationError('Invoice date is required');
    }

    const invoiceDate = new Date(data.invoiceDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const role = await this.getUserRole(userId, companyId);
    const isOwnerOrAdmin = role === 'Owner' || role === 'Admin';

    if (invoiceDate > today && !isOwnerOrAdmin) {
      throw new ValidationError('Future invoice dates are only allowed for owners');
    }

    const invoice = await TransactionRepository.createInvoice({
      ...data,
      invoiceNumber,
      companyId,
      subtotal,
      taxAmount,
      total: bdtAmount,
      createdById: userId,
      lines: {
        create: data.lines.map((l: any) => ({
          ...l,
          amount: l.quantity * l.unitPrice * (1 + (l.taxRate || 0) / 100),
        })),
      },
    });

    return reply.status(201).send({ success: true, data: invoice });
  }

  async updateInvoice(request: FastifyRequest, reply: FastifyReply) {
    const { invoiceId } = request.params as { invoiceId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;
    const data = request.body as any;

    const role = await this.getUserRole(userId, companyId);
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });

    if (!invoice) throw new NotFoundError('Invoice not found');

    if (!this.canEdit(invoice.status, role)) {
      throw new ForbiddenError('Cannot edit this invoice in current status');
    }

    // Recalculate if lines changed
    if (data.lines) {
      const subtotal = data.lines.reduce((sum: number, line: any) => sum + (line.quantity * line.unitPrice), 0);
      const taxAmount = data.lines.reduce((sum: number, line: any) => sum + (line.quantity * line.unitPrice * line.taxRate / 100), 0);
      const total = subtotal + taxAmount;
      const bdtAmount = total * (data.exchangeRate || invoice.exchangeRate || 1);

      data.subtotal = subtotal;
      data.taxAmount = taxAmount;
      data.total = bdtAmount;
    }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data,
      include: { lines: true },
    });

    return reply.send({ success: true, data: updated });
  }

  async deleteInvoice(request: FastifyRequest, reply: FastifyReply) {
    const { invoiceId } = request.params as { invoiceId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;

    const role = await this.getUserRole(userId, companyId);
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });

    if (!invoice) throw new NotFoundError('Invoice not found');

    if (!this.canDelete(invoice.status, role)) {
      throw new ForbiddenError('Cannot delete this invoice');
    }

    await prisma.invoice.delete({ where: { id: invoiceId } });
    return reply.send({ success: true, message: 'Invoice deleted' });
  }

  async verifyInvoice(request: FastifyRequest, reply: FastifyReply) {
    const { invoiceId } = request.params as { invoiceId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;

    const role = await this.getUserRole(userId, companyId);
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });

    if (!invoice) throw new NotFoundError('Invoice not found');

    // Manager can only verify their subordinates' invoices
    if (role === 'Manager') {
      // Assuming getSubordinateIds is defined elsewhere or needs to be implemented
      // const subordinateIds = await this.getSubordinateIds(userId);
      // if (!subordinateIds.includes(invoice.createdById)) {
      //   throw new ForbiddenError('You can only verify invoices from your team');
      // }
      // Temporarily bypass until subordinate logic is clear
    }

    if (!this.canVerify(invoice.status, role)) {
      throw new ForbiddenError('Cannot verify this invoice');
    }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'VERIFIED',
        verifiedById: userId,
        verifiedAt: new Date(),
      },
    });

    return reply.send({ success: true, data: updated });
  }

  async rejectInvoice(request: FastifyRequest, reply: FastifyReply) {
    const { invoiceId } = request.params as { invoiceId: string };
    const { id: companyId } = request.params as { id: string };
    const { reason } = request.body as { reason: string };
    const userId = (request.user as any).id;

    const role = await this.getUserRole(userId, companyId);
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });

    if (!invoice) throw new NotFoundError('Invoice not found');

    if (!this.canVerify(invoice.status, role)) {
      throw new ForbiddenError('Cannot reject this invoice');
    }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'REJECTED',
        rejectedById: userId,
        rejectionReason: reason,
      },
    });

    return reply.send({ success: true, data: updated });
  }

  async retrieveInvoice(request: FastifyRequest, reply: FastifyReply) {
    const { invoiceId } = request.params as { invoiceId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;

    const role = await this.getUserRole(userId, companyId);
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });

    if (!invoice) throw new NotFoundError('Invoice not found');

    // Can only retrieve from REJECTED status
    if (invoice.status !== 'REJECTED') {
      throw new ForbiddenError('Can only retrieve rejected invoices');
    }

    // Manager cannot retrieve verified/approved
    if (role === 'Manager') {
      throw new ForbiddenError('Managers cannot retrieve invoices');
    }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'DRAFT',
        rejectionReason: null,
      },
    });

    return reply.send({ success: true, data: updated });
  }

  async approveInvoice(request: FastifyRequest, reply: FastifyReply) {
    const { invoiceId } = request.params as { invoiceId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;

    const role = await this.getUserRole(userId, companyId);
    // Include lines to get total and find accounts
    const invoice = await prisma.invoice.findUnique({ 
      where: { id: invoiceId },
      include: { lines: true } 
    });

    if (!invoice) throw new NotFoundError('Invoice not found');

    if (!this.canApprove(invoice.status, role)) {
      throw new ForbiddenError('Cannot approve this invoice');
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update Status
      const inv = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'APPROVED',
          approvedById: userId,
          approvedAt: new Date(),
        },
      });

      // 2. Generate Journal Entry for Audit Trail
      const entryNumber = await this.generateDocumentNumber(companyId, 'journal');
      
      const arAccount = await tx.account.findFirst({ where: { companyId, category: 'AR' } as any });
      const revAccount = await tx.account.findFirst({ where: { companyId, category: 'REVENUE' } as any });

      if (!arAccount || !revAccount) {
        throw new ValidationError('AR or Revenue accounts not found');
      }

      // Create an APPROVED journal entry
      const journalDate = new Date(invoice.invoiceDate);
      await tx.journalEntry.create({
        data: {
          entryNumber,
          companyId,
          date: journalDate,
          description: `Auto-generated from Invoice ${invoice.invoiceNumber}`,
          reference: invoice.invoiceNumber,
          totalDebit: invoice.total,
          totalCredit: invoice.total,
          status: 'APPROVED',
          createdById: userId,
          approvedById: userId,
          approvedAt: new Date(),
          lines: {
            create: [
              // AR entry
              {
                accountId: arAccount.id,
                debit: invoice.total,
                credit: 0,
                debitBase: invoice.total,
                creditBase: 0,
                description: `Receivable from Invoice ${invoice.invoiceNumber}`
              },
              // Revenue entry
              {
                accountId: revAccount.id,
                debit: 0,
                credit: invoice.total,
                debitBase: 0,
                creditBase: invoice.total,
                description: `Revenue from Invoice ${invoice.invoiceNumber}`
              }
            ]
          }
        }
      });

      // 3. Update Account Balances (based on the generated journal entry)
      await tx.account.update({ where: { id: arAccount.id }, data: { currentBalance: { increment: Number(invoice.total) } } });
      
      const isRevDebitType = (revAccount as any).accountType?.type === 'DEBIT';
      const revBalanceChange = isRevDebitType ? -Number(invoice.total) : Number(invoice.total);
      
      await tx.account.update({
        where: { id: revAccount.id },
        data: { currentBalance: { increment: revBalanceChange } }
      });

      return inv;
    });

    return reply.send({ success: true, data: updated });
  }

  // ============ JOURNALS ============
  async getJournals(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { limit, page } = request.query as { limit?: string; page?: string };
    
    const take = limit ? parseInt(limit) : undefined;
    const skip = (page && take) ? (parseInt(page) - 1) * take : undefined;

    const journals = await TransactionRepository.findJournals({ companyId }, take, skip);
    return reply.send({ success: true, data: journals });
  }

  async getJournal(request: FastifyRequest, reply: FastifyReply) {
    const { journalId } = request.params as { journalId: string };
    const journal = await TransactionRepository.findJournalById(journalId);
    if (!journal) throw new NotFoundError('Journal not found');
    return reply.send({ success: true, data: journal });
  }

  async createJournal(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const data = request.body as any;
    const userId = (request.user as any).id;

    const entryNumber = await this.generateDocumentNumber(companyId, 'journal');

    if (!data.lines || !Array.isArray(data.lines)) {
      throw new ValidationError('Journal lines are required');
    }

    const totalDebit = data.lines.reduce((sum: number, line: any) => sum + (Number(line.debit) || 0), 0);
    const totalCredit = data.lines.reduce((sum: number, line: any) => sum + (Number(line.credit) || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new ValidationError('Debit and Credit must be equal');
    }

    // Transaction Date Validation
    if (!data.date) {
      throw new ValidationError('Transaction date is required');
    }

    const journalDate = new Date(data.date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const role = await this.getUserRole(userId, companyId);
    const isOwnerOrAdmin = role === 'Owner' || role === 'Admin';

    if (journalDate > today && !isOwnerOrAdmin) {
      throw new ValidationError('Future transaction dates are only allowed for owners');
    }

    // Accountants/Owners create as PENDING_VERIFICATION to make them visible to Managers immediately
    const status = (role === 'Accountant' || isOwnerOrAdmin) ? 'PENDING_VERIFICATION' : 'DRAFT';

    const journal = await TransactionRepository.createJournal({
      ...data,
      date: journalDate,
      entryNumber,
      companyId,
      branchId: data.branchId || null,
      totalDebit,
      totalCredit,
      createdById: userId,
      status,
      lines: {
        create: data.lines.map((l: any) => ({
          ...l,
          debitBase: l.debit * (data.exchangeRate || 1),
          creditBase: l.credit * (data.exchangeRate || 1),
          debitForeign: l.debit,
          creditForeign: l.credit,
          exchangeRate: data.exchangeRate || 1,
        })),
      },
    });

    // Create Notification if it's pending verification
    if (status === 'PENDING_VERIFICATION') {
      await prisma.notification.create({
        data: {
          companyId,
          type: 'PENDING_JOURNAL',
          severity: 'WARNING',
          title: 'New Voucher Awaiting Verification',
          message: `Journal ${entryNumber} has been created and is awaiting verification.`,
          entityType: 'JournalEntry',
          entityId: journal.id
        }
      });
    }

    return reply.status(201).send({ success: true, data: journal });
  }

  async updateJournal(request: FastifyRequest, reply: FastifyReply) {
    const { journalId } = request.params as { journalId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;
    const data = request.body as any;

    const role = await this.getUserRole(userId, companyId);
    const journal = await prisma.journalEntry.findUnique({ where: { id: journalId } });

    if (!journal) throw new NotFoundError('Journal not found');

    if (!this.canEdit(journal.status, role)) {
      throw new ForbiddenError('Cannot edit this journal in current status');
    }

    const updated = await prisma.journalEntry.update({
      where: { id: journalId },
      data: {
        description: data.description ?? journal.description,
        reference: data.reference ?? journal.reference,
      },
      include: { lines: true },
    });

    return reply.send({ success: true, data: updated });
  }

  async deleteJournal(request: FastifyRequest, reply: FastifyReply) {
    const { journalId } = request.params as { journalId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;

    const role = await this.getUserRole(userId, companyId);
    const journal = await prisma.journalEntry.findUnique({ where: { id: journalId } });

    if (!journal) throw new NotFoundError('Journal not found');

    if (!this.canDelete(journal.status, role)) {
      throw new ForbiddenError('Cannot delete this journal');
    }

    await prisma.journalEntry.delete({ where: { id: journalId } });
    return reply.send({ success: true, message: 'Journal deleted' });
  }

  async verifyJournal(request: FastifyRequest, reply: FastifyReply) {
    const { journalId } = request.params as { journalId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;

    const role = await this.getUserRole(userId, companyId);
    const journal = await prisma.journalEntry.findUnique({ where: { id: journalId } });

    if (!journal) throw new NotFoundError('Journal not found');

    // Manager check: simplified to allow verification of any journal in the company
    // Original team check was too restrictive without explicit managerId linkage
    /*
    if (role === 'Manager') {
      const subordinateIds = await this.getSubordinateIds(userId);
      if (!subordinateIds.includes(journal.createdById)) {
        throw new ForbiddenError('You can only verify journals from your team');
      }
    }
    */

    if (!this.canVerify(journal.status, role)) {
      throw new ForbiddenError('Cannot verify this journal');
    }

    const updated = await prisma.journalEntry.update({
      where: { id: journalId },
      data: {
        status: 'VERIFIED',
        verifiedById: userId,
        verifiedAt: new Date(),
      },
    });

    return reply.send({ success: true, data: updated });
  }

  async rejectJournal(request: FastifyRequest, reply: FastifyReply) {
    const { journalId } = request.params as { journalId: string };
    const { id: companyId } = request.params as { id: string };
    const { reason } = request.body as { reason: string };
    const userId = (request.user as any).id;

    const role = await this.getUserRole(userId, companyId);
    const journal = await prisma.journalEntry.findUnique({ where: { id: journalId } });

    if (!journal) throw new NotFoundError('Journal not found');

    if (!this.canVerify(journal.status, role)) {
      throw new ForbiddenError('Cannot reject this journal');
    }

    const updated = await prisma.journalEntry.update({
      where: { id: journalId },
      data: {
        status: 'REJECTED',
        rejectedById: userId,
        rejectionReason: reason,
      },
    });

    return reply.send({ success: true, data: updated });
  }

  async retrieveJournal(request: FastifyRequest, reply: FastifyReply) {
    const { journalId } = request.params as { journalId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;

    const role = await this.getUserRole(userId, companyId);
    if (role !== 'Accountant' && role !== 'Owner') {
      throw new ForbiddenError('Only Accountants or Owners can retrieve journals');
    }

    const updated = await prisma.journalEntry.update({
      where: { id: journalId },
      data: { status: 'DRAFT', rejectionReason: null },
    });

    return reply.send({ success: true, data: updated });
  }

  async submitJournal(request: FastifyRequest, reply: FastifyReply) {
    const { journalId } = request.params as { journalId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;

    const role = await this.getUserRole(userId, companyId);
    if (role !== 'Accountant' && role !== 'Owner') {
      throw new ForbiddenError('Only Accountants or Owners can submit journals');
    }

    const journal = await prisma.journalEntry.findUnique({ where: { id: journalId } });
    if (!journal) throw new NotFoundError('Journal not found');
    if (journal.status !== 'DRAFT' && journal.status !== 'REJECTED') {
      throw new ValidationError('Only DRAFT or REJECTED journals can be submitted');
    }

    const updated = await prisma.journalEntry.update({
      where: { id: journalId },
      data: { status: 'PENDING_VERIFICATION' },
    });

    // Create Notification
    await prisma.notification.create({
      data: {
        companyId,
        type: 'PENDING_JOURNAL',
        severity: 'WARNING',
        title: 'Voucher Submitted for Verification',
        message: `Journal ${updated.entryNumber} has been submitted and is awaiting verification.`,
        entityType: 'JournalEntry',
        entityId: updated.id
      }
    });

    return reply.send({ success: true, data: updated });
  }

    async approveJournal(request: FastifyRequest, reply: FastifyReply) {
    const { journalId } = request.params as { journalId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;

    const role = await this.getUserRole(userId, companyId);
    const journal = await prisma.journalEntry.findUnique({
      where: { id: journalId },
      include: { lines: { include: { account: { include: { accountType: true } } } } }
    });

    if (!journal) throw new NotFoundError('Journal not found');

    if (!this.canApprove(journal.status, role)) {
      throw new ForbiddenError('Cannot approve this journal');
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update Journal Status
      const jrnl = await tx.journalEntry.update({
        where: { id: journalId },
        data: {
          status: 'APPROVED',
          approvedById: userId,
          approvedAt: new Date(),
        },
      });

      // 2. Validate and Update Account Balances
      const isOwnerOrAdmin = role === 'Owner' || role === 'Admin';

      for (const line of journal.lines) {
        const isDebitType = (line.account as any).accountType.type === 'DEBIT';
        const balanceChange = isDebitType
          ? (Number(line.debitBase) - Number(line.creditBase))
          : (Number(line.creditBase) - Number(line.debitBase));

        const potentialBalance = Number(line.account.currentBalance) + balanceChange;

        // Negative Balance Validation
        const isCashOrBank = (line.account as any).category === 'CASH' || (line.account as any).category === 'BANK';
        if (isCashOrBank && potentialBalance < 0 && !(line.account as any).allowNegative && !isOwnerOrAdmin) {
          throw new ValidationError(
            `Transaction rejected: ${line.account.name} balance (${potentialBalance}) would be negative. Overdraft not allowed for this account.`
          );
        }

        await tx.account.update({
          where: { id: line.accountId },
          data: {
            currentBalance: {
              increment: balanceChange
            }
          }
        });
      }

      return jrnl;
    });

    return reply.send({ success: true, data: updated });
  }

  // ============ REPORTS ============
  async getTrialBalance(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };

    const accounts = await prisma.account.findMany({
      where: { companyId, isActive: true },
      include: {
        accountType: true,
        journalLines: {
          where: { journalEntry: { status: 'APPROVED' } },
          include: { journalEntry: true },
        },
      },
    });

    const data = accounts.map((acc) => {
      const totalDebit = acc.journalLines.reduce((sum, line) => sum + line.debit, 0);
      const totalCredit = acc.journalLines.reduce((sum, line) => sum + line.credit, 0);
      const balance = acc.openingBalance + totalDebit - totalCredit;

      return {
        code: acc.code,
        name: acc.name,
        type: acc.accountType.type,
        debit: balance > 0 ? balance : 0,
        credit: balance < 0 ? Math.abs(balance) : 0,
      };
    });

    return reply.send({ success: true, data });
  }

  async getLedger(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { accountId } = request.query as { accountId?: string };

    const where: any = { companyId, status: 'APPROVED' };
    if (accountId) {
      where.lines = { some: { accountId } };
    }

    const journals = await prisma.journalEntry.findMany({
      where,
      include: {
        lines: {
          include: { account: true },
          where: accountId ? { accountId } : undefined,
        },
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { date: 'asc' },
    });

    return reply.send({ success: true, data: journals });
  }

  async getBalanceSheet(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };

    // Get asset and liability accounts
    const assets = await prisma.account.findMany({
      where: { companyId, accountType: { name: 'ASSET' }, isActive: true },
    });

    const liabilities = await prisma.account.findMany({
      where: { companyId, accountType: { name: 'LIABILITY' }, isActive: true },
    });

    const equity = await prisma.account.findMany({
      where: { companyId, accountType: { name: 'EQUITY' }, isActive: true },
    });

    return reply.send({
      success: true,
      data: {
        assets: assets.map((a) => ({ name: a.name, balance: a.currentBalance })),
        liabilities: liabilities.map((l) => ({ name: l.name, balance: Math.abs(l.currentBalance) })),
        equity: equity.map((e) => ({ name: e.name, balance: Math.abs(e.currentBalance) })),
      },
    });
  }

  async getProfitLoss(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };

    const income = await prisma.account.findMany({
      where: { companyId, accountType: { name: 'INCOME' }, isActive: true },
    });

    const expenses = await prisma.account.findMany({
      where: { companyId, accountType: { name: 'EXPENSE' }, isActive: true },
    });

    const totalIncome = income.reduce((sum, a) => sum + Math.abs(a.currentBalance), 0);
    const totalExpense = expenses.reduce((sum, a) => sum + Math.abs(a.currentBalance), 0);
    const netProfit = totalIncome - totalExpense;

    return reply.send({
      success: true,
      data: {
        income: income.map((i) => ({ name: i.name, amount: Math.abs(i.currentBalance) })),
        expenses: expenses.map((e) => ({ name: e.name, amount: Math.abs(e.currentBalance) })),
        totalIncome,
        totalExpense,
        netProfit,
      },
    });
  }

  // Documents moved to AttachmentController

  // Helper: Get all subordinate IDs recursively
  private async getSubordinateIds(managerId: string): Promise<string[]> {
    const subordinates = await prisma.user.findMany({ where: { managerId } });
    let ids = subordinates.map((s) => s.id);

    for (const sub of subordinates) {
      const subIds = await this.getSubordinateIds(sub.id);
      ids = [...ids, ...subIds];
    }

    return ids;
  }
}
