"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderController = void 0;
const database_1 = __importDefault(require("../../config/database"));
const PurchaseOrderRepository_1 = require("../../repositories/PurchaseOrderRepository");
const notification_controller_1 = require("./notification.controller");
const errorHandler_1 = require("../../middleware/errorHandler");
const base_controller_1 = require("./base.controller");
class OrderController extends base_controller_1.BaseCompanyController {
    // ============ PURCHASE ORDERS ============
    async getPurchaseOrders(request, reply) {
        const { id: companyId } = request.params;
        const pos = await PurchaseOrderRepository_1.PurchaseOrderRepository.findMany({ companyId });
        return reply.send({ success: true, data: pos });
    }
    async createPurchaseOrder(request, reply) {
        const { id: companyId } = request.params;
        const { supplierId, lcId, poDate, expectedDeliveryDate, currency, exchangeRate, totalForeign, totalBDT, status, lines, createdById } = request.body;
        const poNumber = await this.generateDocumentNumber(companyId, 'po');
        const po = await PurchaseOrderRepository_1.PurchaseOrderRepository.create({
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
        await notification_controller_1.NotificationController.logActivity({
            companyId,
            entityType: 'purchase_order',
            entityId: po.id,
            action: 'CREATED',
            performedById: request.user.id,
            metadata: { docNumber: poNumber }
        });
        return reply.status(201).send({ success: true, data: po });
    }
    async updatePurchaseOrder(request, reply) {
        const { id: companyId, poId } = request.params;
        const updateData = request.body;
        const userId = request.user.id;
        const po = await database_1.default.purchaseOrder.findUnique({ where: { id: poId } });
        if (!po)
            throw new errorHandler_1.NotFoundError('Purchase Order not found');
        const role = await this.getUserRole(userId, companyId);
        if (!this.canEdit(po.status, role)) {
            throw new errorHandler_1.ForbiddenError('Cannot edit this purchase order in current status');
        }
        delete updateData.companyId;
        delete updateData.poNumber;
        delete updateData.createdById;
        if (updateData.poDate)
            updateData.poDate = new Date(updateData.poDate);
        if (updateData.expectedDeliveryDate)
            updateData.expectedDeliveryDate = new Date(updateData.expectedDeliveryDate);
        const updatedPo = await PurchaseOrderRepository_1.PurchaseOrderRepository.update(poId, updateData);
        await notification_controller_1.NotificationController.logActivity({
            companyId,
            entityType: 'purchase_order',
            entityId: updatedPo.id,
            action: 'UPDATED',
            performedById: userId,
            metadata: { docNumber: updatedPo.poNumber }
        });
        return reply.send({ success: true, data: updatedPo });
    }
    async updatePurchaseOrderStatus(request, reply) {
        const { id: companyId, poId } = request.params;
        const { status: newStatus } = request.body;
        const userId = request.user.id;
        const po = await database_1.default.purchaseOrder.findUnique({ where: { id: poId } });
        if (!po)
            throw new errorHandler_1.NotFoundError('Purchase Order not found');
        const role = await this.getUserRole(userId, companyId);
        const allowedTransitions = {
            'DRAFT': ['APPROVED', 'REJECTED'],
            'REJECTED': ['DRAFT'],
            'APPROVED': ['SENT', 'REJECTED'],
            'SENT': ['RECEIVED', 'REJECTED'],
            'RECEIVED': ['CLOSED', 'REJECTED'],
            'CLOSED': []
        };
        const isCorrection = ['Owner', 'Admin'].includes(role);
        if (!isCorrection && (!allowedTransitions[po.status] || !allowedTransitions[po.status].includes(newStatus))) {
            throw new errorHandler_1.ForbiddenError(`Transition from ${po.status} to ${newStatus} is not allowed for your role.`);
        }
        const updateData = { status: newStatus };
        if (newStatus === 'APPROVED') {
            updateData.approvedById = userId;
        }
        const updated = await database_1.default.purchaseOrder.update({
            where: { id: poId },
            data: updateData,
            include: {
                supplier: true,
                lc: true,
                lines: true
            }
        });
        await notification_controller_1.NotificationController.notifyStatusChange({
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
    async deletePurchaseOrder(request, reply) {
        const { id: companyId, poId } = request.params;
        const userId = request.user.id;
        const po = await database_1.default.purchaseOrder.findUnique({ where: { id: poId } });
        if (!po)
            throw new errorHandler_1.NotFoundError('Purchase Order not found');
        const role = await this.getUserRole(userId, companyId);
        if (!this.canDelete(po.status, role)) {
            throw new errorHandler_1.ForbiddenError('Cannot delete this purchase order');
        }
        await PurchaseOrderRepository_1.PurchaseOrderRepository.delete(poId);
        return reply.send({ success: true, message: 'Purchase Order deleted' });
    }
}
exports.OrderController = OrderController;
//# sourceMappingURL=order.controller.js.map