"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LCController = void 0;
const database_1 = __importDefault(require("../../config/database"));
const sequence_service_1 = require("./sequence.service");
const notification_controller_1 = require("./notification.controller");
class LCController {
    async getLCs(request, reply) {
        const { id: companyId } = request.params;
        const lcs = await database_1.default.lC.findMany({
            where: { companyId },
            include: {
                customer: { select: { name: true, code: true } },
                vendor: { select: { name: true, code: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        return reply.send({ success: true, data: lcs });
    }
    async getLCDetail(request, reply) {
        const { lcId } = request.params;
        const lc = await database_1.default.lC.findUnique({
            where: { id: lcId },
            include: {
                customer: true,
                vendor: true,
                pis: {
                    orderBy: { piDate: 'desc' }
                },
                payments: {
                    orderBy: { date: 'desc' },
                    include: {
                        piAllocations: {
                            include: { pi: true }
                        }
                    }
                },
                _count: {
                    select: { pis: true, payments: true }
                }
            }
        });
        if (!lc) {
            return reply.status(404).send({ success: false, message: 'LC not found' });
        }
        return reply.send({ success: true, data: lc });
    }
    async createLC(request, reply) {
        const { id: companyId } = request.params;
        const { piIds, ...data } = request.body;
        const result = await database_1.default.$transaction(async (tx) => {
            // 0. Automate LC Number if not provided
            const lcNumber = data.lcNumber || await sequence_service_1.SequenceService.generateDocumentNumber(companyId, 'lc', tx);
            // 0a. Automated Bank COA Creation
            if (data.bankName) {
                const existingBank = await tx.account.findFirst({
                    where: {
                        name: data.bankName,
                        companyId,
                        category: 'BANK'
                    }
                });
                if (!existingBank) {
                    // Find the Asset account type
                    const assetType = await tx.accountType.findUnique({ where: { name: 'ASSET' } });
                    const bankParent = await tx.account.findFirst({ where: { companyId, category: 'BANK_PARENT' } });
                    if (assetType) {
                        // Generate a code for the bank account (e.g., 1010-001)
                        const count = await tx.account.count({ where: { companyId, accountTypeId: assetType.id } });
                        const bankCode = `1010-${(count + 1).toString().padStart(3, '0')}`;
                        await tx.account.create({
                            data: {
                                code: bankCode,
                                name: data.bankName,
                                companyId,
                                accountTypeId: assetType.id,
                                parentId: bankParent?.id || null,
                                category: 'BANK',
                                isActive: true,
                                allowNegative: false
                            }
                        });
                    }
                }
            }
            // Robust date parsing (handle empty strings which cause "Invalid Date")
            const parseDate = (d) => d && d !== '' ? new Date(d) : null;
            const issueDate = parseDate(data.issueDate);
            const expiryDate = parseDate(data.expiryDate);
            if (!issueDate || isNaN(issueDate.getTime())) {
                throw new Error('Valid Issue Date is required');
            }
            if (!expiryDate || isNaN(expiryDate.getTime())) {
                throw new Error('Valid Expiry Date is required');
            }
            // 1. Create the LC
            const lc = await tx.lC.create({
                data: {
                    ...data,
                    lcNumber,
                    companyId,
                    issueDate,
                    expiryDate,
                    amount: Number(data.amount),
                    conversionRate: data.conversionRate ? Number(data.conversionRate) : 1,
                    loanValue: data.loanValue ? Number(data.loanValue) : 0,
                    customerId: data.customerId || null,
                    vendorId: data.vendorId || null,
                    receivedDate: data.receivedDate ? parseDate(data.receivedDate) : null,
                    shipmentDate: data.shipmentDate ? parseDate(data.shipmentDate) : null
                }
            });
            // 2. Link PIs if provided
            if (piIds && Array.isArray(piIds) && piIds.length > 0) {
                // Validate total PI amount vs LC amount
                const pis = await tx.pI.findMany({
                    where: { id: { in: piIds } }
                });
                const totalPIAmount = pis.reduce((sum, pi) => sum + pi.amount, 0);
                if (totalPIAmount > Number(data.amount)) {
                    throw new Error(`Total PI amount (${totalPIAmount}) cannot exceed LC amount (${data.amount})`);
                }
                await tx.pI.updateMany({
                    where: { id: { in: piIds } },
                    data: { lcId: lc.id }
                });
            }
            return lc;
        });
        // Log Activity
        await notification_controller_1.NotificationController.logActivity({
            companyId,
            entityType: 'lc',
            entityId: result.id,
            action: 'CREATED',
            performedById: request.user.id,
            metadata: { docNumber: result.lcNumber }
        });
        return reply.status(201).send({ success: true, data: result });
    }
    async updateLC(request, reply) {
        const { lcId } = request.params;
        const data = request.body;
        const existingLC = await database_1.default.lC.findUnique({ where: { id: lcId } });
        if (!existingLC)
            return reply.status(404).send({ success: false, message: 'LC not found' });
        // Guard: Prevent modification of approved/closed LCs
        if (existingLC.status !== 'OPEN' && existingLC.status !== 'REJECTED') {
            return reply.status(400).send({
                success: false,
                message: `Cannot modify an LC with status: ${existingLC.status}`
            });
        }
        const lc = await database_1.default.lC.update({
            where: { id: lcId },
            data: {
                ...data,
                issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
                expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
                amount: data.amount ? Number(data.amount) : undefined,
                conversionRate: data.conversionRate ? Number(data.conversionRate) : undefined,
                loanValue: data.loanValue ? Number(data.loanValue) : undefined,
                customerId: data.customerId || undefined,
                vendorId: data.vendorId || undefined,
                receivedDate: data.receivedDate ? new Date(data.receivedDate) : undefined
            }
        });
        return reply.send({ success: true, data: lc });
    }
    async deleteLC(request, reply) {
        const { lcId } = request.params;
        const existingLC = await database_1.default.lC.findUnique({ where: { id: lcId } });
        if (!existingLC)
            return reply.status(404).send({ success: false, message: 'LC not found' });
        if (existingLC.status !== 'OPEN' && existingLC.status !== 'REJECTED') {
            return reply.status(400).send({
                success: false,
                message: `Cannot delete an LC with status: ${existingLC.status}`
            });
        }
        await database_1.default.lC.delete({ where: { id: lcId } });
        return reply.send({ success: true, message: 'LC deleted' });
    }
    async approveLC(request, reply) {
        const { lcId } = request.params;
        // LC Mandatory Attachment Rule (RMG Best Practice)
        const attachmentCount = await database_1.default.attachment.count({
            where: { entityType: 'LC', entityId: lcId, isActive: true }
        });
        if (attachmentCount === 0) {
            return reply.status(400).send({
                success: false,
                message: 'RMG Policy: At least one document (LC Copy) must be attached before approval.'
            });
        }
        const lc = await database_1.default.lC.update({
            where: { id: lcId },
            data: { status: 'APPROVED' }
        });
        return reply.send({ success: true, data: lc });
    }
}
exports.LCController = LCController;
//# sourceMappingURL=lc.controller.js.map