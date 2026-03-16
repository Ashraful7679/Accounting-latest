"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyController = void 0;
const notification_controller_1 = require("./notification.controller");
const database_1 = __importDefault(require("../../config/database"));
const AccountRepository_1 = require("../../repositories/AccountRepository");
const TransactionRepository_1 = require("../../repositories/TransactionRepository");
const CustomerRepository_1 = require("../../repositories/CustomerRepository");
const VendorRepository_1 = require("../../repositories/VendorRepository");
const PurchaseOrderRepository_1 = require("../../repositories/PurchaseOrderRepository");
const systemMode_1 = require("../../lib/systemMode");
const company_1 = require("../../lib/mockData/company");
const errorHandler_1 = require("../../middleware/errorHandler");
const sequence_service_1 = require("./sequence.service");
class CompanyController {
    // Robust sequence-based document numbers
    async generateDocumentNumber(companyId, type) {
        return sequence_service_1.SequenceService.generateDocumentNumber(companyId, type);
    }
    // Check user access to company
    async checkCompanyAccess(userId, companyId) {
        const userCompany = await database_1.default.userCompany.findUnique({
            where: { userId_companyId: { userId, companyId } },
        });
        return !!userCompany;
    }
    // Get user role in company
    async getUserRole(userId, companyId) {
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
            include: { userRoles: { include: { role: true } } },
        });
        if (!user)
            return 'User';
        // Check if owner
        const isOwner = await database_1.default.userCompany.findFirst({
            where: { userId, companyId },
            include: {
                user: { include: { userRoles: { include: { role: true } } } },
            },
        });
        if (isOwner?.user.userRoles.some((ur) => ur.role.name === 'Owner')) {
            return 'Owner';
        }
        return user.userRoles[0]?.role.name || 'User';
    }
    // Check if user can perform action based on status
    canEdit(status, role, userId, createdById) {
        const lockedStatuses = ['VERIFIED', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'CLOSED'];
        if (lockedStatuses.includes(status))
            return false;
        if (role === 'Owner' || role === 'Admin' || role === 'Manager')
            return true;
        // Allow creator to edit if DRAFT or REJECTED
        if (userId && createdById && userId === createdById) {
            return status === 'DRAFT' || status === 'REJECTED';
        }
        if (role === 'Accountant')
            return status === 'DRAFT' || status === 'REJECTED';
        return false;
    }
    canDelete(status, role) {
        if (status !== 'DRAFT')
            return false;
        if (role === 'Owner' || role === 'Admin')
            return true;
        return false;
    }
    canVerify(status, role) {
        if (role === 'Owner')
            return status === 'PENDING_VERIFICATION';
        if (role === 'Manager')
            return status === 'PENDING_VERIFICATION';
        return false;
    }
    canApprove(status, role) {
        if (role === 'Owner')
            return status === 'PENDING_APPROVAL' || status === 'VERIFIED';
        return false;
    }
    async getCompany(request, reply) {
        const { id } = request.params;
        if (systemMode_1.SYSTEM_MODE === "OFFLINE") {
            return reply.send({ success: true, data: company_1.demoCompany });
        }
        try {
            const company = await database_1.default.company.findUnique({
                where: { id },
            });
            if (!company) {
                throw new errorHandler_1.NotFoundError('Company not found');
            }
            return reply.send({ success: true, data: company });
        }
        catch (error) {
            if (error instanceof errorHandler_1.NotFoundError)
                throw error;
            return reply.send({ success: true, data: company_1.demoCompany });
        }
    }
    // ============ CUSTOMERS ============
    async getCustomers(request, reply) {
        const { id: companyId } = request.params;
        const customers = await CustomerRepository_1.CustomerRepository.findMany({ companyId });
        return reply.send({ success: true, data: customers });
    }
    async createCustomer(request, reply) {
        const { id: companyId } = request.params;
        const { name, email, phone, address, city, country, contactPerson, tinVat, openingBalance, balanceType, creditLimit, preferredCurrency } = request.body;
        const code = await this.generateDocumentNumber(companyId, 'customer');
        const customer = await CustomerRepository_1.CustomerRepository.create({
            code, name, companyId, email, phone, address, city, country,
            contactPerson, tinVat,
            openingBalance: Number(openingBalance || 0),
            balanceType,
            creditLimit: Number(creditLimit || 0),
            preferredCurrency: preferredCurrency || 'BDT'
        });
        // Log Activity
        await notification_controller_1.NotificationController.logActivity({
            companyId,
            entityType: 'customer',
            entityId: customer.id,
            action: 'CREATED',
            performedById: request.user.id,
            metadata: { docNumber: code, name: customer.name }
        });
        return reply.status(201).send({ success: true, data: customer });
    }
    async updateCustomer(request, reply) {
        const { customerId } = request.params;
        const data = request.body;
        const customer = await database_1.default.customer.update({
            where: { id: customerId },
            data,
        });
        return reply.send({ success: true, data: customer });
    }
    async deleteCustomer(request, reply) {
        const { customerId } = request.params;
        await database_1.default.customer.delete({ where: { id: customerId } });
        return reply.send({ success: true, message: 'Customer deleted' });
    }
    // ============ VENDORS ============
    async getVendors(request, reply) {
        const { id: companyId } = request.params;
        const vendors = await VendorRepository_1.VendorRepository.findMany({ companyId });
        return reply.send({ success: true, data: vendors });
    }
    async createVendor(request, reply) {
        const { id: companyId } = request.params;
        const { name, email, phone, address, city, country, contactPerson, tinVat, openingBalance, balanceType, creditLimit, preferredCurrency } = request.body;
        const code = await this.generateDocumentNumber(companyId, 'vendor');
        const vendor = await VendorRepository_1.VendorRepository.create({
            code, name, companyId, email, phone, address, city, country,
            contactPerson, tinVat, openingBalance, balanceType, creditLimit, preferredCurrency
        });
        // Log Activity
        await notification_controller_1.NotificationController.logActivity({
            companyId,
            entityType: 'vendor',
            entityId: vendor.id,
            action: 'CREATED',
            performedById: request.user.id,
            metadata: { docNumber: code, name: vendor.name }
        });
        return reply.status(201).send({ success: true, data: vendor });
    }
    async updateVendor(request, reply) {
        const { vendorId } = request.params;
        const data = request.body;
        const vendor = await database_1.default.vendor.update({
            where: { id: vendorId },
            data,
        });
        return reply.send({ success: true, data: vendor });
    }
    async deleteVendor(request, reply) {
        const { vendorId } = request.params;
        await database_1.default.vendor.delete({ where: { id: vendorId } });
        return reply.send({ success: true, message: 'Vendor deleted' });
    }
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
        // Log Activity
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
        // Remove immutable fields if present in update payload
        delete updateData.companyId;
        delete updateData.poNumber;
        delete updateData.createdById;
        if (updateData.poDate)
            updateData.poDate = new Date(updateData.poDate);
        if (updateData.expectedDeliveryDate)
            updateData.expectedDeliveryDate = new Date(updateData.expectedDeliveryDate);
        const updatedPo = await PurchaseOrderRepository_1.PurchaseOrderRepository.update(poId, updateData);
        // Log Activity
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
        const isPrivileged = ['Owner', 'Admin', 'Manager'].includes(role);
        // Strict Transition Map
        const allowedTransitions = {
            'DRAFT': ['APPROVED', 'REJECTED'],
            'REJECTED': ['DRAFT'],
            'APPROVED': ['SENT', 'REJECTED'],
            'SENT': ['RECEIVED', 'REJECTED'],
            'RECEIVED': ['CLOSED', 'REJECTED'],
            'CLOSED': []
        };
        // Owners and Admins can bypass the transition map for emergency corrections,
        // but others must follow it strictly.
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
    // ============ ACCOUNTS ============
    async getAccounts(request, reply) {
        const { id: companyId } = request.params;
        const { limit, page } = request.query;
        const take = limit ? parseInt(limit) : undefined;
        const skip = (page && take) ? (parseInt(page) - 1) * take : undefined;
        const accounts = await AccountRepository_1.AccountRepository.findMany({ companyId }, take, skip);
        return reply.send({ success: true, data: accounts });
    }
    async createAccount(request, reply) {
        const { id: companyId } = request.params;
        const { code, name, accountTypeId, parentId, openingBalance, cashFlowType, category } = request.body;
        let accountCode = code;
        // If no code provided, auto-generate based on account type
        if (!accountCode) {
            const accountType = await database_1.default.accountType.findUnique({ where: { id: accountTypeId } });
            if (parentId) {
                // Get parent account and derive code from its serial
                const parent = await database_1.default.account.findUnique({ where: { id: parentId } });
                if (parent) {
                    // Get count of existing children under this parent
                    const siblingCount = await database_1.default.account.count({ where: { parentId } });
                    const parentPrefix = parent.code.substring(0, parent.code.length - 2);
                    accountCode = `${parentPrefix}${String(siblingCount + 1).padStart(2, '0')}`;
                }
            }
            else if (accountType) {
                // Generate code based on account type
                const typeCodeMap = {
                    'ASSET': { prefix: 'A-1', min: 100, max: 999 },
                    'LIABILITY': { prefix: 'L-1', min: 100, max: 999 },
                    'EQUITY': { prefix: 'E-1', min: 100, max: 999 },
                    'INCOME': { prefix: 'I-1', min: 100, max: 999 },
                    'EXPENSE': { prefix: 'X-1', min: 100, max: 999 },
                };
                const config = typeCodeMap[accountType.name];
                if (config) {
                    // Find next available code in range
                    const existing = await database_1.default.account.findMany({
                        where: {
                            companyId,
                            code: { startsWith: config.prefix }
                        },
                        orderBy: { code: 'desc' },
                        take: 1
                    });
                    let nextNum = config.min;
                    if (existing.length > 0) {
                        const lastCode = existing[0].code;
                        const lastNum = parseInt(lastCode.replace(/[^0-9]/g, ''));
                        if (lastNum < config.max) {
                            nextNum = lastNum + 1;
                        }
                    }
                    accountCode = `${config.prefix}${String(nextNum).padStart(3, '0')}`;
                }
            }
        }
        if (!accountCode) {
            return reply.status(400).send({ success: false, error: 'Could not generate account code' });
        }
        const openBal = parseFloat(openingBalance) || 0;
        const account = await AccountRepository_1.AccountRepository.create({
            code: accountCode,
            name,
            companyId,
            accountTypeId,
            parentId: parentId || null,
            openingBalance: openBal,
            currentBalance: openBal,
            cashFlowType,
            category: category || 'NONE'
        });
        return reply.status(201).send({ success: true, data: account });
    }
    async updateAccount(request, reply) {
        const { accountId } = request.params;
        const { code, name, accountTypeId, parentId, openingBalance, isActive, cashFlowType, category } = request.body;
        const existingAccount = await database_1.default.account.findUnique({ where: { id: accountId } });
        if (!existingAccount)
            throw new errorHandler_1.NotFoundError('Account not found');
        const account = await database_1.default.account.update({
            where: { id: accountId },
            data: {
                name: name ?? existingAccount.name,
                isActive: isActive ?? existingAccount.isActive,
                cashFlowType: cashFlowType ?? existingAccount.cashFlowType,
                code: code ?? existingAccount.code,
                accountTypeId: accountTypeId ?? existingAccount.accountTypeId,
                parentId: parentId === null ? null : (parentId ?? existingAccount.parentId),
                openingBalance: openingBalance !== undefined ? parseFloat(openingBalance) : existingAccount.openingBalance,
                category: category ?? existingAccount.category
            },
        });
        return reply.send({ success: true, data: account });
    }
    async getAccountTypes(request, reply) {
        const types = await AccountRepository_1.AccountRepository.findAccountTypes();
        return reply.send({ success: true, data: types });
    }
    async healBalances(request, reply) {
        const { id: companyId } = request.params;
        // 1. Get all accounts for this company
        const accounts = await database_1.default.account.findMany({
            where: { companyId },
            include: { accountType: true }
        });
        // 2. Wrap in a transaction for safety
        await database_1.default.$transaction(async (tx) => {
            for (const account of accounts) {
                // Reset to opening balance
                let balance = Number(account.openingBalance) || 0;
                // Get all approved ledger lines for this account
                const lines = await tx.journalEntryLine.findMany({
                    where: {
                        accountId: account.id,
                        journalEntry: { status: 'APPROVED' }
                    }
                });
                // Sum up movements
                const isDebitType = account.accountType.type === 'DEBIT';
                for (const line of lines) {
                    const change = isDebitType
                        ? (Number(line.debitBase) - Number(line.creditBase))
                        : (Number(line.creditBase) - Number(line.debitBase));
                    balance += change;
                }
                // Update Account
                await tx.account.update({
                    where: { id: account.id },
                    data: { currentBalance: balance }
                });
            }
        });
        return reply.send({ success: true, message: 'All account balances have been synchronized with the ledger.' });
    }
    // ============ INVOICES ============
    async getInvoices(request, reply) {
        const { id: companyId } = request.params;
        const { type } = request.query;
        const where = { companyId };
        if (type)
            where.type = type.toUpperCase();
        const invoices = await TransactionRepository_1.TransactionRepository.findInvoices(where);
        return reply.send({ success: true, data: invoices });
    }
    async getInvoice(request, reply) {
        const { invoiceId } = request.params;
        const invoice = await TransactionRepository_1.TransactionRepository.findInvoiceById(invoiceId);
        if (!invoice)
            throw new errorHandler_1.NotFoundError('Invoice not found');
        return reply.send({ success: true, data: invoice });
    }
    async createInvoice(request, reply) {
        const { id: companyId } = request.params;
        const data = request.body;
        const userId = request.user.id;
        // Generate invoice number
        const invoiceNumber = await this.generateDocumentNumber(companyId, 'invoice');
        // Calculate totals
        const subtotal = data.lines.reduce((sum, line) => sum + (line.quantity * line.unitPrice), 0);
        const taxAmount = data.lines.reduce((sum, line) => sum + (line.quantity * line.unitPrice * line.taxRate / 100), 0);
        const total = subtotal + taxAmount;
        // BDT amount
        const bdtAmount = total * (data.exchangeRate || 1);
        // Transaction Date Validation
        if (!data.invoiceDate) {
            throw new errorHandler_1.ValidationError('Invoice date is required');
        }
        const invoiceDate = new Date(data.invoiceDate);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const role = await this.getUserRole(userId, companyId);
        const isOwnerOrAdmin = role === 'Owner' || role === 'Admin';
        if (invoiceDate > today && !isOwnerOrAdmin) {
            throw new errorHandler_1.ValidationError('Future invoice dates are only allowed for owners');
        }
        try {
            const invoice = await TransactionRepository_1.TransactionRepository.createInvoice({
                invoiceNumber,
                companyId,
                customerId: data.customerId || null,
                vendorId: data.vendorId || null,
                type: data.type || 'SALES',
                currency: data.currency || 'BDT',
                exchangeRate: data.exchangeRate || 1,
                invoiceDate: invoiceDate,
                dueDate: data.dueDate ? new Date(data.dueDate) : null,
                description: data.description,
                subtotal,
                taxAmount,
                total: bdtAmount,
                createdById: userId,
                lines: {
                    create: data.lines.map((l) => ({
                        productId: l.productId || null,
                        description: l.description,
                        quantity: Number(l.quantity || 1),
                        unitPrice: Number(l.unitPrice || 0),
                        taxRate: Number(l.taxRate || 0),
                        amount: Number(l.quantity || 0) * Number(l.unitPrice || 0) * (1 + (Number(l.taxRate || 0) / 100)),
                    })),
                },
            });
            // Log Activity
            await notification_controller_1.NotificationController.logActivity({
                companyId,
                entityType: 'invoice',
                entityId: invoice.id,
                action: 'CREATED',
                performedById: userId,
                metadata: {
                    docNumber: invoiceNumber,
                    type: data.type || 'SALES' // Store type for correct dashboard linking
                }
            });
            return reply.status(201).send({ success: true, data: invoice });
        }
        catch (error) {
            console.error('FAILED TO CREATE INVOICE:', error);
            return reply.status(error.statusCode || 500).send({
                success: false,
                error: { message: error.message || 'Failed to create invoice' }
            });
        }
    }
    async updateInvoice(request, reply) {
        const { invoiceId } = request.params;
        const { id: companyId } = request.params;
        const userId = request.user.id;
        const data = request.body;
        const role = await this.getUserRole(userId, companyId);
        const invoice = await database_1.default.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice)
            throw new errorHandler_1.NotFoundError('Invoice not found');
        if (!this.canEdit(invoice.status, role)) {
            throw new errorHandler_1.ForbiddenError('Cannot edit this invoice in current status');
        }
        // Recalculate if lines changed
        if (data.lines) {
            const subtotal = data.lines.reduce((sum, line) => sum + (line.quantity * line.unitPrice), 0);
            const taxAmount = data.lines.reduce((sum, line) => sum + (line.quantity * line.unitPrice * line.taxRate / 100), 0);
            const total = subtotal + taxAmount;
            const bdtAmount = total * (data.exchangeRate || invoice.exchangeRate || 1);
            data.subtotal = subtotal;
            data.taxAmount = taxAmount;
            data.total = bdtAmount;
        }
        const updated = await database_1.default.invoice.update({
            where: { id: invoiceId },
            data: {
                ...data,
                customerId: data.customerId || undefined,
                vendorId: data.vendorId || undefined,
                lines: data.lines ? {
                    deleteMany: {},
                    create: data.lines.map((l) => ({
                        productId: l.productId || null,
                        description: l.description,
                        quantity: Number(l.quantity || 1),
                        unitPrice: Number(l.unitPrice || 0),
                        taxRate: Number(l.taxRate || 0),
                        amount: l.quantity * l.unitPrice * (1 + (l.taxRate || 0) / 100),
                    })),
                } : undefined,
            },
            include: { lines: true },
        });
        return reply.send({ success: true, data: updated });
    }
    async deleteInvoice(request, reply) {
        const { invoiceId } = request.params;
        const { id: companyId } = request.params;
        const userId = request.user.id;
        const role = await this.getUserRole(userId, companyId);
        const invoice = await database_1.default.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice)
            throw new errorHandler_1.NotFoundError('Invoice not found');
        if (!this.canDelete(invoice.status, role)) {
            throw new errorHandler_1.ForbiddenError('Cannot delete this invoice');
        }
        await database_1.default.invoice.delete({ where: { id: invoiceId } });
        return reply.send({ success: true, message: 'Invoice deleted' });
    }
    async verifyInvoice(request, reply) {
        const { invoiceId } = request.params;
        const { id: companyId } = request.params;
        const userId = request.user.id;
        const role = await this.getUserRole(userId, companyId);
        const invoice = await database_1.default.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice)
            throw new errorHandler_1.NotFoundError('Invoice not found');
        // Manager can only verify their subordinates' invoices
        if (role === 'Manager') {
            // Assuming getSubordinateIds is defined elsewhere or needs to be implemented
            // const subordinateIds = await this.getSubordinateIds(userId);
            // if (!subordinateIds.includes(invoice.createdById)) {
            //   throw new ForbiddenError('You can only verify invoices from your team');
            // }
            // Temporarily bypass until subordinate logic is clear
        }
        if (!this.canVerify(invoice.status, role)) {
            throw new errorHandler_1.ForbiddenError(`Cannot verify this invoice from current status: ${invoice.status}`);
        }
        const updated = await database_1.default.invoice.update({
            where: { id: invoiceId },
            data: {
                status: 'VERIFIED',
                verifiedById: userId,
                verifiedAt: new Date(),
            },
        });
        await notification_controller_1.NotificationController.notifyStatusChange({
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
    async rejectInvoice(request, reply) {
        const { invoiceId } = request.params;
        const { id: companyId } = request.params;
        const { reason } = request.body;
        const userId = request.user.id;
        const role = await this.getUserRole(userId, companyId);
        const invoice = await database_1.default.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice)
            throw new errorHandler_1.NotFoundError('Invoice not found');
        if (!this.canVerify(invoice.status, role)) {
            throw new errorHandler_1.ForbiddenError('Cannot reject this invoice');
        }
        const updated = await database_1.default.invoice.update({
            where: { id: invoiceId },
            data: {
                status: 'REJECTED',
                rejectedById: userId,
                rejectionReason: reason,
            },
        });
        await notification_controller_1.NotificationController.notifyStatusChange({
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
    async retrieveInvoice(request, reply) {
        const { invoiceId } = request.params;
        const { id: companyId } = request.params;
        const userId = request.user.id;
        const role = await this.getUserRole(userId, companyId);
        const invoice = await database_1.default.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice)
            throw new errorHandler_1.NotFoundError('Invoice not found');
        // Can only retrieve from REJECTED status
        if (invoice.status !== 'REJECTED') {
            throw new errorHandler_1.ForbiddenError('Can only retrieve rejected invoices');
        }
        // Manager cannot retrieve verified/approved
        if (role === 'Manager') {
            throw new errorHandler_1.ForbiddenError('Managers cannot retrieve invoices');
        }
        const updated = await database_1.default.invoice.update({
            where: { id: invoiceId },
            data: {
                status: 'DRAFT',
                rejectionReason: null,
            },
        });
        await notification_controller_1.NotificationController.notifyStatusChange({
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
    async approveInvoice(request, reply) {
        const { invoiceId } = request.params;
        const { id: companyId } = request.params;
        const userId = request.user.id;
        const role = await this.getUserRole(userId, companyId);
        // Include lines to get total and find accounts
        const invoice = await database_1.default.invoice.findUnique({
            where: { id: invoiceId },
            include: { lines: true }
        });
        if (!invoice)
            throw new errorHandler_1.NotFoundError('Invoice not found');
        if (!this.canApprove(invoice.status, role)) {
            throw new errorHandler_1.ForbiddenError(`Cannot approve this invoice from current status: ${invoice.status}`);
        }
        const updated = await database_1.default.$transaction(async (tx) => {
            // 1. Update Status
            const inv = await tx.invoice.update({
                where: { id: invoiceId },
                data: {
                    status: 'APPROVED',
                    approvedById: userId,
                    approvedAt: new Date(),
                },
            });
            // 2. Generate Multi-Line Journal Entry (Split-Payment Aware)
            await TransactionRepository_1.TransactionRepository.generateInvoiceJournal(tx, invoice, companyId, userId);
            return inv;
        });
        return reply.send({ success: true, data: updated });
    }
    // ============ JOURNALS ============
    async getJournals(request, reply) {
        const { id: companyId } = request.params;
        const { limit, page } = request.query;
        const take = limit ? parseInt(limit) : undefined;
        const skip = (page && take) ? (parseInt(page) - 1) * take : undefined;
        const journals = await TransactionRepository_1.TransactionRepository.findJournals({ companyId }, take, skip);
        return reply.send({ success: true, data: journals });
    }
    async getJournal(request, reply) {
        const { journalId } = request.params;
        const journal = await TransactionRepository_1.TransactionRepository.findJournalById(journalId);
        if (!journal)
            throw new errorHandler_1.NotFoundError('Journal not found');
        return reply.send({ success: true, data: journal });
    }
    async createJournal(request, reply) {
        const { id: companyId } = request.params;
        const data = request.body;
        const userId = request.user.id;
        const entryNumber = await this.generateDocumentNumber(companyId, 'journal');
        if (!data.lines || !Array.isArray(data.lines)) {
            throw new errorHandler_1.ValidationError('Journal lines are required');
        }
        const totalDebit = data.lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
        const totalCredit = data.lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            throw new errorHandler_1.ValidationError('Debit and Credit must be equal');
        }
        // Transaction Date Validation
        if (!data.date) {
            throw new errorHandler_1.ValidationError('Transaction date is required');
        }
        const journalDate = new Date(data.date);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const role = await this.getUserRole(userId, companyId);
        const isOwnerOrAdmin = role === 'Owner' || role === 'Admin';
        if (journalDate > today && !isOwnerOrAdmin) {
            throw new errorHandler_1.ValidationError('Future transaction dates are only allowed for owners');
        }
        // Accountants/Owners create as PENDING_VERIFICATION to make them visible to Managers immediately
        const status = (role === 'Accountant' || isOwnerOrAdmin) ? 'PENDING_VERIFICATION' : 'DRAFT';
        const journal = await TransactionRepository_1.TransactionRepository.createJournal({
            ...data,
            date: journalDate,
            entryNumber,
            companyId,
            branchId: data.branchId || null,
            totalDebit,
            totalCredit,
            createdById: userId,
            status,
            lines: {
                create: data.lines.map((l) => ({
                    ...l,
                    debitBase: l.debit * (data.exchangeRate || 1),
                    creditBase: l.credit * (data.exchangeRate || 1),
                    debitForeign: l.debit,
                    creditForeign: l.credit,
                    exchangeRate: data.exchangeRate || 1,
                })),
            },
        });
        // Log Structured Activity
        await notification_controller_1.NotificationController.logActivity({
            companyId,
            entityType: 'journal',
            entityId: journal.id,
            action: 'CREATED',
            performedById: userId,
            branchId: data.branchId || null,
            metadata: { docNumber: entryNumber }
        });
        // Create Notification if it's pending verification
        if (status === 'PENDING_VERIFICATION') {
            await database_1.default.notification.create({
                data: {
                    companyId,
                    type: 'PENDING_JOURNAL',
                    severity: 'WARNING',
                    title: 'New Voucher Awaiting Verification',
                    message: `Journal ${entryNumber} has been created and is awaiting verification.`,
                    entityType: 'JournalEntry',
                    entityId: journal.id
                }
            });
        }
        return reply.status(201).send({ success: true, data: journal });
    }
    async updateJournal(request, reply) {
        const { journalId } = request.params;
        const { id: companyId } = request.params;
        const userId = request.user.id;
        const data = request.body;
        const role = await this.getUserRole(userId, companyId);
        const journal = await database_1.default.journalEntry.findUnique({ where: { id: journalId } });
        if (!journal)
            throw new errorHandler_1.NotFoundError('Journal not found');
        if (!this.canEdit(journal.status, role, userId, journal.createdById)) {
            throw new errorHandler_1.ForbiddenError('Cannot edit this journal in current status');
        }
        const { lines, ...otherData } = data;
        const updated = await database_1.default.$transaction(async (tx) => {
            if (lines) {
                await tx.journalEntryLine.deleteMany({ where: { journalEntryId: journalId } });
            }
            return await tx.journalEntry.update({
                where: { id: journalId },
                data: {
                    ...otherData,
                    date: otherData.date ? new Date(otherData.date) : undefined,
                    lines: lines ? {
                        create: lines.map((l) => ({
                            accountId: l.accountId,
                            description: l.description,
                            debit: l.debitCredit === 'debit' ? Number(l.amount) : 0,
                            credit: l.debitCredit === 'credit' ? Number(l.amount) : 0,
                            debitBase: l.debitCredit === 'debit' ? Number(l.amount) : 0,
                            creditBase: l.debitCredit === 'credit' ? Number(l.amount) : 0,
                        }))
                    } : undefined
                },
                include: { lines: true },
            });
        });
        return reply.send({ success: true, data: updated });
    }
    async deleteJournal(request, reply) {
        const { journalId } = request.params;
        const { id: companyId } = request.params;
        const userId = request.user.id;
        const role = await this.getUserRole(userId, companyId);
        const journal = await database_1.default.journalEntry.findUnique({ where: { id: journalId } });
        if (!journal)
            throw new errorHandler_1.NotFoundError('Journal not found');
        if (!this.canDelete(journal.status, role)) {
            throw new errorHandler_1.ForbiddenError('Cannot delete this journal');
        }
        await database_1.default.journalEntry.delete({ where: { id: journalId } });
        return reply.send({ success: true, message: 'Journal deleted' });
    }
    async verifyJournal(request, reply) {
        const { journalId } = request.params;
        const { id: companyId } = request.params;
        const userId = request.user.id;
        const role = await this.getUserRole(userId, companyId);
        const journal = await database_1.default.journalEntry.findUnique({ where: { id: journalId } });
        if (!journal)
            throw new errorHandler_1.NotFoundError('Journal not found');
        // Manager check: simplified to allow verification of any journal in the company
        // Original team check was too restrictive without explicit managerId linkage
        /*
        if (role === 'Manager') {
          const subordinateIds = await this.getSubordinateIds(userId);
          if (!subordinateIds.includes(journal.createdById)) {
            throw new ForbiddenError('You can only verify journals from your team');
          }
        }
        */
        if (!this.canVerify(journal.status, role)) {
            throw new errorHandler_1.ForbiddenError('Cannot verify this journal');
        }
        const updated = await database_1.default.journalEntry.update({
            where: { id: journalId },
            data: {
                status: 'VERIFIED',
                verifiedById: userId,
                verifiedAt: new Date(),
            },
        });
        await notification_controller_1.NotificationController.notifyStatusChange({
            companyId: journal.companyId,
            entityType: 'JournalEntry',
            entityId: journal.id,
            entityNumber: journal.entryNumber,
            oldStatus: journal.status,
            newStatus: 'VERIFIED',
            performedById: userId
        });
        return reply.send({ success: true, data: updated });
    }
    async rejectJournal(request, reply) {
        const { journalId } = request.params;
        const { id: companyId } = request.params;
        const { reason } = request.body;
        const userId = request.user.id;
        const role = await this.getUserRole(userId, companyId);
        const journal = await database_1.default.journalEntry.findUnique({ where: { id: journalId } });
        if (!journal)
            throw new errorHandler_1.NotFoundError('Journal not found');
        // Allow rejection from PENDING_VERIFICATION (Manager/Owner) OR PENDING_APPROVAL (Owner/Admin)
        const canReject = (journal.status === 'PENDING_VERIFICATION' && (role === 'Manager' || role === 'Owner' || role === 'Admin')) ||
            (journal.status === 'PENDING_APPROVAL' && (role === 'Owner' || role === 'Admin')) ||
            (journal.status === 'VERIFIED' && (role === 'Owner' || role === 'Admin'));
        if (!canReject) {
            throw new errorHandler_1.ForbiddenError('Cannot reject this journal');
        }
        const updated = await database_1.default.journalEntry.update({
            where: { id: journalId },
            data: {
                status: 'REJECTED',
                rejectedById: userId,
                rejectionReason: reason,
            },
        });
        await notification_controller_1.NotificationController.notifyStatusChange({
            companyId: journal.companyId,
            entityType: 'JournalEntry',
            entityId: journal.id,
            entityNumber: journal.entryNumber,
            oldStatus: journal.status,
            newStatus: 'REJECTED',
            performedById: userId,
            reason
        });
        return reply.send({ success: true, data: updated });
    }
    async retrieveJournal(request, reply) {
        const { journalId } = request.params;
        const { id: companyId } = request.params;
        const userId = request.user.id;
        const role = await this.getUserRole(userId, companyId);
        if (role !== 'Accountant' && role !== 'Owner') {
            throw new errorHandler_1.ForbiddenError('Only Accountants or Owners can retrieve journals');
        }
        const updated = await database_1.default.journalEntry.update({
            where: { id: journalId },
            data: { status: 'DRAFT', rejectionReason: null },
        });
        await notification_controller_1.NotificationController.notifyStatusChange({
            companyId,
            entityType: 'JournalEntry',
            entityId: journalId,
            entityNumber: updated.entryNumber,
            oldStatus: 'REJECTED',
            newStatus: 'DRAFT',
            performedById: userId
        });
        return reply.send({ success: true, data: updated });
    }
    async submitJournal(request, reply) {
        const { journalId } = request.params;
        const { id: companyId } = request.params;
        const userId = request.user.id;
        const role = await this.getUserRole(userId, companyId);
        if (role !== 'Accountant' && role !== 'Owner') {
            throw new errorHandler_1.ForbiddenError('Only Accountants or Owners can submit journals');
        }
        const journal = await database_1.default.journalEntry.findUnique({ where: { id: journalId } });
        if (!journal)
            throw new errorHandler_1.NotFoundError('Journal not found');
        if (journal.status !== 'DRAFT' && journal.status !== 'REJECTED') {
            throw new errorHandler_1.ValidationError('Only DRAFT or REJECTED journals can be submitted');
        }
        const updated = await database_1.default.journalEntry.update({
            where: { id: journalId },
            data: { status: 'PENDING_VERIFICATION' },
        });
        await notification_controller_1.NotificationController.notifyStatusChange({
            companyId,
            entityType: 'JournalEntry',
            entityId: journalId,
            entityNumber: updated.entryNumber,
            oldStatus: journal.status,
            newStatus: 'PENDING_VERIFICATION',
            performedById: userId
        });
        return reply.send({ success: true, data: updated });
    }
    async approveJournal(request, reply) {
        const { journalId } = request.params;
        const { id: companyId } = request.params;
        const userId = request.user.id;
        const role = await this.getUserRole(userId, companyId);
        const journal = await database_1.default.journalEntry.findUnique({
            where: { id: journalId },
            include: { lines: { include: { account: { include: { accountType: true } } } } }
        });
        if (!journal)
            throw new errorHandler_1.NotFoundError('Journal not found');
        if (!this.canApprove(journal.status, role)) {
            throw new errorHandler_1.ForbiddenError(`Cannot approve this journal from current status: ${journal.status}`);
        }
        const updated = await database_1.default.$transaction(async (tx) => {
            // 1. Update Journal Status
            const jrnl = await tx.journalEntry.update({
                where: { id: journalId },
                data: {
                    status: 'APPROVED',
                    approvedById: userId,
                    approvedAt: new Date(),
                },
            });
            await notification_controller_1.NotificationController.notifyStatusChange({
                companyId: journal.companyId,
                entityType: 'JournalEntry',
                entityId: journal.id,
                entityNumber: journal.entryNumber,
                oldStatus: journal.status,
                newStatus: 'APPROVED',
                performedById: userId
            });
            // 2. Validate and Update Account Balances
            const isOwnerOrAdmin = role === 'Owner' || role === 'Admin';
            for (const line of journal.lines) {
                const isDebitType = line.account.accountType.type === 'DEBIT';
                const balanceChange = isDebitType
                    ? (Number(line.debitBase) - Number(line.creditBase))
                    : (Number(line.creditBase) - Number(line.debitBase));
                const potentialBalance = Number(line.account.currentBalance) + balanceChange;
                // Negative Balance Validation (Global Guard)
                if (potentialBalance < 0 && !line.account.allowNegative && !isOwnerOrAdmin) {
                    throw new errorHandler_1.ValidationError(`Transaction rejected: ${line.account.name} balance (${potentialBalance.toLocaleString()}) would be negative. Negative balance (overdraft) is not permitted for this account.`);
                }
                await tx.account.update({
                    where: { id: line.accountId },
                    data: {
                        currentBalance: {
                            increment: balanceChange
                        }
                    }
                });
            }
            return jrnl;
        });
        return reply.send({ success: true, data: updated });
    }
    // ============ REPORTS ============
    async getTrialBalance(request, reply) {
        const { id: companyId } = request.params;
        const accounts = await database_1.default.account.findMany({
            where: { companyId, isActive: true },
            include: {
                accountType: true,
                journalLines: {
                    where: { journalEntry: { status: 'APPROVED' } },
                    include: { journalEntry: true },
                },
            },
        });
        const data = accounts.map((acc) => {
            const totalDebit = acc.journalLines.reduce((sum, line) => sum + line.debit, 0);
            const totalCredit = acc.journalLines.reduce((sum, line) => sum + line.credit, 0);
            const balance = acc.openingBalance + totalDebit - totalCredit;
            return {
                code: acc.code,
                name: acc.name,
                type: acc.accountType.type,
                debit: balance > 0 ? balance : 0,
                credit: balance < 0 ? Math.abs(balance) : 0,
            };
        });
        return reply.send({ success: true, data });
    }
    async getLedger(request, reply) {
        const { id: companyId } = request.params;
        const { accountId } = request.query;
        const where = { companyId, status: 'APPROVED' };
        if (accountId) {
            where.lines = { some: { accountId } };
        }
        const journals = await database_1.default.journalEntry.findMany({
            where,
            include: {
                lines: {
                    include: { account: true },
                    where: accountId ? { accountId } : undefined,
                },
                createdBy: { select: { firstName: true, lastName: true } },
            },
            orderBy: { date: 'asc' },
        });
        return reply.send({ success: true, data: journals });
    }
    async getBalanceSheet(request, reply) {
        const { id: companyId } = request.params;
        // Get asset and liability accounts
        const assets = await database_1.default.account.findMany({
            where: { companyId, accountType: { name: 'ASSET' }, isActive: true },
        });
        const liabilities = await database_1.default.account.findMany({
            where: { companyId, accountType: { name: 'LIABILITY' }, isActive: true },
        });
        const equity = await database_1.default.account.findMany({
            where: { companyId, accountType: { name: 'EQUITY' }, isActive: true },
        });
        return reply.send({
            success: true,
            data: {
                assets: assets.map((a) => ({ name: a.name, balance: a.currentBalance })),
                liabilities: liabilities.map((l) => ({ name: l.name, balance: Math.abs(l.currentBalance) })),
                equity: equity.map((e) => ({ name: e.name, balance: Math.abs(e.currentBalance) })),
            },
        });
    }
    async getProfitLoss(request, reply) {
        const { id: companyId } = request.params;
        const income = await database_1.default.account.findMany({
            where: { companyId, accountType: { name: 'INCOME' }, isActive: true },
        });
        const expenses = await database_1.default.account.findMany({
            where: { companyId, accountType: { name: 'EXPENSE' }, isActive: true },
        });
        const totalIncome = income.reduce((sum, a) => sum + Math.abs(a.currentBalance), 0);
        const totalExpense = expenses.reduce((sum, a) => sum + Math.abs(a.currentBalance), 0);
        const netProfit = totalIncome - totalExpense;
        return reply.send({
            success: true,
            data: {
                income: income.map((i) => ({ name: i.name, amount: Math.abs(i.currentBalance) })),
                expenses: expenses.map((e) => ({ name: e.name, amount: Math.abs(e.currentBalance) })),
                totalIncome,
                totalExpense,
                netProfit,
            },
        });
    }
    // Documents moved to AttachmentController
    // Helper: Get all subordinate IDs recursively
    async getSubordinateIds(managerId) {
        const subordinates = await database_1.default.user.findMany({ where: { managerId } });
        let ids = subordinates.map((s) => s.id);
        for (const sub of subordinates) {
            const subIds = await this.getSubordinateIds(sub.id);
            ids = [...ids, ...subIds];
        }
        return ids;
    }
    // ============================================
    // EMPLOYEE MANAGEMENT
    // ============================================
    async getEmployees(request, reply) {
        const { id: companyId } = request.params;
        const employees = await database_1.default.employee.findMany({
            where: { companyId },
            orderBy: { createdAt: 'desc' },
        });
        return reply.send({ success: true, data: employees });
    }
    async createEmployee(request, reply) {
        try {
            const { id: companyId } = request.params;
            const { firstName, lastName, email, phone, designation, department, joinDate, salary } = request.body;
            if (!firstName || !lastName) {
                return reply.status(400).send({ success: false, error: 'First name and last name are required' });
            }
            const count = await database_1.default.employee.count({ where: { companyId } });
            const employeeCode = `EMP-${String(count + 1).padStart(4, '0')}`;
            const employee = await database_1.default.employee.create({
                data: {
                    employeeCode,
                    firstName: String(firstName),
                    lastName: String(lastName),
                    email: email || null,
                    phone: phone || null,
                    designation: designation || null,
                    department: department || null,
                    joinDate: joinDate ? new Date(joinDate) : null,
                    salary: salary ? parseFloat(salary) : 0,
                    companyId,
                },
            });
            return reply.send({ success: true, data: employee });
        }
        catch (error) {
            console.error('Error creating employee:', error);
            return reply.status(500).send({ success: false, error: error.message || 'Internal server error' });
        }
    }
    async updateEmployee(request, reply) {
        const { id: companyId, employeeId } = request.params;
        const data = request.body;
        const employee = await database_1.default.employee.update({
            where: { id: employeeId },
            data: {
                ...data,
                joinDate: data.joinDate ? new Date(data.joinDate) : undefined,
            },
        });
        return reply.send({ success: true, data: employee });
    }
    async deleteEmployee(request, reply) {
        const { employeeId } = request.params;
        await database_1.default.employee.delete({ where: { id: employeeId } });
        return reply.send({ success: true });
    }
    // Employee Advances
    async getEmployeeAdvances(request, reply) {
        const { id: companyId } = request.params;
        const advances = await database_1.default.employeeAdvance.findMany({
            where: { companyId },
            include: { employee: true, account: true },
            orderBy: { date: 'desc' },
        });
        return reply.send({ success: true, data: advances });
    }
    async createEmployeeAdvance(request, reply) {
        const { id: companyId } = request.params;
        const { employeeId, amount, purpose, date, paymentMethod, accountId } = request.body;
        const advance = await database_1.default.employeeAdvance.create({
            data: {
                employeeId,
                amount: parseFloat(amount),
                purpose,
                date: new Date(date),
                paymentMethod,
                accountId,
                companyId,
            },
        });
        return reply.send({ success: true, data: advance });
    }
    async updateEmployeeAdvance(request, reply) {
        const { id: companyId, advanceId } = request.params;
        const data = request.body;
        const userId = request.user.id;
        const existing = await database_1.default.employeeAdvance.findUnique({ where: { id: advanceId } });
        if (!existing)
            throw new errorHandler_1.NotFoundError('Advance not found');
        const role = await this.getUserRole(userId, companyId);
        if (!this.canEdit(existing.status, role)) {
            throw new errorHandler_1.ForbiddenError('Cannot edit this advance in current status');
        }
        const advance = await database_1.default.employeeAdvance.update({
            where: { id: advanceId },
            data: {
                ...data,
                date: data.date ? new Date(data.date) : undefined,
            },
        });
        return reply.send({ success: true, data: advance });
    }
    async deleteEmployeeAdvance(request, reply) {
        const { id: companyId, advanceId } = request.params;
        const userId = request.user.id;
        const existing = await database_1.default.employeeAdvance.findUnique({ where: { id: advanceId } });
        if (!existing)
            throw new errorHandler_1.NotFoundError('Advance not found');
        const role = await this.getUserRole(userId, companyId);
        if (!this.canDelete(existing.status, role)) {
            throw new errorHandler_1.ForbiddenError('Cannot delete this advance');
        }
        await database_1.default.employeeAdvance.delete({ where: { id: advanceId } });
        return reply.send({ success: true });
    }
    async approveEmployeeAdvance(request, reply) {
        try {
            const { id: companyId, advanceId } = request.params;
            const userId = request.user.id;
            const advance = await database_1.default.employeeAdvance.findUnique({
                where: { id: advanceId },
                include: { employee: true },
            });
            if (!advance) {
                throw new errorHandler_1.NotFoundError('Advance not found');
            }
            // Generate journal entry
            const entryNumber = await this.generateDocumentNumber(companyId, 'journal');
            // Get default accounts using categories and fallbacks
            const cashAccount = await AccountRepository_1.AccountRepository.findByCategory(companyId, 'CASH');
            const bankAccount = await AccountRepository_1.AccountRepository.findByCategory(companyId, 'BANK');
            const advanceAccount = await database_1.default.account.findFirst({
                where: {
                    companyId,
                    OR: [
                        { category: 'ASSET' },
                        { name: { contains: 'Advance', mode: 'insensitive' } }
                    ],
                    isActive: true
                },
            });
            const employeePayableAccount = await database_1.default.account.findFirst({
                where: {
                    companyId,
                    OR: [
                        { category: 'AP' },
                        { name: { contains: 'Employee', mode: 'insensitive' } }
                    ],
                    isActive: true
                },
            });
            const creditAccountId = (advance.accountId || cashAccount?.id || bankAccount?.id);
            const debitAccountId = (employeePayableAccount?.id || advanceAccount?.id || creditAccountId);
            if (!debitAccountId || !creditAccountId) {
                throw new errorHandler_1.ValidationError('Required accounts (Cash/Bank or Employee/Advance) not found.', 'Please ensure you have accounts with categories CASH, BANK, or AP (Accounts Payable) configured in your Chart of Accounts.');
            }
            // Create journal entry
            const journal = await database_1.default.journalEntry.create({
                data: {
                    entryNumber,
                    date: advance.date,
                    description: `Advance for ${advance.employee.firstName} ${advance.employee.lastName} - ${advance.purpose || ''}`,
                    companyId,
                    createdById: userId,
                    status: 'APPROVED',
                    totalDebit: advance.amount,
                    totalCredit: advance.amount,
                    lines: {
                        create: [
                            {
                                accountId: debitAccountId,
                                debit: advance.amount,
                                credit: 0,
                                debitBase: advance.amount,
                                creditBase: 0,
                                debitForeign: advance.amount,
                                creditForeign: 0,
                                exchangeRate: 1,
                            },
                            {
                                accountId: creditAccountId,
                                debit: 0,
                                credit: advance.amount,
                                debitBase: 0,
                                creditBase: advance.amount,
                                debitForeign: 0,
                                creditForeign: advance.amount,
                                exchangeRate: 1,
                            },
                        ],
                    },
                },
                include: { lines: { include: { account: true } } },
            });
            // Update advance status
            await database_1.default.employeeAdvance.update({
                where: { id: advanceId },
                data: { status: 'APPROVED', journalEntryId: journal.id },
            });
            return reply.send({ success: true, data: { advance, journal } });
        }
        catch (error) {
            console.error('Error approving employee advance:', error);
            return reply.status(500).send({ success: false, error: error.message || 'Internal server error' });
        }
    }
    // Employee Loans
    async getEmployeeLoans(request, reply) {
        const { id: companyId } = request.params;
        const loans = await database_1.default.employeeLoan.findMany({
            where: { companyId },
            include: { employee: true, repayments: true },
            orderBy: { startDate: 'desc' },
        });
        return reply.send({ success: true, data: loans });
    }
    async createEmployeeLoan(request, reply) {
        const { id: companyId } = request.params;
        const { employeeId, principalAmount, interestRate, installments, startDate, purpose } = request.body;
        const principal = parseFloat(principalAmount);
        const rate = parseFloat(interestRate || 0);
        const interestAmount = (principal * rate * (installments / 12)) / 100;
        const totalAmount = principal + interestAmount;
        const loan = await database_1.default.employeeLoan.create({
            data: {
                employeeId,
                principalAmount: principal,
                interestRate: rate,
                interestAmount,
                totalAmount,
                installments: parseInt(installments) || 1,
                startDate: new Date(startDate),
                purpose,
                companyId,
            },
        });
        return reply.send({ success: true, data: loan });
    }
    async updateEmployeeLoan(request, reply) {
        const { id: companyId, loanId } = request.params;
        const data = request.body;
        const userId = request.user.id;
        const existing = await database_1.default.employeeLoan.findUnique({ where: { id: loanId } });
        if (!existing)
            throw new errorHandler_1.NotFoundError('Loan not found');
        const role = await this.getUserRole(userId, companyId);
        if (!this.canEdit(existing.status, role)) {
            throw new errorHandler_1.ForbiddenError('Cannot edit this loan in current status');
        }
        if (data.principalAmount) {
            const principal = parseFloat(data.principalAmount);
            const rate = parseFloat(data.interestRate || 0);
            const installments = parseInt(data.installments || 1);
            const interestAmount = (principal * rate * (installments / 12)) / 100;
            data.interestAmount = interestAmount;
            data.totalAmount = principal + interestAmount;
        }
        const loan = await database_1.default.employeeLoan.update({
            where: { id: loanId },
            data: {
                ...data,
                startDate: data.startDate ? new Date(data.startDate) : undefined,
            },
        });
        return reply.send({ success: true, data: loan });
    }
    async deleteEmployeeLoan(request, reply) {
        const { id: companyId, loanId } = request.params;
        const userId = request.user.id;
        const existing = await database_1.default.employeeLoan.findUnique({ where: { id: loanId } });
        if (!existing)
            throw new errorHandler_1.NotFoundError('Loan not found');
        const role = await this.getUserRole(userId, companyId);
        if (!this.canDelete(existing.status, role)) {
            throw new errorHandler_1.ForbiddenError('Cannot delete this loan');
        }
        await database_1.default.employeeLoan.delete({ where: { id: loanId } });
        return reply.send({ success: true });
    }
    async approveEmployeeLoan(request, reply) {
        try {
            const { id: companyId, loanId } = request.params;
            const userId = request.user.id;
            const loan = await database_1.default.employeeLoan.findUnique({
                where: { id: loanId },
                include: { employee: true },
            });
            if (!loan) {
                throw new errorHandler_1.NotFoundError('Loan not found');
            }
            // Generate journal entry for loan disbursement
            const entryNumber = await this.generateDocumentNumber(companyId, 'journal');
            // Get default accounts using categories and regular lookups
            const cashAccount = await AccountRepository_1.AccountRepository.findByCategory(companyId, 'CASH');
            const bankAccount = await AccountRepository_1.AccountRepository.findByCategory(companyId, 'BANK');
            const loanAccount = await database_1.default.account.findFirst({
                where: {
                    companyId,
                    OR: [
                        { code: 'A-1381' },
                        { name: { contains: 'Loan', mode: 'insensitive' } }
                    ],
                    isActive: true
                },
            });
            const employeePayableAccount = await database_1.default.account.findFirst({
                where: {
                    companyId,
                    name: { contains: 'Employee Payable', mode: 'insensitive' },
                    isActive: true
                },
            });
            const creditAccountId = (cashAccount?.id || bankAccount?.id);
            const debitAccountId = (loanAccount?.id || employeePayableAccount?.id || creditAccountId);
            if (!debitAccountId || !creditAccountId) {
                throw new errorHandler_1.ValidationError('Required accounts (Cash/Bank or Loan) not found.', 'Please ensure you have accounts with categories CASH or BANK, or an account with "Loan" in its name configured.');
            }
            // Create journal entry for loan disbursement
            await database_1.default.journalEntry.create({
                data: {
                    entryNumber,
                    date: loan.startDate,
                    description: `Employee Loan for ${loan.employee.firstName} ${loan.employee.lastName} - ${loan.purpose || ''}`,
                    companyId,
                    createdById: userId,
                    status: 'APPROVED',
                    totalDebit: loan.principalAmount,
                    totalCredit: loan.principalAmount,
                    lines: {
                        create: [
                            {
                                accountId: debitAccountId,
                                debit: loan.principalAmount,
                                credit: 0,
                                debitBase: loan.principalAmount,
                                creditBase: 0,
                                debitForeign: loan.principalAmount,
                                creditForeign: 0,
                                exchangeRate: 1,
                            },
                            {
                                accountId: creditAccountId,
                                debit: 0,
                                credit: loan.principalAmount,
                                debitBase: 0,
                                creditBase: loan.principalAmount,
                                debitForeign: 0,
                                creditForeign: loan.principalAmount,
                                exchangeRate: 1,
                            },
                        ],
                    },
                },
            });
            await database_1.default.employeeLoan.update({
                where: { id: loanId },
                data: { status: 'ACTIVE' },
            });
            return reply.send({ success: true });
        }
        catch (error) {
            console.error('Error approving employee loan:', error);
            return reply.status(500).send({ success: false, error: error.message || 'Internal server error' });
        }
    }
    async getLoanRepayments(request, reply) {
        const { loanId } = request.params;
        const repayments = await database_1.default.employeeLoanRepayment.findMany({
            where: { loanId },
            orderBy: { paymentDate: 'desc' },
        });
        return reply.send({ success: true, data: repayments });
    }
    async createLoanRepayment(request, reply) {
        const { id: companyId, loanId } = request.params;
        const { amount, principalPaid, interestPaid, paymentDate } = request.body;
        const repayment = await database_1.default.employeeLoanRepayment.create({
            data: {
                loanId,
                amount: parseFloat(amount),
                principalPaid: parseFloat(principalPaid),
                interestPaid: parseFloat(interestPaid),
                paymentDate: new Date(paymentDate),
                companyId,
            },
        });
        return reply.send({ success: true, data: repayment });
    }
    async approveLoanRepayment(request, reply) {
        const { id: companyId, repaymentId } = request.params;
        const userId = request.user.id;
        const repayment = await database_1.default.employeeLoanRepayment.findUnique({
            where: { id: repaymentId },
            include: { loan: { include: { employee: true } } },
        });
        if (!repayment) {
            throw new errorHandler_1.NotFoundError('Repayment not found');
        }
        // Generate journal entry
        const entryNumber = await this.generateDocumentNumber(companyId, 'journal');
        // Get accounts using categories and fallbacks
        const cashAccount = await AccountRepository_1.AccountRepository.findByCategory(companyId, 'CASH');
        const bankAccount = await AccountRepository_1.AccountRepository.findByCategory(companyId, 'BANK');
        const loanAccount = await database_1.default.account.findFirst({
            where: {
                companyId,
                OR: [
                    { code: 'A-1381' },
                    { name: { contains: 'Loan', mode: 'insensitive' } }
                ],
                isActive: true
            },
        });
        const interestAccount = await database_1.default.account.findFirst({
            where: {
                companyId,
                OR: [
                    { category: 'INCOME' },
                    { name: { contains: 'Interest Income', mode: 'insensitive' } }
                ],
                isActive: true
            },
        });
        const cashAccountId = (cashAccount?.id || bankAccount?.id);
        const loanAccountId = (loanAccount?.id || cashAccountId);
        const interestAccountId = (interestAccount?.id || loanAccountId);
        if (!cashAccountId || !loanAccountId) {
            throw new errorHandler_1.ValidationError('Required accounts (Cash/Bank or Loan) not found for repayment.', 'Please ensure you have accounts with categories CASH or BANK, and an account with "Loan" in its name.');
        }
        // Create journal entry for repayment (Debit Cash, Credit Loan & Interest)
        const journal = await database_1.default.journalEntry.create({
            data: {
                entryNumber,
                date: repayment.paymentDate,
                description: `Loan Repayment for ${repayment.loan.employee.firstName} ${repayment.loan.employee.lastName}`,
                companyId,
                createdById: userId,
                status: 'APPROVED',
                totalDebit: repayment.amount,
                totalCredit: repayment.amount,
                lines: {
                    create: [
                        {
                            accountId: cashAccountId,
                            debit: repayment.amount,
                            credit: 0,
                            debitBase: repayment.amount,
                            creditBase: 0,
                            debitForeign: repayment.amount,
                            creditForeign: 0,
                            exchangeRate: 1,
                        },
                        {
                            accountId: loanAccountId,
                            debit: 0,
                            credit: repayment.principalPaid,
                            debitBase: 0,
                            creditBase: repayment.principalPaid,
                            debitForeign: 0,
                            creditForeign: repayment.principalPaid,
                            exchangeRate: 1,
                        },
                        {
                            accountId: interestAccountId,
                            debit: 0,
                            credit: repayment.interestPaid,
                            debitBase: 0,
                            creditBase: repayment.interestPaid,
                            debitForeign: 0,
                            creditForeign: repayment.interestPaid,
                            exchangeRate: 1,
                        },
                    ],
                },
            },
            include: { lines: { include: { account: true } } },
        });
        // Update repayment status
        await database_1.default.employeeLoanRepayment.update({
            where: { id: repaymentId },
            data: { status: 'APPROVED', journalEntryId: journal.id },
        });
        // Check if loan is fully paid
        const totalRepaid = await database_1.default.employeeLoanRepayment.aggregate({
            where: { loanId: repayment.loanId, status: 'APPROVED' },
            _sum: { amount: true },
        });
        const loan = await database_1.default.employeeLoan.findUnique({ where: { id: repayment.loanId } });
        if (loan && (totalRepaid._sum.amount || 0) >= loan.totalAmount) {
            await database_1.default.employeeLoan.update({
                where: { id: repayment.loanId },
                data: { status: 'COMPLETED' },
            });
        }
        return reply.send({ success: true, data: { repayment, journal } });
    }
    // Employee Expenses
    async getEmployeeExpenses(request, reply) {
        const { id: companyId } = request.params;
        const expenses = await database_1.default.employeeExpense.findMany({
            where: { companyId },
            include: { employee: true, account: true },
            orderBy: { date: 'desc' },
        });
        return reply.send({ success: true, data: expenses });
    }
    async createEmployeeExpense(request, reply) {
        const { id: companyId } = request.params;
        const { employeeId, amount, description, category, date, paymentMethod, accountId } = request.body;
        const expense = await database_1.default.employeeExpense.create({
            data: {
                employeeId,
                amount: parseFloat(amount),
                description,
                category,
                date: new Date(date),
                paymentMethod,
                accountId,
                companyId,
            },
        });
        return reply.send({ success: true, data: expense });
    }
    async updateEmployeeExpense(request, reply) {
        const { id: companyId, expenseId } = request.params;
        const data = request.body;
        const userId = request.user.id;
        const existing = await database_1.default.employeeExpense.findUnique({ where: { id: expenseId } });
        if (!existing)
            throw new errorHandler_1.NotFoundError('Expense not found');
        const role = await this.getUserRole(userId, companyId);
        if (!this.canEdit(existing.status, role)) {
            throw new errorHandler_1.ForbiddenError('Cannot edit this expense in current status');
        }
        const expense = await database_1.default.employeeExpense.update({
            where: { id: expenseId },
            data: {
                ...data,
                date: data.date ? new Date(data.date) : undefined,
            },
        });
        return reply.send({ success: true, data: expense });
    }
    async deleteEmployeeExpense(request, reply) {
        const { id: companyId, expenseId } = request.params;
        const userId = request.user.id;
        const existing = await database_1.default.employeeExpense.findUnique({ where: { id: expenseId } });
        if (!existing)
            throw new errorHandler_1.NotFoundError('Expense not found');
        const role = await this.getUserRole(userId, companyId);
        if (!this.canDelete(existing.status, role)) {
            throw new errorHandler_1.ForbiddenError('Cannot delete this expense');
        }
        await database_1.default.employeeExpense.delete({ where: { id: expenseId } });
        return reply.send({ success: true });
    }
    async approveEmployeeExpense(request, reply) {
        const { id: companyId, expenseId } = request.params;
        const userId = request.user.id;
        const expense = await database_1.default.employeeExpense.findUnique({
            where: { id: expenseId },
            include: { employee: true },
        });
        if (!expense) {
            throw new errorHandler_1.NotFoundError('Expense not found');
        }
        // Generate journal entry
        const entryNumber = await this.generateDocumentNumber(companyId, 'journal');
        // Get accounts using structured discovery
        const cashAccount = await AccountRepository_1.AccountRepository.findByCategory(companyId, 'CASH');
        const bankAccount = await AccountRepository_1.AccountRepository.findByCategory(companyId, 'BANK');
        // Get expense account based on category (from the expense entry)
        const expenseAccount = await database_1.default.account.findFirst({
            where: {
                companyId,
                name: { contains: expense.category, mode: 'insensitive' },
                isActive: true
            },
        });
        const salaryAccount = await database_1.default.account.findFirst({
            where: {
                companyId,
                OR: [
                    { name: { contains: 'Salary', mode: 'insensitive' } },
                    { name: { contains: 'Wage', mode: 'insensitive' } }
                ],
                isActive: true
            },
        });
        const debitAccountId = (expenseAccount?.id || salaryAccount?.id || (cashAccount?.id || bankAccount?.id));
        const creditAccountId = (expense.accountId || cashAccount?.id || bankAccount?.id);
        if (!debitAccountId || !creditAccountId) {
            throw new errorHandler_1.ValidationError('Account discovery failed for expense approval.', 'Please ensure you have accounts categorized as CASH or BANK, or an expense account matching the category (e.g., Salary, Food, Medical).');
        }
        // Create journal entry
        const journal = await database_1.default.journalEntry.create({
            data: {
                entryNumber,
                date: expense.date,
                description: `${expense.category} - ${expense.employee.firstName} ${expense.employee.lastName} - ${expense.description || ''}`,
                companyId,
                createdById: userId,
                status: 'APPROVED',
                totalDebit: expense.amount,
                totalCredit: expense.amount,
                lines: {
                    create: [
                        {
                            accountId: debitAccountId,
                            debit: expense.amount,
                            credit: 0,
                            debitBase: expense.amount,
                            creditBase: 0,
                            debitForeign: expense.amount,
                            creditForeign: 0,
                            exchangeRate: 1,
                        },
                        {
                            accountId: creditAccountId,
                            debit: 0,
                            credit: expense.amount,
                            debitBase: 0,
                            creditBase: expense.amount,
                            debitForeign: 0,
                            creditForeign: expense.amount,
                            exchangeRate: 1,
                        },
                    ],
                },
            },
            include: { lines: { include: { account: true } } },
        });
        // Update expense status
        await database_1.default.employeeExpense.update({
            where: { id: expenseId },
            data: { status: 'APPROVED', journalEntryId: journal.id },
        });
        return reply.send({ success: true, data: { expense, journal } });
    }
}
exports.CompanyController = CompanyController;
//# sourceMappingURL=company.controller.js.map