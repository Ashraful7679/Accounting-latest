import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { BaseCompanyController } from './base.controller';
import { SequenceService } from './sequence.service';

export class RequisitionController extends BaseCompanyController {
  
  async getPurchaseRequisitions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: companyId } = request.params as { id: string };
      const prs = await prisma.purchaseRequisition.findMany({
        where: { companyId, deletedAt: null },
        include: { vendor: true, lines: true },
        orderBy: { createdAt: 'desc' }
      });

      // Map supplier to vendor relation if needed by frontend
      const mappedPrs = prs.map((pr: any) => ({
        ...pr,
        supplier: pr.vendor
      }));

      return reply.send({ success: true, data: mappedPrs });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: { message: 'Failed to fetch purchase requisitions' } });
    }
  }

  async getPurchaseRequisition(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: companyId, prId } = request.params as { id: string, prId: string };
      const pr = await prisma.purchaseRequisition.findFirst({
        where: { id: prId, companyId, deletedAt: null },
        include: { vendor: true, lines: true }
      });

      if (!pr) return reply.status(404).send({ success: false, error: { message: 'Not found' } });
      
      return reply.send({ success: true, data: { ...pr, supplier: pr.vendor } });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: { message: 'Failed to fetch purchase requisition' } });
    }
  }

  async createPurchaseRequisition(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: companyId } = request.params as { id: string };
      const data = request.body as any;

      const userId = (request.user as any)?.userId || null;

      const newPR = await prisma.$transaction(async (tx) => {
        const prNumber = await SequenceService.generateDocumentNumber(companyId, 'purchase-requisition', tx);

        return await tx.purchaseRequisition.create({
          data: {
            prNumber,
            companyId,
            vendorId: data.supplierId || null,
            prDate: data.prDate ? new Date(data.prDate) : new Date(),
            expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
            currency: data.currency || 'BDT',
            exchangeRate: data.exchangeRate || 1,
            totalForeign: data.totalForeign || 0,
            totalBDT: data.lines.reduce((sum: number, l: any) => sum + (l.total || 0), 0),
            notes: data.notes,
            status: 'DRAFT',
            createdById: userId,
            lines: {
              create: data.lines.map((l: any) => ({
                productId: l.productId || null,
                itemDescription: l.itemDescription,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                total: l.quantity * l.unitPrice
              }))
            }
          },
          include: { vendor: true, lines: true }
        });
      });

      return reply.status(201).send({ success: true, data: { ...newPR, supplier: newPR.vendor } });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: { message: error.message || 'Failed to create purchase requisition' } });
    }
  }

  async updatePurchaseRequisition(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: companyId, prId } = request.params as { id: string, prId: string };
      const data = request.body as any;

      const existing = await prisma.purchaseRequisition.findFirst({
        where: { id: prId, companyId, deletedAt: null }
      });

      if (!existing) return reply.status(404).send({ success: false, error: { message: 'Not found' } });
      if (existing.status !== 'DRAFT' && existing.status !== 'REJECTED') {
        return reply.status(400).send({ success: false, error: { message: 'Can only edit draft or rejected requisitions' } });
      }

      await prisma.$transaction(async (tx) => {
        await tx.purchaseRequisitionLine.deleteMany({
          where: { purchaseRequisitionId: prId }
        });

        await tx.purchaseRequisition.update({
          where: { id: prId },
          data: {
            vendorId: data.supplierId || null,
            prDate: data.prDate ? new Date(data.prDate) : existing.prDate,
            expectedDate: data.expectedDate ? new Date(data.expectedDate) : existing.expectedDate,
            currency: data.currency || existing.currency,
            exchangeRate: data.exchangeRate || existing.exchangeRate,
            totalBDT: data.lines.reduce((sum: number, l: any) => sum + (l.total || 0), 0),
            notes: data.notes || existing.notes,
            lines: {
              create: data.lines.map((l: any) => ({
                productId: l.productId || null,
                itemDescription: l.itemDescription,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                total: l.quantity * l.unitPrice
              }))
            }
          }
        });
      });

      return reply.send({ success: true, message: 'Updated successfully' });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: { message: 'Failed to update' } });
    }
  }

  async deletePurchaseRequisition(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: companyId, prId } = request.params as { id: string, prId: string };
      const pr = await prisma.purchaseRequisition.findFirst({
        where: { id: prId, companyId, deletedAt: null }
      });

      if (!pr) return reply.status(404).send({ success: false, error: { message: 'Not found' } });

      await prisma.purchaseRequisition.update({
        where: { id: prId },
        data: { deletedAt: new Date() }
      });

      return reply.send({ success: true, message: 'Deleted successfully' });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: { message: 'Failed to delete' } });
    }
  }

  async submitPurchaseRequisition(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: companyId, prId } = request.params as { id: string, prId: string };
      const pr = await prisma.purchaseRequisition.findFirst({
        where: { id: prId, companyId, deletedAt: null }
      });

      if (!pr) return reply.status(404).send({ success: false, error: { message: 'Not found' } });
      if (pr.status !== 'DRAFT') {
        return reply.status(400).send({ success: false, error: { message: 'Can only submit draft requisitions' } });
      }

      await prisma.purchaseRequisition.update({
        where: { id: prId },
        data: { status: 'PENDING' }
      });

      return reply.send({ success: true, message: 'Submitted successfully' });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: { message: 'Failed to submit' } });
    }
  }

  async approvePurchaseRequisition(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id: companyId, prId } = request.params as { id: string, prId: string };
      const userId = (request.user as any)?.userId || null;
      
      const pr = await prisma.purchaseRequisition.findFirst({
        where: { id: prId, companyId, deletedAt: null }
      });

      if (!pr) return reply.status(404).send({ success: false, error: { message: 'Not found' } });
      if (pr.status !== 'PENDING') {
        return reply.status(400).send({ success: false, error: { message: 'Can only approve pending requisitions' } });
      }

      await prisma.purchaseRequisition.update({
        where: { id: prId },
        data: { 
          status: 'APPROVED',
          approvedById: userId
        }
      });

      return reply.send({ success: true, message: 'Approved successfully' });
    } catch (error: any) {
      request.log.error(error);
      return reply.status(500).send({ success: false, error: { message: 'Failed to approve' } });
    }
  }
}
