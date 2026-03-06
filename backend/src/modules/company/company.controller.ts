import { FastifyRequest, FastifyReply } from 'fastify';
import { NotificationController } from './notification.controller';
import prisma from '../../config/database';
import { AccountRepository } from '../../repositories/AccountRepository';
import { TransactionRepository } from '../../repositories/TransactionRepository';
import { CustomerRepository } from '../../repositories/CustomerRepository';
import { VendorRepository } from '../../repositories/VendorRepository';
import { PurchaseOrderRepository } from '../../repositories/PurchaseOrderRepository';
import { SYSTEM_MODE } from '../../lib/systemMode';
import { demoCompany } from '../../lib/mockData/company';
import { NotFoundError, ForbiddenError, ValidationError } from '../../middleware/errorHandler';
import { SequenceService } from './sequence.service';
import path from 'path';
import fs from 'fs';

export class CompanyController {
  // Robust sequence-based document numbers
  private async generateDocumentNumber(
    companyId: string, 
    type: 'invoice' | 'journal' | 'po' | 'pi' | 'lc' | 'customer' | 'vendor' | 'product'
  ): Promise<string> {
    return SequenceService.generateDocumentNumber(companyId, type);
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

    if (isOwner?.user.userRoles.some((ur: any) => ur.role.name === 'Owner')) {
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
    const { 
      name, email, phone, address, city, country,
      contactPerson, tinVat, openingBalance, balanceType, creditLimit, preferredCurrency 
    } = request.body as any;

    const code = await this.generateDocumentNumber(companyId, 'customer');
    const customer = await CustomerRepository.create({ 
      code, name, companyId, email, phone, address, city, country,
      contactPerson, tinVat, 
      openingBalance: Number(openingBalance || 0), 
      balanceType, 
      creditLimit: Number(creditLimit || 0), 
      preferredCurrency: preferredCurrency || 'BDT'
    });

    // Log Activity
    await NotificationController.logActivity({
      companyId,
      entityType: 'customer',
      entityId: customer.id,
      action: 'CREATED',
      performedById: (request.user as any).id,
      metadata: { docNumber: code, name: customer.name }
    });

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
    const { 
      name, email, phone, address, city, country,
      contactPerson, tinVat, openingBalance, balanceType, creditLimit, preferredCurrency
    } = request.body as any;

    const code = await this.generateDocumentNumber(companyId, 'vendor');
    const vendor = await VendorRepository.create({ 
      code, name, companyId, email, phone, address, city, country,
      contactPerson, tinVat, openingBalance, balanceType, creditLimit, preferredCurrency
    });

    // Log Activity
    await NotificationController.logActivity({
      companyId,
      entityType: 'vendor',
      entityId: vendor.id,
      action: 'CREATED',
      performedById: (request.user as any).id,
      metadata: { docNumber: code, name: vendor.name }
    });

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

  // ============ PURCHASE ORDERS ============
  async getPurchaseOrders(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const pos = await PurchaseOrderRepository.findMany({ companyId });
    return reply.send({ success: true, data: pos });
  }

  async createPurchaseOrder(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { 
      supplierId, lcId, poDate, expectedDeliveryDate, 
      currency, exchangeRate, totalForeign, totalBDT, 
      status, lines, createdById 
    } = request.body as any;

    const poNumber = await this.generateDocumentNumber(companyId, 'po');
    
    const po = await PurchaseOrderRepository.create({
      poNumber,
      companyId,
      supplierId,
      lcId,
      poDate: poDate ? new Date(poDate) : undefined,
      expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
      currency,
      exchangeRate,
      totalForeign,
      totalBDT,
      status: status || 'DRAFT',
      createdById,
      lines
    });

    // Log Activity
    await NotificationController.logActivity({
      companyId,
      entityType: 'purchase_order',
      entityId: po.id,
      action: 'CREATED',
      performedById: (request.user as any).id,
      metadata: { docNumber: poNumber }
    });

    return reply.status(201).send({ success: true, data: po });
  }

  async deletePurchaseOrder(request: FastifyRequest, reply: FastifyReply) {
    const { poId } = request.params as { poId: string };
    await PurchaseOrderRepository.delete(poId);
    return reply.send({ success: true, message: 'Purchase Order deleted' });
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

    let accountCode = code;
    
    // If no code provided, auto-generate based on account type
    if (!accountCode) {
      const accountType = await prisma.accountType.findUnique({ where: { id: accountTypeId } });
      
      if (parentId) {
        // Get parent account and derive code from its serial
        const parent = await prisma.account.findUnique({ where: { id: parentId } });
        if (parent) {
          // Get count of existing children under this parent
          const siblingCount = await prisma.account.count({ where: { parentId } });
          const parentPrefix = parent.code.substring(0, parent.code.length - 2);
          accountCode = `${parentPrefix}${String(siblingCount + 1).padStart(2, '0')}`;
        }
      } else if (accountType) {
        // Generate code based on account type
        const typeCodeMap: Record<string, { prefix: string; min: number; max: number }> = {
          'ASSET': { prefix: 'A-1', min: 100, max: 999 },
          'LIABILITY': { prefix: 'L-1', min: 100, max: 999 },
          'EQUITY': { prefix: 'E-1', min: 100, max: 999 },
          'INCOME': { prefix: 'I-1', min: 100, max: 999 },
          'EXPENSE': { prefix: 'X-1', min: 100, max: 999 },
        };
        
        const config = typeCodeMap[accountType.name];
        if (config) {
          // Find next available code in range
          const existing = await prisma.account.findMany({
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
    const account = await AccountRepository.create({ 
      code: accountCode, 
      name, 
      companyId, 
      accountTypeId, 
      parentId: parentId || null, 
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
    await prisma.$transaction(async (tx: any) => {
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
    const { type } = request.query as { type?: string };
    
    const where: any = { companyId };
    if (type) where.type = type.toUpperCase();

    const invoices = await TransactionRepository.findInvoices(where);
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
      invoiceNumber,
      companyId,
      customerId: data.customerId || null,
      vendorId: data.vendorId || null,
      type: data.type || 'SALES',
      currency: data.currency || 'BDT',
      exchangeRate: data.exchangeRate || 1,
      invoiceDate: invoiceDate,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      description: data.description,
      subtotal,
      taxAmount,
      total: bdtAmount,
      createdById: userId,
      lines: {
        create: data.lines.map((l: any) => ({
          productId: l.productId || null,
          description: l.description,
          quantity: Number(l.quantity || 1),
          unitPrice: Number(l.unitPrice || 0),
          taxRate: Number(l.taxRate || 0),
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
      data: {
        ...data,
        customerId: data.customerId || undefined,
        vendorId: data.vendorId || undefined,
        lines: data.lines ? {
          deleteMany: {},
          create: data.lines.map((l: any) => ({
            productId: l.productId || null,
            description: l.description,
            quantity: Number(l.quantity || 1),
            unitPrice: Number(l.unitPrice || 0),
            taxRate: Number(l.taxRate || 0),
            amount: l.quantity * l.unitPrice * (1 + (l.taxRate || 0) / 100),
          })),
        } : undefined,
      },
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

    const updated = await prisma.$transaction(async (tx: any) => {
      // 1. Update Status
      const inv = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'APPROVED',
          approvedById: userId,
          approvedAt: new Date(),
        },
      });

      // 2. Generate Multi-Line Journal Entry (Split-Payment Aware)
      const entryNumber = await this.generateDocumentNumber(companyId, 'journal');
      
      const revAccount = await tx.account.findFirst({ where: { companyId, category: 'REVENUE' } as any });
      if (!revAccount) throw new ValidationError('Revenue account not found in Chart of Accounts');

      const invoiceTotal = Number(invoice.total);
      const journalDate = new Date(invoice.invoiceDate);
      const splits = (invoice as any).paymentSplits as {
        cash?: number;
        bank?: number;
        ar?: number;
        bankAccountId?: string;
      } | null;

      const cashAmount  = Number(splits?.cash  || 0);
      const bankAmount  = Number(splits?.bank  || 0);
      // AR receives whatever is not covered by cash/bank
      const arAmount    = Number(splits?.ar    || (invoiceTotal - cashAmount - bankAmount));

      // Build debit lines dynamically based on split
      const debitLines: any[] = [];

      // Cash portion
      if (cashAmount > 0) {
        const cashAccount = await tx.account.findFirst({
          where: { companyId, category: 'CASH' } as any
        });
        if (!cashAccount) throw new ValidationError('Cash account not found. Check Chart of Accounts.');
        debitLines.push({
          accountId: cashAccount.id,
          debit: cashAmount,
          credit: 0,
          debitBase: cashAmount,
          creditBase: 0,
          description: `Cash received – Invoice ${invoice.invoiceNumber}`,
        });
        await tx.account.update({
          where: { id: cashAccount.id },
          data: { currentBalance: { increment: cashAmount } },
        });
      }

      // Bank portion
      if (bankAmount > 0) {
        const bankAccountId = splits?.bankAccountId;
        const bankAccount = bankAccountId
          ? await tx.account.findUnique({ where: { id: bankAccountId } })
          : await tx.account.findFirst({ where: { companyId, category: 'BANK' } as any });
        if (!bankAccount) throw new ValidationError('Bank account not found. Check Chart of Accounts or split settings.');
        debitLines.push({
          accountId: bankAccount.id,
          debit: bankAmount,
          credit: 0,
          debitBase: bankAmount,
          creditBase: 0,
          description: `Bank received – Invoice ${invoice.invoiceNumber}`,
        });
        await tx.account.update({
          where: { id: bankAccount.id },
          data: { currentBalance: { increment: bankAmount } },
        });
      }

      // AR portion (remaining balance)
      if (arAmount > 0) {
        const arAccount = await tx.account.findFirst({ where: { companyId, category: 'AR' } as any });
        if (!arAccount) throw new ValidationError('Accounts Receivable account not found.');
        debitLines.push({
          accountId: arAccount.id,
          debit: arAmount,
          credit: 0,
          debitBase: arAmount,
          creditBase: 0,
          description: `Receivable – Invoice ${invoice.invoiceNumber}`,
        });
        await tx.account.update({
          where: { id: arAccount.id },
          data: { currentBalance: { increment: arAmount } },
        });
      }

      // If no split configured at all, fall back to full AR
      if (debitLines.length === 0) {
        const arAccount = await tx.account.findFirst({ where: { companyId, category: 'AR' } as any });
        if (!arAccount) throw new ValidationError('AR account not found.');
        debitLines.push({
          accountId: arAccount.id,
          debit: invoiceTotal,
          credit: 0,
          debitBase: invoiceTotal,
          creditBase: 0,
          description: `Receivable – Invoice ${invoice.invoiceNumber}`,
        });
        await tx.account.update({
          where: { id: arAccount.id },
          data: { currentBalance: { increment: invoiceTotal } },
        });
      }

      // Credit line: Revenue
      const creditLine = {
        accountId: revAccount.id,
        debit: 0,
        credit: invoiceTotal,
        debitBase: 0,
        creditBase: invoiceTotal,
        description: `Revenue – Invoice ${invoice.invoiceNumber}`,
      };

      const isRevDebitType = (revAccount as any).accountType?.type === 'DEBIT';
      const revBalanceChange = isRevDebitType ? -invoiceTotal : invoiceTotal;
      await tx.account.update({
        where: { id: revAccount.id },
        data: { currentBalance: { increment: revBalanceChange } },
      });

      // Create the Journal Entry with all debit + one credit line
      await tx.journalEntry.create({
        data: {
          entryNumber,
          companyId,
          date: journalDate,
          description: `Auto-journal: Invoice ${invoice.invoiceNumber}`,
          reference: invoice.invoiceNumber,
          totalDebit: invoiceTotal,
          totalCredit: invoiceTotal,
          status: 'APPROVED',
          createdById: userId,
          approvedById: userId,
          approvedAt: new Date(),
          lines: { create: [...debitLines, creditLine] },
        },
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

    // Log Structured Activity
    await NotificationController.logActivity({
      companyId,
      entityType: 'journal',
      entityId: journal.id,
      action: 'CREATED',
      performedById: userId,
      branchId: data.branchId || null,
      metadata: { docNumber: entryNumber }
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

    // Log Structured Activity
    await NotificationController.logActivity({
      companyId: journal.companyId,
      entityType: 'journal',
      entityId: journal.id,
      action: 'VERIFIED',
      performedById: userId,
      branchId: journal.branchId,
      metadata: { docNumber: journal.entryNumber }
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

    // Log Structured Activity
    await NotificationController.logActivity({
      companyId: journal.companyId,
      entityType: 'journal',
      entityId: journal.id,
      action: 'REJECTED_MANAGER',
      performedById: userId,
      targetUserId: journal.createdById,
      branchId: journal.branchId,
      metadata: { docNumber: journal.entryNumber, reason }
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

    const updated = await prisma.$transaction(async (tx: any) => {
      // 1. Update Journal Status
      const jrnl = await tx.journalEntry.update({
        where: { id: journalId },
        data: {
          status: 'APPROVED',
          approvedById: userId,
          approvedAt: new Date(),
        },
      });

      // Log Structured Activity (Outside transaction or inside, depending on preference, inside here for consistency)
      // Actually best practice to do it inside and wait for commit, but for now we follow the pattern
      await NotificationController.logActivity({
        companyId: journal.companyId,
        entityType: 'journal',
        entityId: journal.id,
        action: 'APPROVED',
        performedById: userId,
        branchId: journal.branchId,
        metadata: { docNumber: journal.entryNumber }
      });

      // 2. Validate and Update Account Balances
      const isOwnerOrAdmin = role === 'Owner' || role === 'Admin';

      for (const line of journal.lines) {
        const isDebitType = (line.account as any).accountType.type === 'DEBIT';
        const balanceChange = isDebitType
          ? (Number(line.debitBase) - Number(line.creditBase))
          : (Number(line.creditBase) - Number(line.debitBase));

        const potentialBalance = Number(line.account.currentBalance) + balanceChange;

        // Negative Balance Validation (Global Guard)
        if (potentialBalance < 0 && !(line.account as any).allowNegative && !isOwnerOrAdmin) {
          throw new ValidationError(
            `Transaction rejected: ${line.account.name} balance (${potentialBalance.toLocaleString()}) would be negative. Negative balance (overdraft) is not permitted for this account.`
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

    const data = accounts.map((acc: any) => {
      const totalDebit = acc.journalLines.reduce((sum: number, line: any) => sum + line.debit, 0);
      const totalCredit = acc.journalLines.reduce((sum: number, line: any) => sum + line.credit, 0);
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
        assets: assets.map((a: any) => ({ name: a.name, balance: a.currentBalance })),
        liabilities: liabilities.map((l: any) => ({ name: l.name, balance: Math.abs(l.currentBalance) })),
        equity: equity.map((e: any) => ({ name: e.name, balance: Math.abs(e.currentBalance) })),
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

    const totalIncome = income.reduce((sum: number, a: any) => sum + Math.abs(a.currentBalance), 0);
    const totalExpense = expenses.reduce((sum: number, a: any) => sum + Math.abs(a.currentBalance), 0);
    const netProfit = totalIncome - totalExpense;

    return reply.send({
      success: true,
      data: {
        income: income.map((i: any) => ({ name: i.name, amount: Math.abs(i.currentBalance) })),
        expenses: expenses.map((e: any) => ({ name: e.name, amount: Math.abs(e.currentBalance) })),
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
    let ids = subordinates.map((s: any) => s.id);

    for (const sub of subordinates) {
      const subIds = await this.getSubordinateIds(sub.id);
      ids = [...ids, ...subIds];
    }

    return ids;
  }

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
        return reply.status(400).send({ success: false, error: 'First name and last name are required' });
      }

      const count = await prisma.employee.count({ where: { companyId } });
      const employeeCode = `EMP-${String(count + 1).padStart(4, '0')}`;

      const employee = await prisma.employee.create({
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

      return reply.send({ success: true, data: employee });
    } catch (error: any) {
      console.error('Error creating employee:', error);
      return reply.status(500).send({ success: false, error: error.message || 'Internal server error' });
    }
  }

  async updateEmployee(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, employeeId } = request.params as { id: string; employeeId: string };
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

  // Employee Advances
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
    const { advanceId } = request.params as { advanceId: string };
    const data = request.body as any;

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
    const { advanceId } = request.params as { advanceId: string };

    await prisma.employeeAdvance.delete({ where: { id: advanceId } });

    return reply.send({ success: true });
  }

  async approveEmployeeAdvance(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: companyId, advanceId } = request.params as { id: string; advanceId: string };
      const userId = (request.user as any).id;

      const advance = await prisma.employeeAdvance.findUnique({
        where: { id: advanceId },
        include: { employee: true },
      });

      if (!advance) {
        throw new NotFoundError('Advance not found');
      }

      // Generate journal entry
      const entryNumber = await this.generateDocumentNumber(companyId, 'journal');
      
      // Get default accounts
      const cashAccount = await prisma.account.findFirst({
        where: { companyId, code: { endsWith: '1000' }, isActive: true },
      });
      
      const advanceAccount = await prisma.account.findFirst({
        where: { companyId, name: { contains: 'Advance', mode: 'insensitive' }, isActive: true },
      });

      const employeePayableAccount = await prisma.account.findFirst({
        where: { companyId, name: { contains: 'Employee', mode: 'insensitive' }, isActive: true },
      });

      const debitAccountId = employeePayableAccount?.id || advanceAccount?.id || cashAccount?.id;
      const creditAccountId = advance.accountId || cashAccount?.id;

      if (!debitAccountId || !creditAccountId) {
        throw new Error('Required accounts not found. Please configure cash/employee accounts.');
      }

      // Create journal entry
      const journal = await prisma.journalEntry.create({
        data: {
          entryNumber,
          date: advance.date,
          description: `Advance for ${advance.employee.firstName} ${advance.employee.lastName} - ${advance.purpose || ''}`,
          companyId,
          createdById: userId,
          status: 'APPROVED',
          lines: {
            create: [
              {
                accountId: debitAccountId,
                debit: advance.amount,
                credit: 0,
              },
              {
                accountId: creditAccountId,
                debit: 0,
                credit: advance.amount,
              },
            ],
          },
        },
        include: { lines: { include: { account: true } } },
      });

      // Update advance status
      await prisma.employeeAdvance.update({
        where: { id: advanceId },
        data: { status: 'APPROVED', journalEntryId: journal.id },
      });

      return reply.send({ success: true, data: { advance, journal } });
    } catch (error: any) {
      console.error('Error approving employee advance:', error);
      return reply.status(500).send({ success: false, error: error.message || 'Internal server error' });
    }
  }

  // Employee Loans
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
    const { employeeId, principalAmount, interestRate, installments, startDate, purpose } = request.body as any;

    const principal = parseFloat(principalAmount);
    const rate = parseFloat(interestRate || 0);
    const interestAmount = (principal * rate * (installments / 12)) / 100;
    const totalAmount = principal + interestAmount;

    const loan = await prisma.employeeLoan.create({
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

  async updateEmployeeLoan(request: FastifyRequest, reply: FastifyReply) {
    const { loanId } = request.params as { loanId: string };
    const data = request.body as any;

    if (data.principalAmount) {
      const principal = parseFloat(data.principalAmount);
      const rate = parseFloat(data.interestRate || 0);
      const installments = parseInt(data.installments || 1);
      const interestAmount = (principal * rate * (installments / 12)) / 100;
      data.interestAmount = interestAmount;
      data.totalAmount = principal + interestAmount;
    }

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

  async approveEmployeeLoan(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: companyId, loanId } = request.params as { id: string; loanId: string };
      const userId = (request.user as any).id;

      const loan = await prisma.employeeLoan.findUnique({
        where: { id: loanId },
        include: { employee: true },
      });

      if (!loan) {
        throw new NotFoundError('Loan not found');
      }

      // Generate journal entry for loan disbursement
      const entryNumber = await this.generateDocumentNumber(companyId, 'journal');
      
      const cashAccount = await prisma.account.findFirst({
        where: { companyId, code: { endsWith: '1000' }, isActive: true },
      });
      
      const loanAccount = await prisma.account.findFirst({
        where: { companyId, code: 'A-1381', isActive: true },
      });
      
      const employeePayableAccount = await prisma.account.findFirst({
        where: { companyId, name: { contains: 'Employee', mode: 'insensitive' }, isActive: true },
      });

      const debitAccountId = employeePayableAccount?.id || loanAccount?.id || cashAccount?.id;
      const creditAccountId = loanAccount?.id || cashAccount?.id;

      if (!debitAccountId || !creditAccountId) {
        throw new Error('Required accounts not found. Please configure loan/cash accounts.');
      }

      // Create journal entry for loan disbursement
      await prisma.journalEntry.create({
        data: {
          entryNumber,
          date: loan.startDate,
          description: `Employee Loan for ${loan.employee.firstName} ${loan.employee.lastName} - ${loan.purpose || ''}`,
          companyId,
          createdById: userId,
          status: 'APPROVED',
          lines: {
            create: [
              {
                accountId: debitAccountId,
                debit: loan.principalAmount,
                credit: 0,
              },
              {
                accountId: creditAccountId,
                debit: 0,
                credit: loan.principalAmount,
              },
            ],
          },
        },
      });

      await prisma.employeeLoan.update({
        where: { id: loanId },
        data: { status: 'ACTIVE' },
      });

      return reply.send({ success: true });
    } catch (error: any) {
      console.error('Error approving employee loan:', error);
      return reply.status(500).send({ success: false, error: error.message || 'Internal server error' });
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
    const { id: companyId, loanId } = request.params as { id: string; loanId: string };
    const { amount, principalPaid, interestPaid, paymentDate } = request.body as any;

    const repayment = await prisma.employeeLoanRepayment.create({
      data: {
        loanId,
        amount: parseFloat(amount),
        principalPaid: parseFloat(principalPaid),
        interestPaid: parseFloat(interestPaid),
        paymentDate: new Date(paymentDate),
        companyId,
      },
    });

    return reply.send({ success: true, data: repayment });
  }

  async approveLoanRepayment(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, repaymentId } = request.params as { id: string; repaymentId: string };
    const userId = (request.user as any).id;

    const repayment = await prisma.employeeLoanRepayment.findUnique({
      where: { id: repaymentId },
      include: { loan: { include: { employee: true } } },
    });

    if (!repayment) {
      throw new NotFoundError('Repayment not found');
    }

    // Generate journal entry
    const entryNumber = await this.generateDocumentNumber(companyId, 'journal');
    
    const cashAccount = await prisma.account.findFirst({
      where: { companyId, code: { endsWith: '1000' }, isActive: true },
    });
    
    const loanAccount = await prisma.account.findFirst({
      where: { companyId, name: { contains: 'Loan', mode: 'insensitive' }, isActive: true },
    });

    const interestAccount = await prisma.account.findFirst({
      where: { companyId, name: { contains: 'Interest Income', mode: 'insensitive' }, isActive: true },
    });

    const debitAccountId1 = loanAccount?.id || cashAccount?.id;
    const debitAccountId2 = interestAccount?.id || loanAccount?.id || cashAccount?.id;
    const creditAccountId = cashAccount?.id;

    if (!debitAccountId1 || !debitAccountId2 || !creditAccountId) {
      throw new Error('Required accounts not found. Please configure cash/loan accounts.');
    }

    // Create journal entry for repayment
    const journal = await prisma.journalEntry.create({
      data: {
        entryNumber,
        date: repayment.paymentDate,
        description: `Loan Repayment for ${repayment.loan.employee.firstName} ${repayment.loan.employee.lastName}`,
        companyId,
        createdById: userId,
        status: 'APPROVED',
        lines: {
          create: [
            {
              accountId: debitAccountId1,
              debit: repayment.principalPaid,
              credit: 0,
            },
            {
              accountId: debitAccountId2,
              debit: repayment.interestPaid,
              credit: 0,
            },
            {
              accountId: creditAccountId,
              debit: 0,
              credit: repayment.amount,
            },
          ],
        },
      },
      include: { lines: { include: { account: true } } },
    });

    // Update repayment status
    await prisma.employeeLoanRepayment.update({
      where: { id: repaymentId },
      data: { status: 'APPROVED', journalEntryId: journal.id },
    });

    // Check if loan is fully paid
    const totalRepaid = await prisma.employeeLoanRepayment.aggregate({
      where: { loanId: repayment.loanId, status: 'APPROVED' },
      _sum: { amount: true },
    });

    const loan = await prisma.employeeLoan.findUnique({ where: { id: repayment.loanId } });
    if (loan && (totalRepaid._sum.amount || 0) >= loan.totalAmount) {
      await prisma.employeeLoan.update({
        where: { id: repayment.loanId },
        data: { status: 'COMPLETED' },
      });
    }

    return reply.send({ success: true, data: { repayment, journal } });
  }

  // Employee Expenses
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
    const { employeeId, amount, description, category, date, paymentMethod, accountId } = request.body as any;

    const expense = await prisma.employeeExpense.create({
      data: {
        employeeId,
        amount: parseFloat(amount),
        description,
        category,
        date: new Date(date),
        paymentMethod,
        accountId,
        companyId,
      },
    });

    return reply.send({ success: true, data: expense });
  }

  async updateEmployeeExpense(request: FastifyRequest, reply: FastifyReply) {
    const { expenseId } = request.params as { expenseId: string };
    const data = request.body as any;

    const expense = await prisma.employeeExpense.update({
      where: { id: expenseId },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
      },
    });

    return reply.send({ success: true, data: expense });
  }

  async deleteEmployeeExpense(request: FastifyRequest, reply: FastifyReply) {
    const { expenseId } = request.params as { expenseId: string };

    await prisma.employeeExpense.delete({ where: { id: expenseId } });

    return reply.send({ success: true });
  }

  async approveEmployeeExpense(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, expenseId } = request.params as { id: string; expenseId: string };
    const userId = (request.user as any).id;

    const expense = await prisma.employeeExpense.findUnique({
      where: { id: expenseId },
      include: { employee: true },
    });

    if (!expense) {
      throw new NotFoundError('Expense not found');
    }

    // Generate journal entry
    const entryNumber = await this.generateDocumentNumber(companyId, 'journal');
    
    const cashAccount = await prisma.account.findFirst({
      where: { companyId, code: { endsWith: '1000' }, isActive: true },
    });

    // Get expense account based on category
    const expenseAccount = await prisma.account.findFirst({
      where: { 
        companyId, 
        name: { contains: expense.category, mode: 'insensitive' },
        isActive: true 
      },
    });

    const salaryAccount = await prisma.account.findFirst({
      where: { companyId, name: { contains: 'Salary', mode: 'insensitive' }, isActive: true },
    });

    const debitAccountId = expenseAccount?.id || salaryAccount?.id || cashAccount?.id;
    const creditAccountId = expense.accountId || cashAccount?.id;

    if (!debitAccountId || !creditAccountId) {
      throw new Error('Required accounts not found. Please configure cash/expense accounts.');
    }

    // Create journal entry
    const journal = await prisma.journalEntry.create({
      data: {
        entryNumber,
        date: expense.date,
        description: `${expense.category} - ${expense.employee.firstName} ${expense.employee.lastName} - ${expense.description || ''}`,
        companyId,
        createdById: userId,
        status: 'APPROVED',
        lines: {
          create: [
            {
              accountId: debitAccountId,
              debit: expense.amount,
              credit: 0,
            },
            {
              accountId: creditAccountId,
              debit: 0,
              credit: expense.amount,
            },
          ],
        },
      },
      include: { lines: { include: { account: true } } },
    });

    // Update expense status
    await prisma.employeeExpense.update({
      where: { id: expenseId },
      data: { status: 'APPROVED', journalEntryId: journal.id },
    });

    return reply.send({ success: true, data: { expense, journal } });
  }
}
