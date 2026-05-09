import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { ValidationError, NotFoundError, ForbiddenError } from '../../middleware/errorHandler';
import { TransactionRepository } from '../../repositories/TransactionRepository';
import { BaseCompanyController } from './base.controller';
import { JournalService } from '../accounting/journal.service';
import { RBACService } from './rbac.service';

export class BillsController extends BaseCompanyController {
  async getBills(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { status, vendorId, branchId } = request.query as any;

    const where: any = { companyId, deletedAt: null };
    if (status) where.status = status;
    if (vendorId) where.vendorId = vendorId;
    if (branchId) where.branchId = branchId;

    const bills = await prisma.bill.findMany({
      where,
      include: { 
        vendor: true, 
        branch: true,
        createdBy: { select: { firstName: true, lastName: true } },
        payments: { select: { id: true, amount: true, status: true, date: true } } 
      },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send({ success: true, data: bills });
  }

  async getBill(request: FastifyRequest, reply: FastifyReply) {
    const { billId } = request.params as { billId: string };
    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: { 
        vendor: true, 
        branch: true,
        createdBy: { select: { firstName: true, lastName: true } },
        verifiedBy: { select: { firstName: true, lastName: true } },
        approvedBy: { select: { firstName: true, lastName: true } },
        payments: true 
      },
    });
    if (!bill) throw new NotFoundError('Bill not found');
    return reply.send({ success: true, data: bill });
  }

  async createBill(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;
    const { vendorId, branchId, subtotal, taxAmount, discountAmount, dueDate, currency, exchangeRate } = request.body as any;

    await this.requirePermission(userId, companyId, 'bills', 'create');

    if (!vendorId) throw new ValidationError('Vendor is required');
    if (subtotal == null || Number(subtotal) <= 0) throw new ValidationError('Subtotal must be a positive number');

    const sub = Number(subtotal);
    const tax = Number(taxAmount || 0);
    const disc = Number(discountAmount || 0);
    
    const billNumber = await this.generateDocumentNumber(companyId, 'bill');

    const bill = await prisma.bill.create({
      data: {
        billNumber,
        companyId,
        vendorId,
        branchId,
        subtotal: sub,
        taxAmount: tax,
        discountAmount: disc,
        total: sub + tax - disc,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        currency: currency || 'BDT',
        exchangeRate: Number(exchangeRate || 1),
        status: 'DRAFT',
        createdById: userId,
      },
      include: { vendor: true },
    });

    return reply.status(201).send({ success: true, data: bill });
  }

  async updateBill(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, billId } = request.params as { id: string; billId: string };
    const userId = (request.user as any).id;
    const data = request.body as any;

    const existing = await prisma.bill.findUnique({ where: { id: billId } });
    if (!existing) throw new NotFoundError('Bill not found');

    const role = await this.getUserRole(userId, companyId);
    if (!this.canEdit(existing.status, role, userId, existing.createdById)) {
      throw new ForbiddenError('You do not have permission to edit this bill in its current status');
    }

    const sub = data.subtotal != null ? Number(data.subtotal) : existing.subtotal;
    const tax = data.taxAmount != null ? Number(data.taxAmount) : existing.taxAmount;
    const disc = data.discountAmount != null ? Number(data.discountAmount) : existing.discountAmount;

    const bill = await prisma.bill.update({
      where: { id: billId },
      data: {
        vendorId: data.vendorId ?? existing.vendorId,
        branchId: data.branchId ?? existing.branchId,
        subtotal: sub,
        taxAmount: tax,
        discountAmount: disc,
        total: sub + tax - disc,
        dueDate: data.dueDate ? new Date(data.dueDate) : existing.dueDate,
        currency: data.currency ?? existing.currency,
        exchangeRate: data.exchangeRate != null ? Number(data.exchangeRate) : existing.exchangeRate,
        status: data.status ?? existing.status,
      },
      include: { vendor: true },
    });

    return reply.send({ success: true, data: bill });
  }

  async deleteBill(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, billId } = request.params as { id: string; billId: string };
    const userId = (request.user as any).id;

    const existing = await prisma.bill.findUnique({ where: { id: billId } });
    if (!existing) throw new NotFoundError('Bill not found');

    const role = await this.getUserRole(userId, companyId);
    if (!this.canDelete(existing.status, role)) {
      throw new ForbiddenError('Only DRAFT bills can be deleted by authorized users');
    }

    await prisma.bill.update({ 
      where: { id: billId }, 
      data: { deletedAt: new Date() } 
    });
    
    return reply.send({ success: true, message: 'Bill deleted successfully' });
  }

  async verifyBill(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, billId } = request.params as { id: string; billId: string };
    const userId = (request.user as any).id;

    const bill = await prisma.bill.findUnique({ where: { id: billId } });
    if (!bill) throw new NotFoundError('Bill not found');

    const role = await this.getUserRole(userId, companyId);
    if (!this.canVerify(bill.status, role)) {
      throw new ForbiddenError('You do not have permission to verify this bill');
    }

    // Manager Verification Rule
    const canVerifyEntry = await RBACService.canManagerVerifyEntry(userId, bill.createdById, role);
    if (!canVerifyEntry) {
      throw new ForbiddenError('Managers can only verify documents created by their subordinates and cannot verify their own entries.');
    }

    const updated = await prisma.bill.update({
      where: { id: billId },
      data: { 
        status: 'VERIFIED',
        verifiedById: userId,
        verifiedAt: new Date()
      }
    });

    return reply.send({ success: true, data: updated });
  }

  async approveBill(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, billId } = request.params as { id: string; billId: string };
    const userId = (request.user as any).id;

    const bill = await prisma.bill.findUnique({ where: { id: billId }, include: { vendor: true } });
    if (!bill) throw new NotFoundError('Bill not found');

    const role = await this.getUserRole(userId, companyId);
    if (!this.canApprove(bill.status, role)) {
      throw new ForbiddenError('You do not have permission to approve this bill. Ensure it is VERIFIED first.');
    }

    const updated = await prisma.$transaction(async (tx: any) => {
      const b = await tx.bill.update({ 
        where: { id: billId }, 
        data: { 
          status: 'APPROVED',
          approvedById: userId,
          approvedAt: new Date()
        } 
      });
      
      // Auto-journal: Dr Expense / Cr Accounts Payable
      await JournalService.handleDocumentApproval('BILL', billId, userId, tx);
      
      return b;
    });

    return reply.send({ success: true, data: updated });
  }

  async rejectBill(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, billId } = request.params as { id: string; billId: string };
    const userId = (request.user as any).id;
    const { reason } = request.body as { reason: string };

    const bill = await prisma.bill.findUnique({ where: { id: billId } });
    if (!bill) throw new NotFoundError('Bill not found');

    const role = await this.getUserRole(userId, companyId);
    
    // Manager Verification Rule (also applies to rejection)
    const canVerifyEntry = await RBACService.canManagerVerifyEntry(userId, bill.createdById, role);
    if (!canVerifyEntry) {
      throw new ForbiddenError('Managers can only reject documents created by their subordinates and cannot reject their own entries.');
    }

    const updated = await prisma.bill.update({
      where: { id: billId },
      data: { 
        status: 'REJECTED',
        rejectedById: userId,
        rejectionReason: reason
      }
    });

    return reply.send({ success: true, data: updated });
  }
}
