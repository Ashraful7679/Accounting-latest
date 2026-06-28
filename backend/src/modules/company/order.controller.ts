import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { PurchaseOrderRepository } from '../../repositories/PurchaseOrderRepository';
import { SalesOrderRepository } from '../../repositories/SalesOrderRepository';
import { NotificationController } from './notification.controller';
import { InventoryService } from './inventory.service';
import { NotFoundError, ForbiddenError, ValidationError, OptimisticLockError } from '../../middleware/errorHandler';
import { BaseCompanyController } from './base.controller';
import { JournalService } from '../accounting/journal.service';
import { checkOptimisticLock } from '../../lib/optimisticLock';

export class OrderController extends BaseCompanyController {
  // ============ SALES ORDERS ============
  async getSalesOrders(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;
    await this.requirePermission(userId, companyId, 'sales.orders', 'view');

    const { page = '1', limit = '20', currency, search, status } = request.query as { 
      page?: string; 
      limit?: string; 
      currency?: string;
      search?: string;
      status?: string;
    };
    
    const result = await SalesOrderRepository.findMany({
      companyId,
      page: parseInt(page),
      limit: parseInt(limit),
      currency,
      search,
      status,
    });
    
    return reply.send({ 
      success: true, 
      data: {
        data: result.data || [],
        pagination: result.pagination 
      }
    });
  }

  async getSalesOrder(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, soId } = request.params as { id: string, soId: string };
    const userId = (request.user as any).id;
    await this.requirePermission(userId, companyId, 'sales.orders', 'view');

    const so = await SalesOrderRepository.findById(soId);
    if (!so) throw new NotFoundError('Sales Order not found');

    return reply.send({ success: true, data: so });
  }

  async createSalesOrder(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;
    const { 
      customerId, lcId, orderDate, soDate, expectedDeliveryDate, 
      currency, exchangeRate, totalBDT, totalForeign, status, lines, 
      purchaseOrderIds 
    } = request.body as any;

    // Check permission to create sales orders
    await this.requirePermission(userId, companyId, 'sales.orders', 'create');

    if (!customerId || customerId === "") {
      throw new ValidationError('Customer selection is required to create a Sales Order');
    }

    const soNumber = await this.generateDocumentNumber(companyId, 'so');
    
    const so = await SalesOrderRepository.create({
      soNumber,
      companyId,
      customerId,
      lcId,
      soDate: (soDate || orderDate) ? new Date(soDate || orderDate) : undefined,
      expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
      currency,
      exchangeRate,
      totalBDT,
      totalForeign: totalForeign || (totalBDT / (exchangeRate || 1)),
      status: status || 'DRAFT',
      lines: lines?.map((l: any) => ({
        productId: l.productId,
        itemDescription: l.description || '',
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        total: l.total
      })),
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
    const userId = (request.user as any).id;
    await this.requirePermission(userId, companyId, 'sales.orders', 'edit');

    const updateData = request.body as any;
    // Check optimistic lock
    await checkOptimisticLock(request, reply, 'sales-order');
    if (reply.sent) return;

    const so = await (prisma as any).salesOrder.findUnique({ where: { id: soId } });
    if (!so) throw new NotFoundError('Sales Order not found');

    const role = await this.getUserRole(userId, companyId);
    if (!this.canEdit(so.status, role)) {
      throw new ForbiddenError('Cannot edit this sales order in current status');
    }

    delete updateData.companyId;
    delete updateData.soNumber;
    delete updateData.createdById;

    if (updateData.orderDate) {
      updateData.soDate = new Date(updateData.orderDate);
      delete updateData.orderDate;
    }
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

  async updateSalesOrderStatus(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, soId } = request.params as { id: string, soId: string };
    const { status: newStatus } = request.body as { status: string };
    const userId = (request.user as any).id;

    await this.requirePermission(userId, companyId, 'sales.orders', 'edit');

    const so = await (prisma as any).salesOrder.findUnique({ where: { id: soId } });
    if (!so) throw new NotFoundError('Sales Order not found');

    const role = await this.getUserRole(userId, companyId);

    const allowedTransitions: Record<string, string[]> = {
      'DRAFT': ['CONFIRMED', 'CANCELLED'],
      'CONFIRMED': ['FULFILLED', 'CANCELLED'],
      'FULFILLED': ['INVOICED'],
      'INVOICED': ['COMPLETED'],
      'COMPLETED': [],
      'CANCELLED': ['DRAFT']
    };

    const isCorrection = role === 'Owner' || role === 'Manager';
    
    if (!isCorrection && (!allowedTransitions[so.status] || !allowedTransitions[so.status].includes(newStatus))) {
      throw new ForbiddenError(`Transition from ${so.status} to ${newStatus} is not allowed for your role.`);
    }

    const updated = await (prisma as any).salesOrder.update({
      where: { id: soId },
      data: { status: newStatus },
    });

    await NotificationController.notifyStatusChange({
      companyId,
      entityType: 'SalesOrder',
      entityId: soId,
      entityNumber: so.soNumber,
      oldStatus: so.status,
      newStatus: newStatus,
      performedById: userId
    });

    return reply.send({ success: true, data: updated });
  }

  async deleteSalesOrder(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, soId } = request.params as { id: string, soId: string };
    const userId = (request.user as any).id;
    await this.requirePermission(userId, companyId, 'sales.orders', 'delete');

    const so = await (prisma as any).salesOrder.findUnique({ where: { id: soId } });
    if (!so) throw new NotFoundError('Sales Order not found');

    const role = await this.getUserRole(userId, companyId);
    if (!this.canDelete(so.status, role)) {
      throw new ForbiddenError('Cannot delete this sales order in current status');
    }

    await (prisma as any).salesOrder.update({
      where: { id: soId },
      data: { deletedAt: new Date() }
    });

    return reply.send({ success: true, message: 'Sales Order deleted' });
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
    const { page = '1', limit = '20', search, status } = request.query as { 
      page?: string; 
      limit?: string; 
      search?: string;
      status?: string;
    };

    const result = await PurchaseOrderRepository.findMany({ 
      companyId,
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      status
    });

    return reply.send({ 
      success: true, 
      data: {
        data: result.data || [],
        pagination: result.pagination
      }
    });
  }

  async getPurchaseOrder(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, poId } = request.params as { id: string, poId: string };
    const userId = (request.user as any).id;
    await this.requirePermission(userId, companyId, 'purchase.orders', 'view');

    const po = await PurchaseOrderRepository.findById(poId);
    if (!po) throw new NotFoundError('Purchase Order not found');

    return reply.send({ success: true, data: po });
  }

  async createPurchaseOrder(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { 
      supplierId, lcId, poDate, expectedDeliveryDate, 
      currency, exchangeRate, totalForeign, totalBDT, 
      status, lines, createdById, purchaseRequisitionIds 
    } = request.body as any;

    if (!supplierId || supplierId === "") {
      throw new ValidationError('Supplier selection is required to create a Purchase Order');
    }

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
      createdById: createdById || (request.user as any).id,
      lines: lines?.map((l: any) => ({
        productId: l.productId,
        itemDescription: l.description || '',
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        total: l.total
      })),
      purchaseRequisitionIds
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

    const isCorrection = role === 'Owner';
    
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
    const body = request.body ? request.body as any : {};
    const userId = (request.user as any).id;

    const so = await (prisma as any).salesOrder.findUnique({
      where: { id: soId },
      include: { lines: true }
    });

    if (!so) throw new NotFoundError('Sales Order not found');

    // If no items specified, deliver all remaining quantities
    let items = body.items;
    if (!items || !Array.isArray(items) || items.length === 0) {
      items = so.lines
        .filter((l: any) => {
          const remaining = l.quantity - (l.deliveredQuantity || 0);
          return remaining > 0;
        })
        .map((l: any) => ({
          productId: l.productId,
          quantity: l.quantity - (l.deliveredQuantity || 0)
        }));
    }

    if (items.length === 0) {
      throw new ValidationError('No items to deliver — all lines are already fully delivered');
    }

    const dnNumber = await this.generateDocumentNumber(companyId, 'dn');

    const dn = await prisma.$transaction(async (tx: any) => {
      // 1. Create DN
      const newDn = await tx.dN.create({
        data: {
          dnNumber,
          companyId,
          salesOrderId: soId,
          shipmentDate: body.shipmentDate ? new Date(body.shipmentDate) : new Date(),
          status: 'SHIPPED',
          lines: {
            create: items.map((item: any) => {
              const soLine = so.lines.find((l: any) => l.productId === item.productId);
              if (!soLine) throw new ValidationError(`Product ${item.productId} not found in Sales Order`);
              
              const remaining = soLine.quantity - (soLine.deliveredQuantity || 0);
              if (item.quantity > remaining) {
                throw new ValidationError(`Quantity ${item.quantity} exceeds remaining quantity ${remaining} for product ${item.productId}`);
              }

              return {
                productId: item.productId,
                quantity: item.quantity
              };
            })
          }
        },
        include: { lines: true }
      });

      // 2. Update Sales Order Lines
      for (const item of items) {
        await tx.salesOrderLine.updateMany({
          where: { salesOrderId: soId, productId: item.productId },
          data: {
            deliveredQuantity: {
              increment: item.quantity
            }
          }
        });
      }

      // 3. Process Inventory
      await InventoryService.processDN(tx, newDn.id);

      // 4. Generate Journal Entry for DN
      await JournalService.handleDocumentApproval('DN', newDn.id, userId, tx);

      return newDn;
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

  async getGRNs(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const grns = await (prisma as any).gRN.findMany({
      where: { companyId },
      include: { purchaseOrder: true, lines: { include: { product: true } } },
      orderBy: { createdAt: 'desc' }
    });
    return reply.send({ success: true, data: grns });
  }

  async generateGRN(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, poId } = request.params as { id: string, poId: string };
    const body = request.body ? request.body as any : {};
    const userId = (request.user as any).id;

    const po = await (prisma as any).purchaseOrder.findUnique({
      where: { id: poId },
      include: { lines: true }
    });

    if (!po) throw new NotFoundError('Purchase Order not found');

    // If no items specified, receive all remaining quantities
    let items = body.items;
    if (!items || !Array.isArray(items) || items.length === 0) {
      items = po.lines
        .filter((l: any) => {
          const remaining = l.quantity - (l.receivedQuantity || 0);
          return remaining > 0;
        })
        .map((l: any) => ({
          productId: l.productId,
          quantity: l.quantity - (l.receivedQuantity || 0)
        }));
    }

    if (items.length === 0) {
      throw new ValidationError('No items to receive — all lines are already fully received');
    }

    const grnNumber = await this.generateDocumentNumber(companyId, 'grn');

    const grn = await prisma.$transaction(async (tx: any) => {
      const newGrn = await tx.gRN.create({
        data: {
          grnNumber,
          companyId,
          purchaseOrderId: poId,
          receiptDate: body.receiptDate ? new Date(body.receiptDate) : new Date(),
          status: 'RECEIVED',
          lines: {
            create: items.map((item: any) => {
              const poLine = po.lines.find((l: any) => l.productId === item.productId);
              if (!poLine) throw new ValidationError(`Product ${item.productId} not found in Purchase Order`);
              
              const remaining = poLine.quantity - (poLine.receivedQuantity || 0);
              if (item.quantity > remaining) {
                throw new ValidationError(`Quantity ${item.quantity} exceeds remaining quantity ${remaining} for product ${item.productId}`);
              }

              return {
                productId: item.productId,
                quantity: item.quantity
              };
            })
          }
        },
        include: { lines: true }
      });

      for (const item of items) {
        await tx.purchaseOrderLine.updateMany({
          where: { purchaseOrderId: poId, productId: item.productId },
          data: {
            receivedQuantity: {
              increment: item.quantity
            }
          }
        });
      }

      await InventoryService.processGRN(tx, newGrn.id);
      await JournalService.handleDocumentApproval('GRN', newGrn.id, userId, tx);

      return newGrn;
    });

    await NotificationController.logActivity({
      companyId,
      entityType: 'grn',
      entityId: grn.id,
      action: 'CREATED',
      performedById: userId,
      metadata: { docNumber: grnNumber, poNumber: po.poNumber }
    });

    return reply.status(201).send({ success: true, data: grn });
  }
  async deleteDeliveryChallan(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, dnId } = request.params as { id: string, dnId: string };
    const userId = (request.user as any).id;

    const dn = await (prisma as any).dN.findUnique({
      where: { id: dnId },
      include: { lines: true }
    });

    if (!dn) throw new NotFoundError('Delivery Note not found');

    const role = await this.getUserRole(userId, companyId);
    if (dn.status !== 'DRAFT' && role !== 'Owner') {
      throw new ForbiddenError('Only Owners can delete a shipped delivery note');
    }

    await prisma.$transaction(async (tx: any) => {
      // 1. Revert Sales Order Lines
      if (dn.salesOrderId) {
        for (const line of dn.lines) {
          await tx.salesOrderLine.updateMany({
            where: { salesOrderId: dn.salesOrderId, productId: line.productId },
            data: {
              deliveredQuantity: {
                decrement: line.quantity
              }
            }
          });
        }
      }

      // 2. Revert Inventory (Need InventoryService.revertDN)
      await InventoryService.revertDN(tx, dnId);

      // 3. Delete Journal if exists
      if (dn.journalId) {
        await tx.journalEntry.delete({ where: { id: dn.journalId } });
      }

      // 4. Delete DN
      await tx.dN.delete({ where: { id: dnId } });
    });

    return reply.send({ success: true, message: 'Delivery Note deleted and quantities reverted' });
  }

  async deleteGRN(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId, grnId } = request.params as { id: string, grnId: string };
    const userId = (request.user as any).id;

    const grn = await (prisma as any).gRN.findUnique({
      where: { id: grnId },
      include: { lines: true }
    });

    if (!grn) throw new NotFoundError('GRN not found');

    const role = await this.getUserRole(userId, companyId);
    if (!this.canDelete(grn.status, role)) {
      throw new ForbiddenError('Cannot delete this GRN');
    }

    await prisma.$transaction(async (tx: any) => {
      // 1. Revert Purchase Order Lines
      if (grn.purchaseOrderId) {
        for (const line of grn.lines) {
          await tx.purchaseOrderLine.updateMany({
            where: { purchaseOrderId: grn.purchaseOrderId, productId: line.productId },
            data: {
              receivedQuantity: {
                decrement: line.quantity
              }
            }
          });
        }
      }

      // 2. Revert Inventory
      await InventoryService.revertGRN(tx, grnId);

      // 3. Delete Journal if exists
      if (grn.journalId) {
        await tx.journalEntry.delete({ where: { id: grn.journalId } });
      }

      // 4. Delete GRN
      await tx.gRN.delete({ where: { id: grnId } });
    });

    return reply.send({ success: true, message: 'GRN deleted and quantities reverted' });
  }
}
