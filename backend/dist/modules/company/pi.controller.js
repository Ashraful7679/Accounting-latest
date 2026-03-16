"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PIController = void 0;
const database_1 = __importDefault(require("../../config/database"));
const sequence_service_1 = require("./sequence.service");
const notification_controller_1 = require("./notification.controller");
class PIController {
    async getPIs(request, reply) {
        const { id: lcId } = request.params;
        const pis = await database_1.default.pI.findMany({
            where: { lcId },
            orderBy: { piDate: 'desc' }
        });
        return reply.send({ success: true, data: pis });
    }
    async getAllPIs(request, reply) {
        const { id: companyId } = request.params;
        const { type, customerId, isUnlinked } = request.query;
        const whereClause = { companyId };
        if (type === 'export') {
            whereClause.customerId = { not: null };
        }
        else if (type === 'import') {
            whereClause.vendorId = { not: null };
        }
        if (customerId) {
            whereClause.customerId = customerId;
        }
        if (isUnlinked === 'true') {
            whereClause.lcId = null;
        }
        const pis = await database_1.default.pI.findMany({
            where: whereClause,
            include: {
                lc: {
                    include: { customer: { select: { id: true, name: true } } }
                },
                customer: { select: { id: true, name: true } },
                vendor: { select: { id: true, name: true } }
            },
            orderBy: { piDate: 'desc' }
        });
        return reply.send({ success: true, data: pis });
    }
    async getPIDetail(request, reply) {
        const { piId } = request.params;
        const pi = await database_1.default.pI.findUnique({
            where: { id: piId },
            include: {
                lc: {
                    include: { customer: { select: { id: true, name: true } } }
                },
                customer: { select: { id: true, name: true } },
                vendor: { select: { id: true, name: true } }
            }
        });
        if (!pi)
            return reply.status(404).send({ success: false, message: 'PI not found' });
        return reply.send({ success: true, data: pi });
    }
    async createPI(request, reply) {
        const { id } = request.params;
        const data = request.body;
        let companyId = id;
        let lcId = data.lcId || null;
        // If route is /lcs/:id/pis, then id is lcId
        if (request.url.includes('/lcs/')) {
            lcId = id;
            const lc = await database_1.default.lC.findUnique({ where: { id: lcId } });
            if (!lc)
                return reply.status(404).send({ success: false, message: 'LC not found' });
            companyId = lc.companyId;
        }
        if (lcId) {
            const lc = await database_1.default.lC.findUnique({
                where: { id: lcId },
                include: { pis: true }
            });
            if (lc) {
                const currentTotalPI = lc.pis.reduce((sum, pi) => sum + pi.amount, 0);
                const newTotalPI = currentTotalPI + Number(data.amount);
                if (newTotalPI > lc.amount) {
                    return reply.status(400).send({
                        success: false,
                        message: `Sum of PIs ($${newTotalPI}) cannot exceed LC total ($${lc.amount})`
                    });
                }
            }
        }
        const piNumber = data.piNumber || await sequence_service_1.SequenceService.generateDocumentNumber(companyId, 'pi');
        const pi = await database_1.default.pI.create({
            data: {
                piNumber,
                piDate: new Date(data.piDate || new Date()),
                amount: Number(data.amount),
                currency: data.currency || 'USD',
                exchangeRate: Number(data.exchangeRate || 1),
                totalBDT: Number(data.totalBDT || (Number(data.amount) * Number(data.exchangeRate || 1))),
                status: data.status || 'DRAFT',
                lcId: lcId,
                companyId: companyId,
                invoiceNumber: data.invoiceNumber,
                submissionToBuyerDate: data.submissionToBuyerDate ? new Date(data.submissionToBuyerDate) : null,
                submissionToBankDate: data.submissionToBankDate ? new Date(data.submissionToBankDate) : null,
                bankAcceptanceDate: data.bankAcceptanceDate ? new Date(data.bankAcceptanceDate) : null,
                maturityDate: data.maturityDate ? new Date(data.maturityDate) : null,
                purchaseApplicationDate: data.purchaseApplicationDate ? new Date(data.purchaseApplicationDate) : null,
                purchaseAmount: data.purchaseAmount ? Number(data.purchaseAmount) : null,
                idbpNumber: data.idbpNumber,
                customerId: data.customerId,
                vendorId: data.vendorId,
                lines: {
                    create: data.lines?.map((line) => ({
                        productId: line.productId || null,
                        description: line.description,
                        quantity: Number(line.quantity || 1),
                        unitPrice: Number(line.unitPrice || 0),
                        total: Number(line.quantity || 1) * Number(line.unitPrice || 0)
                    }))
                }
            }
        });
        // Log Activity
        await notification_controller_1.NotificationController.logActivity({
            companyId,
            entityType: 'pi',
            entityId: pi.id,
            action: 'CREATED',
            performedById: request.user.id,
            metadata: { docNumber: piNumber }
        });
        return reply.status(201).send({ success: true, data: pi });
    }
    async updatePI(request, reply) {
        const { piId } = request.params;
        const data = request.body;
        const pi = await database_1.default.pI.findUnique({ where: { id: piId } });
        if (!pi)
            return reply.status(404).send({ success: false, message: 'PI not found' });
        // Guard: Prevent modification of locked PIs
        const lockedStatuses = ['VERIFIED', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'CLOSED'];
        if (lockedStatuses.includes(pi.status)) {
            return reply.status(400).send({
                success: false,
                message: `Cannot modify a proforma invoice with status: ${pi.status}`
            });
        }
        if (data.amount) {
            if (pi.lcId) {
                const lc = await database_1.default.lC.findUnique({
                    where: { id: pi.lcId },
                    include: { pis: true }
                });
                if (lc) {
                    const currentTotalPI = lc.pis.reduce((sum, item) => item.id === piId ? sum : sum + item.amount, 0);
                    const newTotalPI = currentTotalPI + Number(data.amount);
                    if (newTotalPI > lc.amount) {
                        return reply.status(400).send({
                            success: false,
                            message: `Sum of PIs ($${newTotalPI}) cannot exceed LC total ($${lc.amount})`
                        });
                    }
                }
            }
        }
        // Delete existing lines and re-create if lines provided
        if (data.lines) {
            await database_1.default.pILine.deleteMany({ where: { piId } });
        }
        const updatedPI = await database_1.default.pI.update({
            where: { id: piId },
            data: {
                piNumber: data.piNumber,
                piDate: data.piDate ? new Date(data.piDate) : undefined,
                amount: data.amount ? Number(data.amount) : undefined,
                currency: data.currency,
                exchangeRate: data.exchangeRate ? Number(data.exchangeRate) : undefined,
                totalBDT: data.totalBDT ? Number(data.totalBDT) : (data.amount && data.exchangeRate ? Number(data.amount) * Number(data.exchangeRate) : undefined),
                status: data.status,
                lcId: data.lcId,
                vendorId: data.vendorId,
                invoiceNumber: data.invoiceNumber,
                submissionToBuyerDate: data.submissionToBuyerDate ? new Date(data.submissionToBuyerDate) : undefined,
                submissionToBankDate: data.submissionToBankDate ? new Date(data.submissionToBankDate) : undefined,
                bankAcceptanceDate: data.bankAcceptanceDate ? new Date(data.bankAcceptanceDate) : undefined,
                maturityDate: data.maturityDate ? new Date(data.maturityDate) : undefined,
                purchaseApplicationDate: data.purchaseApplicationDate ? new Date(data.purchaseApplicationDate) : undefined,
                purchaseAmount: data.purchaseAmount ? Number(data.purchaseAmount) : undefined,
                idbpNumber: data.idbpNumber,
                customerId: data.customerId,
                lines: data.lines ? {
                    create: data.lines.map((line) => ({
                        productId: line.productId || null,
                        description: line.description,
                        quantity: Number(line.quantity || 1),
                        unitPrice: Number(line.unitPrice || 0),
                        total: Number(line.quantity || 1) * Number(line.unitPrice || 0)
                    }))
                } : undefined
            }
        });
        return reply.send({ success: true, data: updatedPI });
    }
    async verifyPI(request, reply) {
        const { piId } = request.params;
        const pi = await database_1.default.pI.findUnique({ where: { id: piId } });
        if (!pi)
            return reply.status(404).send({ success: false, message: 'PI not found' });
        if (pi.status !== 'DRAFT' && pi.status !== 'REJECTED') {
            return reply.status(400).send({ success: false, message: 'Only DRAFT or REJECTED PI can be verified' });
        }
        const updated = await database_1.default.pI.update({
            where: { id: piId },
            data: { status: 'VERIFIED' }
        });
        await notification_controller_1.NotificationController.notifyStatusChange({
            companyId: pi.companyId,
            entityType: 'PI',
            entityId: piId,
            entityNumber: pi.piNumber,
            newStatus: 'VERIFIED',
            performedById: request.user.id
        });
        return reply.send({ success: true, data: updated });
    }
    async approvePI(request, reply) {
        const { piId } = request.params;
        const pi = await database_1.default.pI.findUnique({ where: { id: piId } });
        if (!pi)
            return reply.status(404).send({ success: false, message: 'PI not found' });
        if (pi.status !== 'VERIFIED') {
            return reply.status(400).send({ success: false, message: 'Only VERIFIED PI can be approved' });
        }
        const updated = await database_1.default.pI.update({
            where: { id: piId },
            data: { status: 'APPROVED' }
        });
        await notification_controller_1.NotificationController.notifyStatusChange({
            companyId: pi.companyId,
            entityType: 'PI',
            entityId: piId,
            entityNumber: pi.piNumber,
            newStatus: 'APPROVED',
            performedById: request.user.id
        });
        return reply.send({ success: true, data: updated });
    }
    async rejectPI(request, reply) {
        const { piId } = request.params;
        const { reason } = request.body;
        const pi = await database_1.default.pI.findUnique({ where: { id: piId } });
        if (!pi)
            return reply.status(404).send({ success: false, message: 'PI not found' });
        const updated = await database_1.default.pI.update({
            where: { id: piId },
            data: { status: 'REJECTED' }
        });
        await notification_controller_1.NotificationController.notifyStatusChange({
            companyId: pi.companyId,
            entityType: 'PI',
            entityId: piId,
            entityNumber: pi.piNumber,
            newStatus: 'REJECTED',
            performedById: request.user.id,
            reason
        });
        return reply.send({ success: true, data: updated });
    }
    async deletePI(request, reply) {
        const { piId } = request.params;
        const pi = await database_1.default.pI.findUnique({ where: { id: piId } });
        if (!pi)
            return reply.status(404).send({ success: false, message: 'PI not found' });
        if (pi.status !== 'DRAFT' && pi.status !== 'REJECTED') {
            return reply.status(400).send({
                success: false,
                message: `Cannot delete a proforma invoice with status: ${pi.status}`
            });
        }
        await database_1.default.pI.delete({ where: { id: piId } });
        return reply.send({ success: true, message: 'PI deleted' });
    }
}
exports.PIController = PIController;
//# sourceMappingURL=pi.controller.js.map