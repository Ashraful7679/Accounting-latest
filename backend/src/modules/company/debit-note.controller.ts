import { FastifyRequest, FastifyReply } from 'fastify';
import { DebitNoteRepository } from '../../repositories/DebitNoteRepository';
import { SequenceService } from './sequence.service';
import { ValidationError, NotFoundError } from '../../middleware/errorHandler';
import prisma from '../../config/database';
import { SYSTEM_MODE } from '../../lib/systemMode';

export class DebitNoteController {
  async getDebitNotes(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const debitNotes = await DebitNoteRepository.findMany({ companyId });
    return reply.send({ success: true, data: debitNotes });
  }

  async getDebitNote(request: FastifyRequest, reply: FastifyReply) {
    const { debitNoteId } = request.params as { debitNoteId: string };
    const debitNote = await DebitNoteRepository.findById(debitNoteId);
    if (!debitNote) throw new NotFoundError('Debit Note not found');
    return reply.send({ success: true, data: debitNote });
  }

  async createDebitNote(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;
    const data = request.body as any;

    if (!data.lines || data.lines.length === 0) {
      throw new ValidationError('At least one line item is required');
    }

    const debitNoteNumber = await SequenceService.generateDocumentNumber(companyId, 'debit-note');

    // Calculate totals
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

    const debitNote = await DebitNoteRepository.create({
      debitNoteNumber,
      companyId,
      vendorId: data.vendorId,
      billId: data.billId || null,
      purchaseOrderId: data.purchaseOrderId || null,
      debitNoteDate: data.debitNoteDate || new Date(),
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

    return reply.status(201).send({ success: true, data: debitNote });
  }

  async updateDebitNote(request: FastifyRequest, reply: FastifyReply) {
    const { debitNoteId } = request.params as { debitNoteId: string };
    const data = request.body as any;

    const existing = await DebitNoteRepository.findById(debitNoteId);
    if (!existing) throw new NotFoundError('Debit Note not found');

    // Recalculate totals if lines provided
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

    const updated = await DebitNoteRepository.update(debitNoteId, data);
    return reply.send({ success: true, data: updated });
  }

  async deleteDebitNote(request: FastifyRequest, reply: FastifyReply) {
    const { debitNoteId } = request.params as { debitNoteId: string };
    const existing = await DebitNoteRepository.findById(debitNoteId);
    if (!existing) throw new NotFoundError('Debit Note not found');

    if (existing.status !== 'DRAFT') {
      throw new ValidationError('Only DRAFT Debit Notes can be deleted');
    }

    await DebitNoteRepository.delete(debitNoteId);
    return reply.send({ success: true });
  }

  async approveDebitNote(request: FastifyRequest, reply: FastifyReply) {
    const { debitNoteId } = request.params as { debitNoteId: string };
    const userId = (request.user as any).id;

    const debitNote = await DebitNoteRepository.findById(debitNoteId);
    if (!debitNote) throw new NotFoundError('Debit Note not found');

    if (debitNote.status !== 'DRAFT') {
      throw new ValidationError('Only DRAFT Debit Notes can be approved');
    }

    // If returnToStock, restore inventory
    if (debitNote.returnToStock && debitNote.purchaseOrderId) {
      if (SYSTEM_MODE === "LIVE") {
        for (const line of debitNote.lines) {
          if (line.productId) {
            await prisma.product.update({
              where: { id: line.productId },
              data: { stockAmount: { increment: line.quantity } }
            });
          }
        }
      }
    }

    const updated = await DebitNoteRepository.update(debitNoteId, {
      status: 'APPROVED',
      approvedById: userId
    });

    return reply.send({ success: true, data: updated });
  }

  async cancelDebitNote(request: FastifyRequest, reply: FastifyReply) {
    const { debitNoteId } = request.params as { debitNoteId: string };
    const { notes } = request.body as any;

    const debitNote = await DebitNoteRepository.findById(debitNoteId);
    if (!debitNote) throw new NotFoundError('Debit Note not found');

    if (!['DRAFT', 'APPROVED'].includes(debitNote.status)) {
      throw new ValidationError('Only DRAFT or APPROVED Debit Notes can be cancelled');
    }

    // If previously approved and had returnToStock, reverse inventory
    if (debitNote.status === 'APPROVED' && debitNote.returnToStock) {
      if (SYSTEM_MODE === "LIVE") {
        for (const line of debitNote.lines) {
          if (line.productId) {
            await prisma.product.update({
              where: { id: line.productId },
              data: { stockAmount: { decrement: line.quantity } }
            });
          }
        }
      }
    }

    const updated = await DebitNoteRepository.update(debitNoteId, {
      status: 'CANCELLED',
      notes: notes || debitNote.notes
    });

    return reply.send({ success: true, data: updated });
  }
}