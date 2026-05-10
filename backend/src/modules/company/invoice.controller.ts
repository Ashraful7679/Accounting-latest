import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { TransactionRepository } from '../../repositories/TransactionRepository';
import { NotificationController } from './notification.controller';
import { NotFoundError, ForbiddenError, ValidationError } from '../../middleware/errorHandler';
import { BaseCompanyController } from './base.controller';
import { JournalService } from '../accounting/journal.service';
import { InventoryService } from './inventory.service';
import { checkOptimisticLock } from '../../lib/optimisticLock';
import { RBACService } from './rbac.service';

export class InvoiceController extends BaseCompanyController {
  // ============ INVOICES ============
  async getInvoices(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { type, page = '1', limit = '20', search, status } = request.query as { 
      type?: string;
      page?: string;
      limit?: string;
      search?: string;
      status?: string;
    };
    
    const result = await TransactionRepository.findInvoices({
      companyId,
      type: type?.toUpperCase(),
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      status,
    });
    
    return reply.send({ 
      success: true, 
      data: {
        data: result.data, 
        pagination: result.pagination 
      }
    });
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

      // Calculate Subtotal and Tax considering Net Quantity (Quantity - Returns - Damaged)
      let subtotal = 0;
      let taxAmount = 0;
      const linesData = data.lines.map((l: any) => {
        const qty = Number(l.quantity || 0);
        const retQty = Number(l.returnQuantity || 0);
        const dmgQty = Number(l.damagedQuantity || 0);
        const netQty = Math.max(0, qty - retQty - dmgQty);
        
        const lineSubtotal = netQty * Number(l.unitPrice || 0);
        const lineTax = lineSubtotal * (Number(l.taxRate || 0) / 100);
        
        subtotal += lineSubtotal;
        taxAmount += lineTax;

        return {
          productId: l.productId || null,
          description: l.description,
          quantity: qty,
          unitPrice: Number(l.unitPrice || 0),
          taxRate: Number(l.taxRate || 0),
          taxAmount: lineTax,
          amount: lineSubtotal + lineTax,
          returnQuantity: retQty,
          damagedQuantity: dmgQty,
        };
      });

      const total = subtotal + taxAmount + (Number(data.otherExpenses) || 0) - (Number(data.discountAmount) || 0);
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
          create: linesData
        },
        branchId: data.branchId || null,
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
    const invoice = await prisma.invoice.findUnique({ 
      where: { id: invoiceId },
      include: { lines: true }
    });

    if (!invoice) throw new NotFoundError('Invoice not found');

    if (!this.canEdit(invoice.status, role)) {
      throw new ForbiddenError('Cannot edit this invoice in current status');
    }

    if (data.lines) {
      let subtotal = 0;
      let taxAmount = 0;
      
      const linesToCreate = data.lines.map((l: any) => {
        const qty = Number(l.quantity || 0);
        const retQty = Number(l.returnQuantity || 0);
        const dmgQty = Number(l.damagedQuantity || 0);
        const netQty = Math.max(0, qty - retQty - dmgQty);
        
        const lineSubtotal = netQty * Number(l.unitPrice || 0);
        const lineTax = lineSubtotal * (Number(l.taxRate || 0) / 100);
        
        subtotal += lineSubtotal;
        taxAmount += lineTax;

        return {
          productId: l.productId || null,
          description: l.description,
          quantity: qty,
          unitPrice: Number(l.unitPrice || 0),
          taxRate: Number(l.taxRate || 0),
          taxAmount: lineTax,
          amount: lineSubtotal + lineTax,
          returnQuantity: retQty,
          damagedQuantity: dmgQty,
        };
      });

      const total = subtotal + taxAmount + (Number(data.otherExpenses) ?? Number(invoice.otherExpenses)) - (Number(data.discountAmount) ?? Number(invoice.discountAmount));
      const bdtAmount = total * (data.exchangeRate || invoice.exchangeRate || 1);

      data.subtotal = subtotal;
      data.taxAmount = taxAmount;
      data.total = bdtAmount;
      data.lines = {
        deleteMany: {},
        create: linesToCreate
      };
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
        dns: data.dnIds ? { set: [], connect: data.dnIds.map((id: string) => ({ id })) } : undefined,
        grns: data.grnIds ? { set: [], connect: data.grnIds.map((id: string) => ({ id })) } : undefined,
      },
      include: { lines: true, dns: true, grns: true },
    });

    return reply.send({ success: true, data: updated });
  }

  async deleteInvoice(request: FastifyRequest, reply: FastifyReply) {
    const { invoiceId } = request.params as { invoiceId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;
    const { reverse = false } = request.body as { reverse?: boolean };

    const role = await this.getUserRole(userId, companyId);
    const invoice = await prisma.invoice.findUnique({ 
      where: { id: invoiceId },
      include: { lines: true }
    });

    if (!invoice) throw new NotFoundError('Invoice not found');

    if (!this.canDelete(invoice.status, role)) {
      throw new ForbiddenError('Cannot delete this invoice');
    }

    // If reverse=true, create reversal journal instead of hard delete
    if (reverse) {
      return this.reverseInvoice(invoice, companyId, userId, reply);
    }

    // Original hard delete behavior (for draft invoices only)
    await prisma.$transaction(async (tx) => {
      // 1. Revert Order Quantities
      if (invoice.salesOrderId) {
        for (const line of invoice.lines) {
          if (line.productId) {
            await tx.salesOrderLine.updateMany({
              where: { salesOrderId: invoice.salesOrderId, productId: line.productId },
              data: {
                invoicedQuantity: {
                  decrement: line.quantity - (line.returnQuantity || 0) - (line.damagedQuantity || 0)
                }
              }
            });
          }
        }
      }
      if (invoice.purchaseOrderId) {
        for (const line of invoice.lines) {
          if (line.productId) {
            await tx.purchaseOrderLine.updateMany({
              where: { purchaseOrderId: invoice.purchaseOrderId, productId: line.productId },
              data: {
                billedQuantity: {
                  decrement: line.quantity - (line.returnQuantity || 0) - (line.damagedQuantity || 0)
                }
              }
            });
          }
        }
      }

      // 2. Delete Journal if exists
      if (invoice.journalId) {
        await tx.journalEntry.delete({ where: { id: invoice.journalId } });
      }

      // 3. Delete Invoice
      await tx.invoice.delete({ where: { id: invoiceId } });
    });

    return reply.send({ success: true, message: 'Invoice deleted and quantities reverted' });
  }

  /**
   * POST /:id/invoices/:invoiceId/reverse
   * Always creates an accounting reversal. Never performs a hard delete.
   * This is the dedicated handler for the /reverse route.
   */
  async reverseInvoiceRoute(request: FastifyRequest, reply: FastifyReply) {
    const { invoiceId } = request.params as { invoiceId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { lines: true },
    });

    if (!invoice) throw new NotFoundError('Invoice not found');

    return this.reverseInvoice(invoice, companyId, userId, reply);
  }

  private async reverseInvoice(invoice: any, companyId: string, userId: string, reply: FastifyReply) {
    const reversalNumber = await this.generateDocumentNumber(companyId, 'invoice');
    const revPrefix = invoice.type === 'SALES' ? 'RVS' : 'RVP';

    await prisma.$transaction(async (tx) => {
      // 1. Create reversal invoice
      const reversal = await (tx.invoice as any).create({
        data: {
          invoiceNumber: `${revPrefix}-${reversalNumber}`,
          companyId,
          customerId: invoice.customerId,
          vendorId: invoice.vendorId,
          salesOrderId: invoice.salesOrderId,
          purchaseOrderId: invoice.purchaseOrderId,
          type: invoice.type,
          invoiceDate: new Date(),
          dueDate: new Date(),
          currency: invoice.currency,
          exchangeRate: invoice.exchangeRate,
          subtotal: -invoice.subtotal,
          totalBDT: -(invoice.totalBDT || 0),
          totalForeign: -(invoice.totalForeign || 0),
          taxAmount: -(invoice.taxAmount || 0),
          discountAmount: -(invoice.discountAmount || 0),
          status: 'APPROVED',
          reference: `Reversal of ${invoice.invoiceNumber}`,
          originalInvoiceId: invoice.id
        }
      });

      // 2. Create reversal lines
      for (const line of invoice.lines || []) {
        await tx.invoiceLine.create({
          data: {
            invoiceId: reversal.id,
            productId: line.productId,
            description: line.description,
            quantity: -line.quantity,
            unitPrice: line.unitPrice,
            taxRate: line.taxRate,
            amount: -(line.amount || line.total || 0),
          }
        });
      }

      // 3. Create reversal journal entry
      if (invoice.journalId) {
        const originalJournal = await tx.journalEntry.findUnique({
          where: { id: invoice.journalId }
        });

        if (originalJournal) {
          const reversalEntry = await (tx.journalEntry as any).create({
            data: {
              entryNumber: `REV-${originalJournal.entryNumber}`,
              companyId,
              date: new Date(),
              description: `Reversal of Journal ${originalJournal.entryNumber} (Invoice ${invoice.invoiceNumber})`,
              totalDebit: originalJournal.totalCredit,
              totalCredit: originalJournal.totalDebit,
              status: 'APPROVED',
              reference: `Reversal of ${originalJournal.entryNumber}`
            }
          });

          // Reverse all journal lines
          const originalLines = await tx.journalEntryLine.findMany({
            where: { journalEntryId: invoice.journalId }
          });

          for (const line of originalLines) {
            await tx.journalEntryLine.create({
              data: {
                journalEntryId: reversalEntry.id,
                accountId: line.accountId,
                debitBase: line.creditBase,
                creditBase: line.debitBase,
                debit: line.credit,
                credit: line.debit
              }
            });
          }

          // Update original invoice to reference reversal
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { journalId: reversalEntry.id }
          });
        }
      }

      // 4. Revert inventory if applicable
      if (invoice.type === 'SALES') {
        for (const line of invoice.lines) {
          if (line.productId && !invoice.isService) {
            await tx.product.update({
              where: { id: line.productId },
              data: { stockAmount: { increment: line.quantity } }
            });
          }
        }
      }
    });

    return reply.send({ 
      success: true, 
      message: `Reversal invoice created for ${invoice.invoiceNumber}`,
      data: { reversalNumber: `${revPrefix}-${reversalNumber}` }
    });
  }

  async delinkDN(request: FastifyRequest, reply: FastifyReply) {
    const { invoiceId } = request.params as { invoiceId: string };
    const { dnId } = request.body as { dnId: string };

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        dns: { disconnect: { id: dnId } }
      },
      include: { dns: true }
    });

    return reply.send({ success: true, data: updated });
  }

  async delinkGRN(request: FastifyRequest, reply: FastifyReply) {
    const { invoiceId } = request.params as { invoiceId: string };
    const { grnId } = request.body as { grnId: string };

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        grns: { disconnect: { id: grnId } }
      },
      include: { grns: true }
    });

    return reply.send({ success: true, data: updated });
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

    // Manager Verification Rule
    const canVerifyEntry = await RBACService.canManagerVerifyEntry(userId, invoice.createdById, role);
    if (!canVerifyEntry) {
      throw new ForbiddenError('Managers can only verify documents created by their subordinates and cannot verify their own entries.');
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
          const grnNumber = await this.generateDocumentNumber(companyId, 'grn', tx);
          const grn = await tx.gRN.create({
            data: {
              grnNumber,
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
          // Auto-journal for GRN
          await JournalService.handleDocumentApproval('GRN', grn.id, userId, tx);
        } else if (invoice.type === 'SALES' && !hasDN) {
          const dnNumber = await this.generateDocumentNumber(companyId, 'dn', tx);
          const dn = await tx.dN.create({
            data: {
              dnNumber,
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
          // Auto-journal for DN
          await JournalService.handleDocumentApproval('DN', dn.id, userId, tx);
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
          include: { lines: true, dns: true, grns: true }
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

        // 3. Delete Journal Entries (Invoice + Auto-generated DN/GRN)
        if (inv.journalId) {
          await tx.journalEntry.delete({ where: { id: inv.journalId } });
        }
        // Also delete DN/GRN journals if they were auto-generated
        for (const dn of (inv.dns || [])) {
          if (dn.journalId) {
            await tx.journalEntry.delete({ where: { id: dn.journalId } }).catch(() => {});
          }
        }
        for (const grn of (inv.grns || [])) {
          if (grn.journalId) {
            await tx.journalEntry.delete({ where: { id: grn.journalId } }).catch(() => {});
          }
        }

        return inv;
      });

      return reply.send({ success: true, data: updated });
    } catch (error: any) {
      return reply.status(error.statusCode || 500).send({ success: false, error: error.message });
    }
  }
}
