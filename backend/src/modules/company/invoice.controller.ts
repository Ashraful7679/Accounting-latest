import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { TransactionRepository } from '../../repositories/TransactionRepository';
import { NotificationController } from './notification.controller';
import { NotFoundError, ForbiddenError, ValidationError } from '../../middleware/errorHandler';
import { BaseCompanyController } from './base.controller';

export class InvoiceController extends BaseCompanyController {
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
      const invoiceNumber = await this.generateDocumentNumber(companyId, 'invoice');

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

      const role = await this.getUserRole(userId, companyId);
      const isOwnerOrAdmin = role === 'Owner' || role === 'Admin';
      
      const invoiceDate = new Date(data.invoiceDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);

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

    if (data.lines) {
      const subtotal = data.lines.reduce((sum: number, line: any) => sum + (line.quantity * line.unitPrice), 0);
      const taxAmount = data.lines.reduce((sum: number, line: any) => sum + (line.quantity * line.unitPrice * (line.taxRate || 0) / 100), 0);
      const total = subtotal + taxAmount;
      const bdtAmount = total * (data.exchangeRate || invoice.exchangeRate || 1);

      data.subtotal = subtotal;
      data.taxAmount = taxAmount;
      data.total = bdtAmount;
    }

    const { description, ...sanitizedData } = data;

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        ...sanitizedData,
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
    if (role !== 'Accountant' && role !== 'Owner' && role !== 'Admin') {
      throw new ForbiddenError('Insufficient permissions to submit invoices');
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

    const role = await this.getUserRole(userId, companyId);
    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });

    if (!invoice) throw new NotFoundError('Invoice not found');

    if (!this.canVerify(invoice.status, role)) {
      throw new ForbiddenError(`Cannot verify this invoice from current status: ${invoice.status}`);
    }

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

    if (invoice.status !== 'REJECTED') {
      throw new ForbiddenError('Can only retrieve rejected invoices');
    }

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
      const role = await this.getUserRole(userId, companyId);
      const invoice = await prisma.invoice.findUnique({ 
        where: { id: invoiceId },
        include: { lines: true } 
      });

      if (!invoice) throw new NotFoundError('Invoice not found');

      if (!this.canApprove(invoice.status, role)) {
        throw new ForbiddenError(`Cannot approve this invoice from current status: ${invoice.status}`);
      }

      const updated = await prisma.$transaction(async (tx: any) => {
        const inv = await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            status: 'APPROVED',
            approvedById: userId,
            approvedAt: new Date(),
          },
        });

        await TransactionRepository.generateInvoiceJournal(tx, invoice, companyId, userId);

        return inv;
      });

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
}
