import { FastifyRequest, FastifyReply } from 'fastify';
import { CreditNoteRepository } from '../../repositories/CreditNoteRepository';
import { SequenceService } from './sequence.service';
import { ValidationError, NotFoundError } from '../../middleware/errorHandler';
import prisma from '../../config/database';
import { SYSTEM_MODE } from '../../lib/systemMode';

export class CreditNoteController {
  async getCreditNotes(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const creditNotes = await CreditNoteRepository.findMany({ companyId });
    return reply.send({ success: true, data: creditNotes });
  }

  async getCreditNote(request: FastifyRequest, reply: FastifyReply) {
    const { creditNoteId } = request.params as { creditNoteId: string };
    const creditNote = await CreditNoteRepository.findById(creditNoteId);
    if (!creditNote) throw new NotFoundError('Credit Note not found');
    return reply.send({ success: true, data: creditNote });
  }

  async createCreditNote(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;
    const data = request.body as any;

    if (!data.lines || data.lines.length === 0) {
      throw new ValidationError('At least one line item is required');
    }

    const creditNoteNumber = await SequenceService.generateDocumentNumber(companyId, 'credit-note');

    let totalForeign = 0;
    let totalBDT = 0;
    let subtotal = 0;
    let taxAmount = 0;
    const exchangeRate = data.currency === 'BDT' ? 1 : (data.exchangeRate || 1);

    for (const line of data.lines) {
      const amount = (line.quantity || 0) * (line.unitPrice || 0);
      const taxAmt = amount * ((line.taxRate || 0) / 100);
      line.amount = amount;
      line.taxAmount = taxAmt;
      subtotal += amount;
      taxAmount += taxAmt;
      totalForeign += amount + taxAmt;
      totalBDT += (amount + taxAmt) * exchangeRate;
    }

    const creditNote = await CreditNoteRepository.create({
      creditNoteNumber,
      companyId,
      customerId: data.customerId,
      invoiceId: data.invoiceId || null,
      salesOrderId: data.salesOrderId || null,
      creditNoteDate: data.creditNoteDate || new Date(),
      dueDate: data.dueDate || null,
      currency: data.currency || 'BDT',
      exchangeRate,
      subtotal,
      taxAmount,
      totalForeign,
      totalBDT,
      status: data.status || 'DRAFT',
      reason: data.reason || null,
      notes: data.notes || null,
      returnToStock: data.returnToStock || false,
      createdById: userId,
      lines: data.lines
    });

    return reply.status(201).send({ success: true, data: creditNote });
  }

  async updateCreditNote(request: FastifyRequest, reply: FastifyReply) {
    const { creditNoteId } = request.params as { creditNoteId: string };
    const data = request.body as any;

    const existing = await CreditNoteRepository.findById(creditNoteId);
    if (!existing) throw new NotFoundError('Credit Note not found');

    if (data.lines) {
      let totalForeign = 0;
      let totalBDT = 0;
      let subtotal = 0;
      let taxAmount = 0;
      const exchangeRate = data.currency || existing.exchangeRate || 1;

      for (const line of data.lines) {
        const amount = (line.quantity || 0) * (line.unitPrice || 0);
        const taxAmt = amount * ((line.taxRate || 0) / 100);
        line.amount = amount;
        line.taxAmount = taxAmt;
        subtotal += amount;
        taxAmount += taxAmt;
        totalForeign += amount + taxAmt;
        totalBDT += (amount + taxAmt) * exchangeRate;
      }

      data.subtotal = subtotal;
      data.taxAmount = taxAmount;
      data.totalForeign = totalForeign;
      data.totalBDT = totalBDT;
    }

    const updated = await CreditNoteRepository.update(creditNoteId, data);
    return reply.send({ success: true, data: updated });
  }

  async deleteCreditNote(request: FastifyRequest, reply: FastifyReply) {
    const { creditNoteId } = request.params as { creditNoteId: string };
    const existing = await CreditNoteRepository.findById(creditNoteId);
    if (!existing) throw new NotFoundError('Credit Note not found');

    if (existing.status !== 'DRAFT') {
      throw new ValidationError('Only DRAFT Credit Notes can be deleted');
    }

    await CreditNoteRepository.delete(creditNoteId);
    return reply.send({ success: true });
  }

  async approveCreditNote(request: FastifyRequest, reply: FastifyReply) {
    const { creditNoteId } = request.params as { creditNoteId: string };
    const userId = (request.user as any).id;

    const creditNote = await CreditNoteRepository.findById(creditNoteId);
    if (!creditNote) throw new NotFoundError('Credit Note not found');

    if (creditNote.status !== 'DRAFT') {
      throw new ValidationError('Only DRAFT Credit Notes can be approved');
    }

    if (creditNote.returnToStock && creditNote.salesOrderId) {
      if (SYSTEM_MODE === "LIVE") {
        for (const line of creditNote.lines) {
          if (line.productId) {
            await prisma.product.update({
              where: { id: line.productId },
              data: { stockAmount: { increment: line.quantity } }
            });
          }
        }
      }
    }

    const updated = await CreditNoteRepository.update(creditNoteId, {
      status: 'APPROVED',
      approvedById: userId
    });

    return reply.send({ success: true, data: updated });
  }

  async cancelCreditNote(request: FastifyRequest, reply: FastifyReply) {
    const { creditNoteId } = request.params as { creditNoteId: string };
    const { notes } = request.body as any;

    const creditNote = await CreditNoteRepository.findById(creditNoteId);
    if (!creditNote) throw new NotFoundError('Credit Note not found');

    if (!['DRAFT', 'APPROVED'].includes(creditNote.status)) {
      throw new ValidationError('Only DRAFT or APPROVED Credit Notes can be cancelled');
    }

    if (creditNote.status === 'APPROVED' && creditNote.returnToStock) {
      if (SYSTEM_MODE === "LIVE") {
        for (const line of creditNote.lines) {
          if (line.productId) {
            await prisma.product.update({
              where: { id: line.productId },
              data: { stockAmount: { decrement: line.quantity } }
            });
          }
        }
      }
    }

    const updated = await CreditNoteRepository.update(creditNoteId, {
      status: 'CANCELLED',
      notes: notes || creditNote.notes
    });

    return reply.send({ success: true, data: updated });
  }
}