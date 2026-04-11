"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EntityController = void 0;
const database_1 = __importDefault(require("../../config/database"));
const CustomerRepository_1 = require("../../repositories/CustomerRepository");
const VendorRepository_1 = require("../../repositories/VendorRepository");
const TransactionRepository_1 = require("../../repositories/TransactionRepository");
const notification_controller_1 = require("./notification.controller");
const base_controller_1 = require("./base.controller");
class EntityController extends base_controller_1.BaseCompanyController {
    // ============ CUSTOMERS ============
    async getCustomers(request, reply) {
        const { id: companyId } = request.params;
        const customers = await CustomerRepository_1.CustomerRepository.findMany({ companyId });
        return reply.send({ success: true, data: customers });
    }
    async createCustomer(request, reply) {
        const { id: companyId } = request.params;
        const { name, email, phone, address, city, country, contactPerson, tinVat, openingBalance, balanceType, creditLimit, preferredCurrency, exchangeRate } = request.body;
        const code = await this.generateDocumentNumber(companyId, 'customer');
        const openingBalanceBDT = Number(openingBalance || 0) * Number(exchangeRate || 1);
        let customer;
        try {
            customer = await database_1.default.$transaction(async (tx) => {
                const c = await CustomerRepository_1.CustomerRepository.create({
                    code, name, companyId, email, phone, address, city, country,
                    contactPerson, tinVat,
                    openingBalance: Number(openingBalance || 0),
                    balanceType,
                    creditLimit: Number(creditLimit || 0),
                    preferredCurrency: preferredCurrency || 'BDT',
                    exchangeRate: Number(exchangeRate || 1)
                }, tx);
                // Automated Ledger Account
                try {
                    await TransactionRepository_1.TransactionRepository.ensureEntityAccount(tx, companyId, c.id, c.name, c.code, 'AR', openingBalanceBDT);
                }
                catch (e) {
                    console.error('Failed to create customer account:', e);
                }
                return c;
            });
        }
        catch (e) {
            console.error('Failed to create customer:', e);
            return reply.status(500).send({ success: false, error: 'Failed to create customer' });
        }
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
        const { exchangeRate, openingBalance, ...data } = request.body;
        let openingBalanceBDT = Number(openingBalance || 0);
        if (exchangeRate) {
            openingBalanceBDT = openingBalanceBDT * Number(exchangeRate);
        }
        // Update account balance if exchangeRate is provided
        if (exchangeRate) {
            try {
                await database_1.default.$transaction(async (tx) => {
                    await tx.account.updateMany({
                        where: { referenceId: customerId, category: 'AR' },
                        data: { currentBalance: openingBalanceBDT }
                    });
                });
            }
            catch (e) {
                console.error('Failed to update customer account balance:', e);
            }
        }
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
        const { name, email, phone, address, city, country, contactPerson, tinVat, openingBalance, balanceType, creditLimit, preferredCurrency, exchangeRate } = request.body;
        const code = await this.generateDocumentNumber(companyId, 'vendor');
        const openingBalanceBDT = Number(openingBalance || 0) * Number(exchangeRate || 1);
        let vendor;
        try {
            vendor = await database_1.default.$transaction(async (tx) => {
                const v = await VendorRepository_1.VendorRepository.create({
                    code, name, companyId, email, phone, address, city, country,
                    contactPerson, tinVat, openingBalance, balanceType, creditLimit, preferredCurrency, exchangeRate
                }, tx);
                // Automated Ledger Account
                try {
                    await TransactionRepository_1.TransactionRepository.ensureEntityAccount(tx, companyId, v.id, v.name, v.code, 'AP', openingBalanceBDT);
                }
                catch (e) {
                    console.error('Failed to create vendor account:', e);
                }
                return v;
            });
        }
        catch (e) {
            console.error('Failed to create vendor:', e);
            return reply.status(500).send({ success: false, error: 'Failed to create vendor' });
        }
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
        const { exchangeRate, openingBalance, ...data } = request.body;
        let openingBalanceBDT = Number(openingBalance || 0);
        if (exchangeRate) {
            openingBalanceBDT = openingBalanceBDT * Number(exchangeRate);
        }
        // Update the account balance in COA if exchangeRate is provided
        if (exchangeRate) {
            try {
                await database_1.default.$transaction(async (tx) => {
                    await tx.account.updateMany({
                        where: { referenceId: vendorId, category: 'AP' },
                        data: { currentBalance: openingBalanceBDT }
                    });
                });
            }
            catch (e) {
                console.error('Failed to update vendor account balance:', e);
            }
        }
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
}
exports.EntityController = EntityController;
//# sourceMappingURL=entity.controller.js.map