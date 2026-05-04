import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { TransactionRepository } from '../../repositories/TransactionRepository';
import { NotificationController } from './notification.controller';
import { NotFoundError, ForbiddenError, ValidationError } from '../../middleware/errorHandler';
import { BaseCompanyController } from './base.controller';
import { JournalService } from '../accounting/journal.service';
import { InventoryService } from './inventory.service';

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
      const total = subtotal + taxAmount + (Number(data.otherExpenses) || 0);
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
        salesOrderId: data.salesOrderId || null,
        purchaseOrderId: data.purchaseOrderId || null,
        type: data.type || 'SALES',
        currency: data.currency || 'BDT',
        exchangeRate: data.exchangeRate || 1,
        invoiceDate: invoiceDate,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        subtotal,
        taxAmount,
        discountAmount: Number(data.discountAmount) || 0,
        otherExpenses: Number(data.otherExpenses) || 0,
        total: bdtAmount,
        createdById: userId,
        lines: {
          create: data.lines.map((l: any) => ({
            productId: l.productId || null,
            description: l.description,
            quantity: Number(l.quantity || 1),
            unitPrice: Number(l.unitPrice || 0),
            taxRate: Number(l.taxRate || 0),
            taxAmount: Number(l.quantity || 0) * Number(l.unitPrice || 0) * (Number(l.taxRate || 0) / 100),
            amount: Number(l.quantity || 0) * Number(l.unitPrice || 0) * (1 + (Number(l.taxRate || 0) / 100)),
            returnQuantity: Number(l.returnQuantity) || 0,
            damagedQuantity: Number(l.damagedQuantity) || 0,
          })),
        },
        dns: data.dnIds ? { connect: data.dnIds.map((id: string) => ({ id })) } : undefined,
        grns: data.grnIds ? { connect: data.grnIds.map((id: string) => ({ id })) } : undefined,
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
      const total = subtotal + taxAmount + (Number(data.otherExpenses) || Number(invoice.otherExpenses) || 0) - (Number(data.discountAmount) || Number(invoice.discountAmount) || 0);
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
        salesOrderId: data.salesOrderId || undefined,
        purchaseOrderId: data.purchaseOrderId || undefined,
        lines: data.lines ? {
          deleteMany: {},
          create: data.lines.map((l: any) => ({
            productId: l.productId || null,
            description: l.description,
            quantity: Number(l.quantity || 1),
            unitPrice: Number(l.unitPrice || 0),
            taxRate: Number(l.taxRate || 0),
            taxAmount: Number(l.quantity || 0) * Number(l.unitPrice || 0) * (Number(l.taxRate || 0) / 100),
            amount: l.quantity * l.unitPrice * (1 + (l.taxRate || 0) / 100),
            returnQuantity: Number(l.returnQuantity) || 0,
            damagedQuantity: Number(l.damagedQuantity) || 0,
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
          include: { lines: true, dns: true, grns: true }
        });

        // 1. Handle Order Quantity Updates (Invoiced/Billed Qty)
        if (inv.salesOrderId) {
          for (const line of inv.lines) {
            if (line.productId) {
              await tx.salesOrderLine.updateMany({
                where: { salesOrderId: inv.salesOrderId, productId: line.productId },
                data: {
                  invoicedQuantity: {
                    increment: line.quantity - (line.returnQuantity || 0) - (line.damagedQuantity || 0)
                  }
                }
              });
            }
          }
        }
        if (inv.purchaseOrderId) {
          for (const line of inv.lines) {
            if (line.productId) {
              await tx.purchaseOrderLine.updateMany({
                where: { purchaseOrderId: inv.purchaseOrderId, productId: line.productId },
                data: {
                  billedQuantity: {
                    increment: line.quantity - (line.returnQuantity || 0) - (line.damagedQuantity || 0)
                  }
                }
              });
            }
          }
        }

        // 2. Generate GRN/DN if not already present
        const hasDN = inv.dns && inv.dns.length > 0;
        const hasGRN = inv.grns && inv.grns.length > 0;

        if (invoice.type === 'PURCHASE' && !hasGRN) {
          const grn = await tx.gRN.create({
            data: {
              grnNumber: `GRN-${Date.now()}`,
              companyId,
              invoiceId: invoice.id,
              status: 'RECEIVED',
              lines: {
                create: invoice.lines.map((l: any) => ({
                  productId: l.productId,
                  quantity: l.quantity,
                  unitPrice: l.unitPrice
                }))
              }
            }
          });
          await InventoryService.processGRN(tx, grn.id);
        } else if (invoice.type === 'SALES' && !hasDN) {
          const dn = await tx.dN.create({
            data: {
              dnNumber: `DN-${Date.now()}`,
              companyId,
              invoiceId: invoice.id,
              status: 'SHIPPED',
              lines: {
                create: invoice.lines.map((l: any) => ({
                  productId: l.productId,
                  quantity: l.quantity
                }))
              }
            }
          });
          await InventoryService.processDN(tx, dn.id);
        }

        // 3. Automated Financial Journaling
        await JournalService.handleDocumentApproval('INVOICE', invoiceId, userId, tx);

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

  async revertInvoice(request: FastifyRequest, reply: FastifyReply) {
    const { invoiceId } = request.params as { invoiceId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;

    try {
      const role = await this.getUserRole(userId, companyId);
      if (role !== 'Owner' && role !== 'Admin') {
        throw new ForbiddenError('Only Owners or Admins can revert approved invoices');
      }

      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { lines: true }
      });

      if (!invoice) throw new NotFoundError('Invoice not found');
      if (invoice.status !== 'APPROVED') {
        throw new ValidationError('Only approved invoices can be reverted');
      }

      const updated = await prisma.$transaction(async (tx: any) => {
        // 1. Revert status
        const inv = await tx.invoice.update({
          where: { id: invoiceId },
          data: { status: 'DRAFT', approvedById: null, approvedAt: null },
          include: { lines: true }
        });

        // 2. Revert Order Quantity Updates
        if (inv.salesOrderId) {
          for (const line of inv.lines) {
            if (line.productId) {
              await tx.salesOrderLine.updateMany({
                where: { salesOrderId: inv.salesOrderId, productId: line.productId },
                data: {
                  invoicedQuantity: {
                    decrement: line.quantity - (line.returnQuantity || 0) - (line.damagedQuantity || 0)
                  }
                }
              });
            }
          }
        }
        if (inv.purchaseOrderId) {
          for (const line of inv.lines) {
            if (line.productId) {
              await tx.purchaseOrderLine.updateMany({
                where: { purchaseOrderId: inv.purchaseOrderId, productId: line.productId },
                data: {
                  billedQuantity: {
                    decrement: line.quantity - (line.returnQuantity || 0) - (line.damagedQuantity || 0)
                  }
                }
              });
            }
          }
        }

        // 3. Delete Journal Entries
        if (inv.journalId) {
          await tx.journalEntry.delete({
            where: { id: inv.journalId }
          });
        }

        return inv;
      });

      return reply.send({ success: true, data: updated });
    } catch (error: any) {
      return reply.status(error.statusCode || 500).send({ success: false, error: error.message });
    }
  }
}
