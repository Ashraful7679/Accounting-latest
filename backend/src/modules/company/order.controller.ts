import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { PurchaseOrderRepository } from '../../repositories/PurchaseOrderRepository';
import { NotificationController } from './notification.controller';
import { NotFoundError, ForbiddenError } from '../../middleware/errorHandler';
import { BaseCompanyController } from './base.controller';

export class OrderController extends BaseCompanyController {
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

    delete updateData.companyId;
    delete updateData.poNumber;
    delete updateData.createdById;

    if (updateData.poDate) updateData.poDate = new Date(updateData.poDate);
    if (updateData.expectedDeliveryDate) updateData.expectedDeliveryDate = new Date(updateData.expectedDeliveryDate);

    const updatedPo = await PurchaseOrderRepository.update(poId, updateData);

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

    const allowedTransitions: Record<string, string[]> = {
      'DRAFT': ['APPROVED', 'REJECTED'],
      'REJECTED': ['DRAFT'],
      'APPROVED': ['SENT', 'REJECTED'],
      'SENT': ['RECEIVED', 'REJECTED'],
      'RECEIVED': ['CLOSED', 'REJECTED'],
      'CLOSED': []
    };

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
}
