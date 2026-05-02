import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { PurchaseOrderRepository } from '../../repositories/PurchaseOrderRepository';
import { SalesOrderRepository } from '../../repositories/SalesOrderRepository';
import { NotificationController } from './notification.controller';
import { InventoryService } from './inventory.service';
import { NotFoundError, ForbiddenError } from '../../middleware/errorHandler';
import { BaseCompanyController } from './base.controller';

export class OrderController extends BaseCompanyController {
  // ============ SALES ORDERS ============
  async getSalesOrders(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const sos = await SalesOrderRepository.findMany({ companyId });
    return reply.send({ success: true, data: sos });
  }

  async createSalesOrder(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { 
      customerId, lcId, orderDate, expectedDeliveryDate, 
      currency, exchangeRate, totalBDT, status, lines, 
      createdById, purchaseOrderIds 
    } = request.body as any;

    const soNumber = await this.generateDocumentNumber(companyId, 'so');
    
    const so = await SalesOrderRepository.create({
      soNumber,
      companyId,
      customerId,
      lcId,
      orderDate: orderDate ? new Date(orderDate) : undefined,
      expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
      currency,
      exchangeRate,
      totalBDT,
      status: status || 'DRAFT',
      createdById,
      lines,
      purchaseOrderIds
    });

    await NotificationController.logActivity({
      companyId,
      entityType: 'sales_order',
      entityId: so.id,
      action: 'CREATED',
      performedById: (request.user as any).id,
      metadata: { docNumber: soNumber }
    });

    return reply.status(201).send({ success: true, data: so });
  }

  async updateSalesOrder(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, soId } = request.params as { id: string, soId: string };
    const updateData = request.body as any;
    const userId = (request.user as any).id;

    const so = await (prisma as any).salesOrder.findUnique({ where: { id: soId } });
    if (!so) throw new NotFoundError('Sales Order not found');

    const role = await this.getUserRole(userId, companyId);
    if (!this.canEdit(so.status, role)) {
      throw new ForbiddenError('Cannot edit this sales order in current status');
    }

    delete updateData.companyId;
    delete updateData.soNumber;
    delete updateData.createdById;

    if (updateData.orderDate) updateData.orderDate = new Date(updateData.orderDate);
    if (updateData.expectedDeliveryDate) updateData.expectedDeliveryDate = new Date(updateData.expectedDeliveryDate);

    const updatedSo = await SalesOrderRepository.update(soId, updateData);

    await NotificationController.logActivity({
      companyId,
      entityType: 'sales_order',
      entityId: updatedSo.id,
      action: 'UPDATED',
      performedById: userId,
      metadata: { docNumber: updatedSo.soNumber }
    });

    return reply.send({ success: true, data: updatedSo });
  }

  async assignPurchaseOrder(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, soId } = request.params as { id: string, soId: string };
    const { poId, action } = request.body as { poId: string, action: 'connect' | 'disconnect' };
    const userId = (request.user as any).id;

    let updated;
    if (action === 'connect') {
      updated = await SalesOrderRepository.assignPurchaseOrder(soId, poId);
    } else {
      updated = await SalesOrderRepository.unassignPurchaseOrder(soId, poId);
    }

    await NotificationController.logActivity({
      companyId,
      entityType: 'sales_order',
      entityId: soId,
      action: action === 'connect' ? 'LINK_PO' : 'UNLINK_PO',
      performedById: userId,
      metadata: { poId }
    });

    return reply.send({ success: true, data: updated });
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

    const updated = await prisma.$transaction(async (tx: any) => {
      const upd = await tx.purchaseOrder.update({
        where: { id: poId },
        data: updateData,
        include: {
          supplier: true,
          lc: true,
          lines: true
        }
      });

      // Update Stock if RECEIVED
      if (newStatus === 'RECEIVED' && po.status !== 'RECEIVED') {
        for (const line of upd.lines) {
          if (line.productId) {
            await tx.product.update({
              where: { id: line.productId },
              data: {
                stockAmount: {
                  increment: Number(line.quantity || 0)
                }
              }
            });
          }
        }
      }

      return upd;
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

  async assignSalesOrder(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, poId } = request.params as { id: string, poId: string };
    const { soId, action } = request.body as { soId: string, action: 'connect' | 'disconnect' };
    const userId = (request.user as any).id;

    const updated = await PurchaseOrderRepository.assignSalesOrder(poId, soId, action);

    await NotificationController.logActivity({
      companyId,
      entityType: 'purchase_order',
      entityId: poId,
      action: action === 'connect' ? 'LINK_SO' : 'UNLINK_SO',
      performedById: userId,
      metadata: { soId }
    });

    return reply.send({ success: true, data: updated });
  }

  async getDeliveryChallans(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const dns = await (prisma as any).dN.findMany({
      where: { companyId },
      include: { salesOrder: true, lines: { include: { product: true } } },
      orderBy: { createdAt: 'desc' }
    });
    return reply.send({ success: true, data: dns });
  }

  async generateDeliveryChallan(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, soId } = request.params as { id: string, soId: string };
    const userId = (request.user as any).id;

    const so = await (prisma as any).salesOrder.findUnique({
      where: { id: soId },
      include: { lines: true }
    });

    if (!so) throw new NotFoundError('Sales Order not found');

    const dnNumber = await this.generateDocumentNumber(companyId, 'dn');

    const dn = await (prisma as any).dN.create({
      data: {
        dnNumber,
        companyId,
        salesOrderId: soId,
        shipmentDate: new Date(),
        status: 'SHIPPED',
        lines: {
          create: so.lines.map((line: any) => ({
            productId: line.productId,
            quantity: line.quantity
          }))
        }
      },
      include: { lines: true }
    });

    await prisma.$transaction(async (tx: any) => {
      await InventoryService.processDN(tx, dn.id);
    });

    await NotificationController.logActivity({
      companyId,
      entityType: 'delivery_note',
      entityId: dn.id,
      action: 'CREATED',
      performedById: userId,
      metadata: { docNumber: dnNumber, soNumber: so.soNumber }
    });

    return reply.status(201).send({ success: true, data: dn });
  }
}
