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
  private canEdit(status: string, role: string, userId?: string, createdById?: string): boolean {
    const lockedStatuses = ['VERIFIED', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'CLOSED'];
    if (lockedStatuses.includes(status)) return false;
    
    if (role === 'Owner' || role === 'Admin' || role === 'Manager') return true;

    // Allow creator to edit if DRAFT or REJECTED
    if (userId && createdById && userId === createdById) {
      return status === 'DRAFT' || status === 'REJECTED';
    }
    
    if (role === 'Accountant') return status === 'DRAFT' || status === 'REJECTED';
    return false;
  }

    private canDelete(status: string, role: string): boolean {
    if (status !== 'DRAFT') return false;
    if (role === 'Owner' || role === 'Admin') return true;
    return false;
  }

  private canVerify(status: string, role: string): boolean {
    if (role === 'Owner' || role === 'Manager') return status === 'PENDING_VERIFICATION';
    return false;
  }

  private canApprove(status: string, role: string): boolean {
    if (role === 'Owner') return status === 'VERIFIED';
    if (role === 'Manager') return status === 'VERIFIED';
    return false;
  }

  private getNextStatusAfterVerify(): string {
    return 'VERIFIED';
  }

  private getNextStatusAfterApprove(): string {
    return 'APPROVED';
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

    async updatePurchaseOrder(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, poId } = request.params as { id: string, poId: string };
    const updateData = request.body as any;
    const userId = (request.user as any).id;

    const po = await (prisma as any).purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) throw new NotFoundError('Purchase Order not found');

    const role = await this.getUserRole(userId, companyId);
    if (!this.canEdit(po.status, role)) {
      throw new ForbiddenError('Cannot edit this purchase order in current status');
    }

    // Remove immutable fields if present in update payload
    delete updateData.companyId;
    delete updateData.poNumber;
    delete updateData.createdById;

    if (updateData.poDate) updateData.poDate = new Date(updateData.poDate);
    if (updateData.expectedDeliveryDate) updateData.expectedDeliveryDate = new Date(updateData.expectedDeliveryDate);

    const updatedPo = await PurchaseOrderRepository.update(poId, updateData);

    // Log Activity
    await NotificationController.logActivity({
      companyId,
      entityType: 'purchase_order',
      entityId: updatedPo.id,
      action: 'UPDATED',
      performedById: userId,
      metadata: { docNumber: updatedPo.poNumber }
    });

    return reply.send({ success: true, data: updatedPo });
  }

  async updatePurchaseOrderStatus(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, poId } = request.params as { id: string, poId: string };
    const { status: newStatus } = request.body as { status: string };
    const userId = (request.user as any).id;

    const po = await (prisma as any).purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) throw new NotFoundError('Purchase Order not found');

    const role = await this.getUserRole(userId, companyId);
    const isPrivileged = ['Owner', 'Admin', 'Manager'].includes(role);

    // Strict Transition Map
    const allowedTransitions: Record<string, string[]> = {
      'DRAFT': ['APPROVED', 'REJECTED'],
      'REJECTED': ['DRAFT'],
      'APPROVED': ['SENT', 'REJECTED'],
      'SENT': ['RECEIVED', 'REJECTED'],
      'RECEIVED': ['CLOSED', 'REJECTED'],
      'CLOSED': []
    };

    // Owners and Admins can bypass the transition map for emergency corrections,
    // but others must follow it strictly.
    const isCorrection = ['Owner', 'Admin'].includes(role);
    
    if (!isCorrection && (!allowedTransitions[po.status] || !allowedTransitions[po.status].includes(newStatus))) {
      throw new ForbiddenError(`Transition from ${po.status} to ${newStatus} is not allowed for your role.`);
    }

    const updateData: any = { status: newStatus };
    if (newStatus === 'APPROVED') {
      updateData.approvedById = userId;
    }

    const updated = await (prisma as any).purchaseOrder.update({
      where: { id: poId },
      data: updateData,
      include: {
        supplier: true,
        lc: true,
        lines: true
      }
    });

    await NotificationController.notifyStatusChange({
      companyId,
      entityType: 'PurchaseOrder',
      entityId: poId,
      entityNumber: po.poNumber,
      oldStatus: po.status,
      newStatus: newStatus,
      performedById: userId
    });

    return reply.send({ success: true, data: updated });
  }

    async deletePurchaseOrder(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, poId } = request.params as { id: string, poId: string };
    const userId = (request.user as any).id;

    const po = await (prisma as any).purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) throw new NotFoundError('Purchase Order not found');

    const role = await this.getUserRole(userId, companyId);
    if (!this.canDelete(po.status, role)) {
      throw new ForbiddenError('Cannot delete this purchase order');
    }

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
    const { code, name, accountTypeId, parentId, openingBalance, cashFlowType, category } = request.body as any;

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
      cashFlowType,
      category: category || 'NONE'
    } as any);
    return reply.status(201).send({ success: true, data: account });
  }

  async updateAccount(request: FastifyRequest, reply: FastifyReply) {
    const { accountId } = request.params as { accountId: string };
    const { code, name, accountTypeId, parentId, openingBalance, isActive, cashFlowType, category } = request.body as any;

    const existingAccount = await prisma.account.findUnique({ where: { id: accountId } });
    if (!existingAccount) throw new NotFoundError('Account not found');

    const account = await prisma.account.update({
      where: { id: accountId },
      data: { 
        name: name ?? existingAccount.name, 
        isActive: isActive ?? existingAccount.isActive, 
        cashFlowType: cashFlowType ?? existingAccount.cashFlowType,
        code: code ?? existingAccount.code,
        accountTypeId: accountTypeId ?? existingAccount.accountTypeId,
        parentId: parentId === null ? null : (parentId ?? existingAccount.parentId),
        openingBalance: openingBalance !== undefined ? parseFloat(openingBalance) : existingAccount.openingBalance,
        category: category ?? (existingAccount as any).category
      },
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

    try {
      console.log(`[CreateInvoice] Starting for company: ${companyId}`);
      
      console.log(`[CreateInvoice] Checkpoint 1: Generating invoice number...`);
      const invoiceNumber = await this.generateDocumentNumber(companyId, 'invoice');

      console.log(`[CreateInvoice] Checkpoint 2: Calculating totals...`);
      if (!data.lines || !Array.isArray(data.lines)) {
        throw new ValidationError('Invoice lines are required');
      }
      const subtotal = data.lines.reduce((sum: number, line: any) => sum + (line.quantity * line.unitPrice), 0);
      const taxAmount = data.lines.reduce((sum: number, line: any) => sum + (line.quantity * line.unitPrice * (line.taxRate || 0) / 100), 0);
      const total = subtotal + taxAmount;
      const bdtAmount = total * (data.exchangeRate || 1);

      if (!data.invoiceDate) {
        throw new ValidationError('Invoice date is required');
      }

      console.log(`[CreateInvoice] Checkpoint 3: Validating compliance and roles...`);
      const invoiceDate = new Date(data.invoiceDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      const role = await this.getUserRole(userId, companyId);
      const isOwnerOrAdmin = role === 'Owner' || role === 'Admin';

      const settings = await prisma.companySettings.findUnique({ where: { companyId } });
      if (settings) {
        if (settings.disallowFutureDates && invoiceDate > today) {
          throw new ValidationError('Company settings strictly disallow posting transactions with a future date.');
        }
        if (settings.lockPreviousMonths) {
          const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          if (invoiceDate < firstDayOfMonth && !isOwnerOrAdmin) {
            throw new ValidationError('Company settings restrict posting to previous months based on period lock rules.');
          }
        }
      } else if (invoiceDate > today && !isOwnerOrAdmin) {
        throw new ValidationError('Future invoice dates are only allowed for owners');
      }

      console.log(`[CreateInvoice] Checkpoint 4: Calling repository...`);
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
        subtotal,
        taxAmount,
        discountAmount: 0,
        total: bdtAmount,
        createdById: userId,
        lines: {
          create: data.lines.map((l: any) => ({
            productId: l.productId || null,
            description: l.description,
            quantity: Number(l.quantity || 1),
            unitPrice: Number(l.unitPrice || 0),
            taxRate: Number(l.taxRate || 0),
            amount: Number(l.quantity || 0) * Number(l.unitPrice || 0) * (1 + (Number(l.taxRate || 0) / 100)),
          })),
        },
      });

      console.log(`[CreateInvoice] Success! ID: ${invoice.id}`);
      await NotificationController.logActivity({
        companyId,
        entityType: 'invoice',
        entityId: (invoice as any).id,
        action: 'CREATED',
        performedById: userId,
        metadata: { 
          docNumber: invoiceNumber,
          type: data.type || 'SALES'
        }
      });

      return reply.status(201).send({ success: true, data: invoice });
    } catch (error: any) {
      console.error('[CreateInvoice] CRITICAL ERROR:', error);
      return reply.status(error.statusCode || 500).send({ 
        success: false, 
        error: { 
          message: error.message || 'Failed to create invoice',
          checkpoint: 'Check server logs for [CreateInvoice] tags',
          detail: process.env.NODE_ENV === 'development' ? error.stack : undefined
        } 
      });
    }
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

  async submitInvoice(request: FastifyRequest, reply: FastifyReply) {
    const { invoiceId } = request.params as { invoiceId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;

    const role = await this.getUserRole(userId, companyId);
    if (role !== 'Accountant' && role !== 'Owner') {
      throw new ForbiddenError('Only Accountants or Owners can submit invoices');
    }

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundError('Invoice not found');
    if (invoice.status !== 'DRAFT' && invoice.status !== 'REJECTED') {
      throw new ValidationError('Only DRAFT or REJECTED invoices can be submitted');
    }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'PENDING_VERIFICATION' },
    });

    await NotificationController.notifyStatusChange({
      companyId,
      entityType: 'Invoice',
      entityId: invoiceId,
      entityNumber: updated.invoiceNumber,
      oldStatus: invoice.status,
      newStatus: 'PENDING_VERIFICATION',
      performedById: userId
    });

    return reply.send({ success: true, data: updated });
  }

  async verifyInvoice(request: FastifyRequest, reply: FastifyReply) {
    const { invoiceId } = request.params as { invoiceId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;

    try {
      console.log(`[VerifyInvoice] Starting for invoice: ${invoiceId}`);
      const role = await this.getUserRole(userId, companyId);
      const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });

      if (!invoice) throw new NotFoundError('Invoice not found');

      if (!this.canVerify(invoice.status, role)) {
        throw new ForbiddenError(`Cannot verify this invoice from current status: ${invoice.status}`);
      }

      console.log(`[VerifyInvoice] Checkpoint 1: Updating status...`);
      const updated = await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'VERIFIED',
          verifiedById: userId,
          verifiedAt: new Date(),
        },
      });

      await NotificationController.notifyStatusChange({
        companyId,
        entityType: 'Invoice',
        entityId: invoiceId,
        entityNumber: invoice.invoiceNumber,
        oldStatus: invoice.status,
        newStatus: 'VERIFIED',
        performedById: userId
      });

      console.log(`[VerifyInvoice] Success!`);
      return reply.send({ success: true, data: updated });
    } catch (error: any) {
      console.error('[VerifyInvoice] ERROR:', error);
      return reply.status(error.statusCode || 500).send({ success: false, error: { message: error.message } });
    }
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

    await NotificationController.notifyStatusChange({
      companyId,
      entityType: 'Invoice',
      entityId: invoiceId,
      entityNumber: invoice.invoiceNumber,
      oldStatus: invoice.status,
      newStatus: 'REJECTED',
      performedById: userId,
      reason
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

    await NotificationController.notifyStatusChange({
      companyId,
      entityType: 'Invoice',
      entityId: invoiceId,
      entityNumber: invoice.invoiceNumber,
      oldStatus: invoice.status,
      newStatus: 'DRAFT',
      performedById: userId
    });

    return reply.send({ success: true, data: updated });
  }

  async approveInvoice(request: FastifyRequest, reply: FastifyReply) {
    const { invoiceId } = request.params as { invoiceId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;

    try {
      console.log(`[ApproveInvoice] Starting for invoice: ${invoiceId}`);
      const role = await this.getUserRole(userId, companyId);
      const invoice = await prisma.invoice.findUnique({ 
        where: { id: invoiceId },
        include: { lines: true } 
      });

      if (!invoice) throw new NotFoundError('Invoice not found');

      if (!this.canApprove(invoice.status, role)) {
        throw new ForbiddenError(`Cannot approve this invoice from current status: ${invoice.status}`);
      }

      console.log(`[ApproveInvoice] Checkpoint 1: Starting transaction...`);
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

        // 2. Generate Multi-Line Journal Entry
        console.log(`[ApproveInvoice] Checkpoint 2: Generating ledger entry...`);
        await TransactionRepository.generateInvoiceJournal(tx, invoice, companyId, userId);

        return inv;
      });

      console.log(`[ApproveInvoice] Success!`);
      return reply.send({ success: true, data: updated });
    } catch (error: any) {
      console.error('[ApproveInvoice] CRITICAL ERROR:', error);
      return reply.status(error.statusCode || 500).send({ 
        success: false, 
        error: { 
          message: error.message || 'Failed to approve invoice',
          detail: error.stack
        } 
      });
    }
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
    
    try {
      console.log(`[CreateJournal] Starting for company: ${companyId}`);
      
      if (!request.user) {
        throw new ValidationError('User not authenticated - request.user is missing');
      }
      const userId = (request.user as any).id;
      console.log(`[CreateJournal] User identified: ${userId}`);

      console.log(`[CreateJournal] Checkpoint 1: Generating document number...`);
      const entryNumber = await this.generateDocumentNumber(companyId, 'journal');
      console.log(`[CreateJournal] Checkpoint 2: entryNumber generated: ${entryNumber}`);

      if (!data.lines || !Array.isArray(data.lines)) {
        throw new ValidationError('Journal lines are required and must be an array');
      }

      const lineDebit = (l: any): number =>
        l.debitCredit !== undefined ? (l.debitCredit === 'debit' ? Number(l.amount) : 0) : Number(l.debit || 0);
      const lineCredit = (l: any): number =>
        l.debitCredit !== undefined ? (l.debitCredit === 'credit' ? Number(l.amount) : 0) : Number(l.credit || 0);

      const totalDebit = data.lines.reduce((sum: number, line: any) => sum + lineDebit(line), 0);
      const totalCredit = data.lines.reduce((sum: number, line: any) => sum + lineCredit(line), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new ValidationError(`Debit (${totalDebit}) and Credit (${totalCredit}) must be equal`);
      }

      if (!data.date) {
        throw new ValidationError('Transaction date is required');
      }

      const journalDate = new Date(data.date);
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      console.log(`[CreateJournal] Checkpoint 3: Fetching user role and company settings...`);
      const role = await this.getUserRole(userId, companyId);
      const isOwnerOrAdmin = role === 'Owner' || role === 'Admin';
      console.log(`[CreateJournal] User role: ${role}`);

      const settings = await prisma.companySettings.findUnique({ where: { companyId } });
      if (settings) {
        if (settings.disallowFutureDates && journalDate > today) {
          throw new ValidationError('Company settings strictly disallow posting transactions with a future date.');
        }
        if (settings.lockPreviousMonths) {
          const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          if (journalDate < firstDayOfMonth && !isOwnerOrAdmin) {
            throw new ValidationError('Company settings restrict posting to previous months based on period lock rules.');
          }
        }
      } else if (journalDate > today && !isOwnerOrAdmin) {
        throw new ValidationError('Future transaction dates are only allowed for owners');
      }

      const status = (role === 'Accountant' || isOwnerOrAdmin) ? 'PENDING_VERIFICATION' : 'DRAFT';

      console.log(`[CreateJournal] Checkpoint 4: Preparing data and calling repository...`);
      const sanitizedData = {
        description: data.description || null,
        reference: data.reference || null,
        currencyId: data.currencyId || null,
        exchangeRate: Number(data.exchangeRate || 1),
      };

      const journal = await TransactionRepository.createJournal({
        ...sanitizedData,
        date: journalDate,
        entryNumber,
        companyId,
        totalDebit,
        totalCredit,
        createdById: userId,
        status,
        lines: {
          create: (data.lines || []).map((l: any, idx: number) => {
            const debit = lineDebit(l);
            const credit = lineCredit(l);
            const rate = Number(l.exchangeRate || data.exchangeRate || 1);
            if (!l.accountId) {
              throw new ValidationError(`Line ${idx + 1} is missing an Account ID`);
            }
            return {
              accountId: l.accountId,
              projectId: l.projectId || null,
              costCenterId: l.costCenterId || null,
              customerId: l.customerId || null,
              vendorId: l.vendorId || null,
              description: l.description || null,
              debit,
              credit,
              debitBase: l.debitBase != null ? Number(l.debitBase) : debit * rate,
              creditBase: l.creditBase != null ? Number(l.creditBase) : credit * rate,
              debitForeign: l.debitForeign != null ? Number(l.debitForeign) : debit,
              creditForeign: l.creditForeign != null ? Number(l.creditForeign) : credit,
              exchangeRate: rate,
            };
          }),
        },
      });

      console.log(`[CreateJournal] Checkpoint 5: Success! Journal ID: ${journal.id}. Logging activities...`);
      
      // Log Structured Activity
      await NotificationController.logActivity({
        companyId,
        entityType: 'journal',
        entityId: journal.id,
        action: 'CREATED',
        performedById: userId,
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

      console.log(`[CreateJournal] All operations completed.`);
      return reply.status(201).send({ success: true, data: journal });
    } catch (error: any) {
      console.error('[CreateJournal] CRITICAL ERROR:', error);
      console.error('[CreateJournal] Stack Trace:', error.stack);
      
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({ 
        success: false, 
        error: {
          message: error.message || 'Internal server error during journal creation',
          checkpoint: 'Check server logs for [CreateJournal] tags',
          detail: process.env.NODE_ENV === 'development' ? error.stack : 'Please check server logs for full stack trace.'
        }
      });
    }
  }

  async updateJournal(request: FastifyRequest, reply: FastifyReply) {
    const { journalId } = request.params as { journalId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;
    const data = request.body as any;

    const role = await this.getUserRole(userId, companyId);
    const journal = await (prisma as any).journalEntry.findUnique({ where: { id: journalId } });

    if (!journal) throw new NotFoundError('Journal not found');

    if (!this.canEdit(journal.status, role, userId, journal.createdById)) {
      throw new ForbiddenError('Cannot edit this journal in current status');
    }

    const { lines, ...otherData } = data;

    const updated = await prisma.$transaction(async (tx: any) => {
      if (lines) {
        await tx.journalEntryLine.deleteMany({ where: { journalEntryId: journalId } });
      }

      return await tx.journalEntry.update({
        where: { id: journalId },
        data: {
          ...otherData,
          date: otherData.date ? new Date(otherData.date) : undefined,
          lines: lines ? {
            create: lines.map((l: any) => ({
              accountId: l.accountId,
              description: l.description,
              debit: l.debitCredit === 'debit' ? Number(l.amount) : 0,
              credit: l.debitCredit === 'credit' ? Number(l.amount) : 0,
              debitBase: l.debitCredit === 'debit' ? Number(l.amount) : 0,
              creditBase: l.debitCredit === 'credit' ? Number(l.amount) : 0,
            }))
          } : undefined
        },
        include: { lines: true },
      });
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

    await NotificationController.notifyStatusChange({
      companyId: journal.companyId,
      entityType: 'JournalEntry',
      entityId: journal.id,
      entityNumber: journal.entryNumber,
      oldStatus: journal.status,
      newStatus: 'VERIFIED',
      performedById: userId
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

    // Allow rejection from PENDING_VERIFICATION (Manager/Owner) OR PENDING_APPROVAL (Owner/Admin)
    const canReject =
      (journal.status === 'PENDING_VERIFICATION' && (role === 'Manager' || role === 'Owner' || role === 'Admin')) ||
      (journal.status === 'PENDING_APPROVAL' && (role === 'Owner' || role === 'Admin')) ||
      (journal.status === 'VERIFIED' && (role === 'Owner' || role === 'Admin'));

    if (!canReject) {
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

    await NotificationController.notifyStatusChange({
      companyId: journal.companyId,
      entityType: 'JournalEntry',
      entityId: journal.id,
      entityNumber: journal.entryNumber,
      oldStatus: journal.status,
      newStatus: 'REJECTED',
      performedById: userId,
      reason
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

    await NotificationController.notifyStatusChange({
      companyId,
      entityType: 'JournalEntry',
      entityId: journalId,
      entityNumber: updated.entryNumber,
      oldStatus: 'REJECTED',
      newStatus: 'DRAFT',
      performedById: userId
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

    await NotificationController.notifyStatusChange({
      companyId,
      entityType: 'JournalEntry',
      entityId: journalId,
      entityNumber: updated.entryNumber,
      oldStatus: journal.status,
      newStatus: 'PENDING_VERIFICATION',
      performedById: userId
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
      throw new ForbiddenError(`Cannot approve this journal from current status: ${journal.status}`);
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

      await NotificationController.notifyStatusChange({
        companyId: journal.companyId,
        entityType: 'JournalEntry',
        entityId: journal.id,
        entityNumber: journal.entryNumber,
        oldStatus: journal.status,
        newStatus: 'APPROVED',
        performedById: userId
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

  async closePeriod(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { date, description } = request.body as any;
    const userId = (request.user as any).id;

    if (!date) throw new ValidationError('Closing date is required');
    const closingDate = new Date(date);
    
    const role = await this.getUserRole(userId, companyId);
    if (role !== 'Owner' && role !== 'Admin') {
      throw new ForbiddenError('Only Owners and Admins can perform period closing');
    }

    const entryNumber = await this.generateDocumentNumber(companyId, 'journal');

    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Get P&L accounts with non-zero balances
      const plAccounts = await tx.account.findMany({
        where: { 
          companyId, 
          accountType: { name: { in: ['INCOME', 'EXPENSE'] } },
          currentBalance: { not: 0 },
          isActive: true 
        },
        include: { accountType: true }
      });

      if (plAccounts.length === 0) {
        throw new ValidationError('No active P&L balances found to close');
      }

      // 2. Find Retained Earnings Account
      let reAccount = await tx.account.findFirst({
        where: { companyId, name: 'Retained Earnings', accountType: { name: 'EQUITY' } }
      });

      if (!reAccount) {
        throw new ValidationError('Retained Earnings account not configured for this company');
      }

      const journalLines: any[] = [];
      let totalDebit = 0;
      let totalCredit = 0;

      for (const acc of plAccounts) {
        const isDebitType = acc.accountType.type === 'DEBIT';
        const currentBal = Number(acc.currentBalance);
        
        let debit = 0;
        let credit = 0;

        if (isDebitType) {
          if (currentBal > 0) credit = currentBal;
          else if (currentBal < 0) debit = Math.abs(currentBal);
        } else {
          if (currentBal > 0) debit = currentBal;
          else if (currentBal < 0) credit = Math.abs(currentBal);
        }

        if (debit > 0 || credit > 0) {
          totalDebit += debit;
          totalCredit += credit;
          journalLines.push({
            accountId: acc.id,
            description: `Closing Entry - ${acc.name}`,
            debit,
            credit,
            debitBase: debit,
            creditBase: credit
          });

          await tx.account.update({
             where: { id: acc.id },
             data: { currentBalance: 0 }
          });
        }
      }

      const diff = totalDebit - totalCredit;
      let reDebit = 0;
      let reCredit = 0;
      let reBalanceChange = 0;

      if (diff > 0) {
        reCredit = diff;
        totalCredit += diff;
        reBalanceChange = diff; 
      } else if (diff < 0) {
        reDebit = Math.abs(diff);
        totalDebit += Math.abs(diff);
        reBalanceChange = -Math.abs(diff);
      }

      if (reDebit > 0 || reCredit > 0) {
         journalLines.push({
            accountId: reAccount.id,
            description: `Period Closing to Retained Earnings`,
            debit: reDebit,
            credit: reCredit,
            debitBase: reDebit,
            creditBase: reCredit
         });

         await tx.account.update({
            where: { id: reAccount.id },
            data: { currentBalance: { increment: reBalanceChange } }
         });
      }

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
         throw new ValidationError('Period closing journal unbalanced');
      }

      const closedJournal = await tx.journalEntry.create({
        data: {
          entryNumber,
          companyId,
          date: closingDate,
          description: description || `Period Closing Entry for Fiscal Year`,
          totalDebit,
          totalCredit,
          status: 'APPROVED',
          createdById: userId,
          approvedById: userId,
          approvedAt: new Date(),
          lines: {
            create: journalLines
          }
        }
      });

      return closedJournal;
    });

    return reply.send({ success: true, data: result, message: 'Period Closed successfully' });
  }

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

      if (!advance) {
        throw new NotFoundError('Advance not found');
      }

      // Generate journal entry
      const entryNumber = await this.generateDocumentNumber(companyId, 'journal');
      
      // Get default accounts using categories and fallbacks
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
          OR: [
            { category: 'AP' },
            { name: { contains: 'Employee', mode: 'insensitive' } }
          ],
          isActive: true 
        },
      });

      const creditAccountId = (advance.accountId || cashAccount?.id || bankAccount?.id) as string;
      const debitAccountId = (employeePayableAccount?.id || advanceAccount?.id || creditAccountId) as string;

      if (!debitAccountId || !creditAccountId) {
        throw new ValidationError(
          'Required accounts (Cash/Bank or Employee/Advance) not found.',
          'Please ensure you have accounts with categories CASH, BANK, or AP (Accounts Payable) configured in your Chart of Accounts.'
        );
      }

      // Create journal entry
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
                debitForeign: advance.amount,
                creditForeign: 0,
                exchangeRate: 1,
              },
              {
                accountId: creditAccountId,
                debit: 0,
                credit: advance.amount,
                debitBase: 0,
                creditBase: advance.amount,
                debitForeign: 0,
                creditForeign: advance.amount,
                exchangeRate: 1,
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
    const { id: companyId, loanId } = request.params as { id: string, loanId: string };
    const data = request.body as any;
    const userId = (request.user as any).id;

    const existing = await prisma.employeeLoan.findUnique({ where: { id: loanId } });
    if (!existing) throw new NotFoundError('Loan not found');

    const role = await this.getUserRole(userId, companyId);
    if (!this.canEdit(existing.status, role)) {
      throw new ForbiddenError('Cannot edit this loan in current status');
    }

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
    const { id: companyId, loanId } = request.params as { id: string, loanId: string };
    const userId = (request.user as any).id;

    const existing = await prisma.employeeLoan.findUnique({ where: { id: loanId } });
    if (!existing) throw new NotFoundError('Loan not found');

    const role = await this.getUserRole(userId, companyId);
    if (!this.canDelete(existing.status, role)) {
      throw new ForbiddenError('Cannot delete this loan');
    }

    await prisma.employeeLoan.delete({ where: { id: loanId } });

    return reply.send({ success: true });
  }

  async verifyEmployeeLoan(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, loanId } = request.params as { id: string; loanId: string };
    const userId = (request.user as any).id;

    const loan = await prisma.employeeLoan.findUnique({ where: { id: loanId } });
    if (!loan) throw new NotFoundError('Loan not found');

    const role = await this.getUserRole(userId, companyId);
    if (!this.canVerify(loan.status, role)) {
      throw new ForbiddenError(`Cannot verify this loan from current status: ${loan.status}`);
    }

    const updated = await prisma.employeeLoan.update({
      where: { id: loanId },
      data: { status: 'VERIFIED' },
    });

    return reply.send({ success: true, data: updated });
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
      // Get default accounts using categories and regular lookups
      const cashAccount = await AccountRepository.findByCategory(companyId, 'CASH');
      const bankAccount = await AccountRepository.findByCategory(companyId, 'BANK');
      
      const loanAccount = await prisma.account.findFirst({
        where: { 
          companyId, 
          OR: [
            { code: 'A-1381' },
            { name: { contains: 'Loan', mode: 'insensitive' } }
          ],
          isActive: true 
        },
      });
      
      const employeePayableAccount = await prisma.account.findFirst({
        where: { 
          companyId, 
          name: { contains: 'Employee Payable', mode: 'insensitive' }, 
          isActive: true 
        },
      });

      const creditAccountId = (cashAccount?.id || bankAccount?.id) as string;
      const debitAccountId = (loanAccount?.id || employeePayableAccount?.id || creditAccountId) as string;

      if (!debitAccountId || !creditAccountId) {
        throw new ValidationError(
          'Required accounts (Cash/Bank or Loan) not found.',
          'Please ensure you have accounts with categories CASH or BANK, or an account with "Loan" in its name configured.'
        );
      }

      // Create journal entry for loan disbursement (principal + interest)
      const totalDisbursement = loan.principalAmount + loan.interestAmount;
      
      const interestIncomeAccount = await prisma.account.findFirst({
        where: { 
          companyId, 
          OR: [
            { code: 'I-4101' },
            { name: { contains: 'Interest Income', mode: 'insensitive' } }
          ],
          isActive: true 
        },
      });

      await prisma.journalEntry.create({
        data: {
          entryNumber,
          date: loan.startDate,
          companyId,
          createdById: userId,
          status: 'APPROVED',
          totalDebit: totalDisbursement,
          totalCredit: totalDisbursement,
          lines: {
            create: [
              {
                accountId: debitAccountId,
                debit: loan.principalAmount,
                credit: 0,
                debitBase: loan.principalAmount,
                creditBase: 0,
                debitForeign: loan.principalAmount,
                creditForeign: 0,
                exchangeRate: 1,
              },
              {
                accountId: debitAccountId,
                debit: loan.interestAmount,
                credit: 0,
                debitBase: loan.interestAmount,
                creditBase: 0,
                debitForeign: loan.interestAmount,
                creditForeign: 0,
                exchangeRate: 1,
              },
              {
                accountId: creditAccountId,
                debit: 0,
                credit: totalDisbursement,
                debitBase: 0,
                creditBase: totalDisbursement,
                debitForeign: 0,
                creditForeign: totalDisbursement,
                exchangeRate: 1,
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

  async verifyLoanRepayment(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, repaymentId } = request.params as { id: string; repaymentId: string };
    const userId = (request.user as any).id;

    const repayment = await prisma.employeeLoanRepayment.findUnique({ where: { id: repaymentId } });
    if (!repayment) throw new NotFoundError('Repayment not found');

    const role = await this.getUserRole(userId, companyId);
    if (!this.canVerify(repayment.status, role)) {
      throw new ForbiddenError(`Cannot verify this repayment from current status: ${repayment.status}`);
    }

    const updated = await prisma.employeeLoanRepayment.update({
      where: { id: repaymentId },
      data: { status: 'VERIFIED' },
    });

    return reply.send({ success: true, data: updated });
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
    
    // Get accounts using categories and fallbacks
    const cashAccount = await AccountRepository.findByCategory(companyId, 'CASH');
    const bankAccount = await AccountRepository.findByCategory(companyId, 'BANK');
    
    const loanAccount = await prisma.account.findFirst({
      where: { 
        companyId, 
        OR: [
          { code: 'A-1381' },
          { name: { contains: 'Loan', mode: 'insensitive' } }
        ],
        isActive: true 
      },
    });

    const interestAccount = await prisma.account.findFirst({
      where: { 
        companyId, 
        OR: [
          { category: 'INCOME' },
          { name: { contains: 'Interest Income', mode: 'insensitive' } }
        ],
        isActive: true 
      },
    });

    const cashAccountId = (cashAccount?.id || bankAccount?.id) as string;
    const loanAccountId = (loanAccount?.id || cashAccountId) as string;
    const interestAccountId = (interestAccount?.id || loanAccountId) as string;

    if (!cashAccountId || !loanAccountId) {
      throw new ValidationError(
        'Required accounts (Cash/Bank or Loan) not found for repayment.',
        'Please ensure you have accounts with categories CASH or BANK, and an account with "Loan" in its name.'
      );
    }

    // Create journal entry for repayment (Debit Cash, Credit Loan & Interest)
    const journal = await prisma.journalEntry.create({
      data: {
        entryNumber,
        date: repayment.paymentDate,
        companyId,
        createdById: userId,
        status: 'APPROVED',
        totalDebit: repayment.amount,
        totalCredit: repayment.amount,
        lines: {
          create: [
            {
              accountId: cashAccountId,
              debit: repayment.amount,
              credit: 0,
              debitBase: repayment.amount,
              creditBase: 0,
              debitForeign: repayment.amount,
              creditForeign: 0,
              exchangeRate: 1,
            },
            {
              accountId: loanAccountId,
              debit: 0,
              credit: repayment.principalPaid,
              debitBase: 0,
              creditBase: repayment.principalPaid,
              debitForeign: 0,
              creditForeign: repayment.principalPaid,
              exchangeRate: 1,
            },
            {
              accountId: interestAccountId,
              debit: 0,
              credit: repayment.interestPaid,
              debitBase: 0,
              creditBase: repayment.interestPaid,
              debitForeign: 0,
              creditForeign: repayment.interestPaid,
              exchangeRate: 1,
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
    const { id: companyId, expenseId } = request.params as { id: string, expenseId: string };
    const data = request.body as any;
    const userId = (request.user as any).id;

    const existing = await prisma.employeeExpense.findUnique({ where: { id: expenseId } });
    if (!existing) throw new NotFoundError('Expense not found');

    const role = await this.getUserRole(userId, companyId);
    if (!this.canEdit(existing.status, role)) {
      throw new ForbiddenError('Cannot edit this expense in current status');
    }

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
    const { id: companyId, expenseId } = request.params as { id: string, expenseId: string };
    const userId = (request.user as any).id;

    const existing = await prisma.employeeExpense.findUnique({ where: { id: expenseId } });
    if (!existing) throw new NotFoundError('Expense not found');

    const role = await this.getUserRole(userId, companyId);
    if (!this.canDelete(existing.status, role)) {
      throw new ForbiddenError('Cannot delete this expense');
    }

    await prisma.employeeExpense.delete({ where: { id: expenseId } });

    return reply.send({ success: true });
  }

  async verifyEmployeeExpense(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, expenseId } = request.params as { id: string; expenseId: string };
    const userId = (request.user as any).id;

    const expense = await prisma.employeeExpense.findUnique({ where: { id: expenseId } });
    if (!expense) throw new NotFoundError('Expense not found');

    const role = await this.getUserRole(userId, companyId);
    if (!this.canVerify(expense.status, role)) {
      throw new ForbiddenError(`Cannot verify this expense from current status: ${expense.status}`);
    }

    const updated = await prisma.employeeExpense.update({
      where: { id: expenseId },
      data: { status: 'VERIFIED' },
    });

    return reply.send({ success: true, data: updated });
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

    // Get accounts using structured discovery
    const cashAccount = await AccountRepository.findByCategory(companyId, 'CASH');
    const bankAccount = await AccountRepository.findByCategory(companyId, 'BANK');

    // Get expense account based on category (from the expense entry)
    const expenseAccount = await prisma.account.findFirst({
      where: { 
        companyId, 
        name: { contains: expense.category, mode: 'insensitive' },
        isActive: true 
      },
    });

    const salaryAccount = await prisma.account.findFirst({
      where: { 
        companyId, 
        OR: [
          { name: { contains: 'Salary', mode: 'insensitive' } },
          { name: { contains: 'Wage', mode: 'insensitive' } }
        ],
        isActive: true 
      },
    });

    const debitAccountId = (expenseAccount?.id || salaryAccount?.id || (cashAccount?.id || bankAccount?.id)) as string;
    const creditAccountId = (expense.accountId || cashAccount?.id || bankAccount?.id) as string;

    if (!debitAccountId || !creditAccountId) {
      throw new ValidationError(
        'Account discovery failed for expense approval.',
        'Please ensure you have accounts categorized as CASH or BANK, or an expense account matching the category (e.g., Salary, Food, Medical).'
      );
    }

    // Create journal entry
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
              accountId: debitAccountId,
              debit: expense.amount,
              credit: 0,
              debitBase: expense.amount,
              creditBase: 0,
              debitForeign: expense.amount,
              creditForeign: 0,
              exchangeRate: 1,
            },
            {
              accountId: creditAccountId,
              debit: 0,
              credit: expense.amount,
              debitBase: 0,
              creditBase: expense.amount,
              debitForeign: 0,
              creditForeign: expense.amount,
              exchangeRate: 1,
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

  // ============ COMPANY SETTINGS ============

  async getSettings(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const settings = await prisma.companySettings.findUnique({ where: { companyId } });
    if (!settings) {
      return reply.send({
        success: true,
        data: { companyId, disallowFutureDates: true, lockPreviousMonths: false, approvalWorkflow: true },
      });
    }
    return reply.send({ success: true, data: settings });
  }

  async updateSettings(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;
    const body = request.body as any;

    const role = await this.getUserRole(userId, companyId);
    if (!['Owner', 'Admin'].includes(role)) {
      throw new ForbiddenError('Only Owner or Admin can update company settings');
    }

    const pick = (key: string, fallback: any) =>
      body[key] !== undefined ? body[key] : fallback;

    const settings = await prisma.companySettings.upsert({
      where: { companyId },
      update: {
        ...(body.disallowFutureDates !== undefined && { disallowFutureDates: body.disallowFutureDates }),
        ...(body.lockPreviousMonths !== undefined && { lockPreviousMonths: body.lockPreviousMonths }),
        ...(body.approvalWorkflow !== undefined && { approvalWorkflow: body.approvalWorkflow }),
        ...(body.requireVerification !== undefined && { requireVerification: body.requireVerification }),
        ...(body.autoPostJournals !== undefined && { autoPostJournals: body.autoPostJournals }),
        ...(body.fiscalYearStart !== undefined && { fiscalYearStart: Number(body.fiscalYearStart) }),
        ...(body.lockedBeforeDate !== undefined && { lockedBeforeDate: body.lockedBeforeDate ? new Date(body.lockedBeforeDate) : null }),
        ...(body.defaultCurrency !== undefined && { defaultCurrency: body.defaultCurrency }),
        ...(body.dateFormat !== undefined && { dateFormat: body.dateFormat }),
        ...(body.decimalPlaces !== undefined && { decimalPlaces: Number(body.decimalPlaces) }),
        ...(body.enableVAT !== undefined && { enableVAT: body.enableVAT }),
        ...(body.defaultVATRate !== undefined && { defaultVATRate: Number(body.defaultVATRate) }),
        ...(body.vatRegistrationNumber !== undefined && { vatRegistrationNumber: body.vatRegistrationNumber }),
        ...(body.tin !== undefined && { tin: body.tin }),
        ...(body.alertOverdueInvoices !== undefined && { alertOverdueInvoices: body.alertOverdueInvoices }),
        ...(body.alertLCExpiry !== undefined && { alertLCExpiry: body.alertLCExpiry }),
        ...(body.alertLoanDue !== undefined && { alertLoanDue: body.alertLoanDue }),
        ...(body.lcExpiryAlertDays !== undefined && { lcExpiryAlertDays: Number(body.lcExpiryAlertDays) }),
        ...(body.loanDueAlertDays !== undefined && { loanDueAlertDays: Number(body.loanDueAlertDays) }),
      },
      create: {
        companyId,
        disallowFutureDates: pick('disallowFutureDates', false),
        lockPreviousMonths: pick('lockPreviousMonths', false),
        approvalWorkflow: pick('approvalWorkflow', true),
        requireVerification: pick('requireVerification', true),
        autoPostJournals: pick('autoPostJournals', true),
        fiscalYearStart: pick('fiscalYearStart', 1),
        defaultCurrency: pick('defaultCurrency', 'BDT'),
        dateFormat: pick('dateFormat', 'DD/MM/YYYY'),
        decimalPlaces: pick('decimalPlaces', 2),
        enableVAT: pick('enableVAT', false),
        defaultVATRate: pick('defaultVATRate', 15),
        vatRegistrationNumber: pick('vatRegistrationNumber', null),
        tin: pick('tin', null),
        alertOverdueInvoices: pick('alertOverdueInvoices', true),
        alertLCExpiry: pick('alertLCExpiry', true),
        alertLoanDue: pick('alertLoanDue', true),
        lcExpiryAlertDays: pick('lcExpiryAlertDays', 7),
        loanDueAlertDays: pick('loanDueAlertDays', 30),
      },
    });

    return reply.send({ success: true, data: settings });
  }
}
