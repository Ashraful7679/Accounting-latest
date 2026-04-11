import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';
import { CustomerRepository } from '../../repositories/CustomerRepository';
import { VendorRepository } from '../../repositories/VendorRepository';
import { TransactionRepository } from '../../repositories/TransactionRepository';
import { NotificationController } from './notification.controller';
import { BaseCompanyController } from './base.controller';

export class EntityController extends BaseCompanyController {
  // ============ CUSTOMERS ============
  async getCustomers(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const customers = await CustomerRepository.findMany({ companyId });
    return reply.send({ success: true, data: customers });
  }

  async createCustomer(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { 
      name, email, phone, address, city, country,
      contactPerson, tinVat, openingBalance, balanceType, creditLimit, preferredCurrency, exchangeRate
    } = request.body as any;

    const code = await this.generateDocumentNumber(companyId, 'customer');
    
    const openingBalanceBDT = Number(openingBalance || 0) * Number(exchangeRate || 1);

    let customer;
    try {
      customer = await prisma.$transaction(async (tx) => {
        const c = await CustomerRepository.create({ 
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
          await TransactionRepository.ensureEntityAccount(tx, companyId, c.id, c.name, c.code, 'AR', openingBalanceBDT);
        } catch (e) {
          console.error('Failed to create customer account:', e);
        }
        
        return c;
      });
    } catch (e) {
      console.error('Failed to create customer:', e);
      return reply.status(500).send({ success: false, error: 'Failed to create customer' });
    }

    // Log Activity
    await NotificationController.logActivity({
      companyId,
      entityType: 'customer',
      entityId: customer.id,
      action: 'CREATED',
      performedById: (request.user as any).id,
      metadata: { docNumber: code, name: customer.name }
    });

    return reply.status(201).send({ success: true, data: customer });
  }

  async updateCustomer(request: FastifyRequest, reply: FastifyReply) {
    const { customerId } = request.params as { customerId: string };
    const { exchangeRate, openingBalance, ...data } = request.body as any;

    let openingBalanceBDT = Number(openingBalance || 0);
    if (exchangeRate) {
      openingBalanceBDT = openingBalanceBDT * Number(exchangeRate);
    }

    // Update account balance if exchangeRate is provided
    if (exchangeRate) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.account.updateMany({
            where: { referenceId: customerId, category: 'AR' },
            data: { currentBalance: openingBalanceBDT }
          });
        });
      } catch (e) {
        console.error('Failed to update customer account balance:', e);
      }
    }

    const customer = await prisma.customer.update({
      where: { id: customerId },
      data,
    });

    return reply.send({ success: true, data: customer });
  }

  async deleteCustomer(request: FastifyRequest, reply: FastifyReply) {
    const { customerId } = request.params as { customerId: string };

    await prisma.customer.delete({ where: { id: customerId } });
    return reply.send({ success: true, message: 'Customer deleted' });
  }

  // ============ VENDORS ============
  async getVendors(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const vendors = await VendorRepository.findMany({ companyId });
    return reply.send({ success: true, data: vendors });
  }

  async createVendor(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { 
      name, email, phone, address, city, country,
      contactPerson, tinVat, openingBalance, balanceType, creditLimit, preferredCurrency, exchangeRate
    } = request.body as any;

    const code = await this.generateDocumentNumber(companyId, 'vendor');
    
    const openingBalanceBDT = Number(openingBalance || 0) * Number(exchangeRate || 1);

    let vendor;
    try {
      vendor = await prisma.$transaction(async (tx) => {
        const v = await VendorRepository.create({ 
          code, name, companyId, email, phone, address, city, country,
          contactPerson, tinVat, openingBalance, balanceType, creditLimit, preferredCurrency, exchangeRate
        }, tx);

        // Automated Ledger Account
        try {
          await TransactionRepository.ensureEntityAccount(tx, companyId, v.id, v.name, v.code, 'AP', openingBalanceBDT);
        } catch (e) {
          console.error('Failed to create vendor account:', e);
        }
        
        return v;
      });
    } catch (e) {
      console.error('Failed to create vendor:', e);
      return reply.status(500).send({ success: false, error: 'Failed to create vendor' });
    }

    // Log Activity
    await NotificationController.logActivity({
      companyId,
      entityType: 'vendor',
      entityId: vendor.id,
      action: 'CREATED',
      performedById: (request.user as any).id,
      metadata: { docNumber: code, name: vendor.name }
    });

    return reply.status(201).send({ success: true, data: vendor });
  }

  async updateVendor(request: FastifyRequest, reply: FastifyReply) {
    const { vendorId } = request.params as { vendorId: string };
    const { exchangeRate, openingBalance, ...data } = request.body as any;

    let openingBalanceBDT = Number(openingBalance || 0);
    if (exchangeRate) {
      openingBalanceBDT = openingBalanceBDT * Number(exchangeRate);
    }

    // Update the account balance in COA if exchangeRate is provided
    if (exchangeRate) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.account.updateMany({
            where: { referenceId: vendorId, category: 'AP' },
            data: { currentBalance: openingBalanceBDT }
          });
        });
      } catch (e) {
        console.error('Failed to update vendor account balance:', e);
      }
    }

    const vendor = await prisma.vendor.update({
      where: { id: vendorId },
      data,
    });

    return reply.send({ success: true, data: vendor });
  }

  async deleteVendor(request: FastifyRequest, reply: FastifyReply) {
    const { vendorId } = request.params as { vendorId: string };

    await prisma.vendor.delete({ where: { id: vendorId } });
    return reply.send({ success: true, message: 'Vendor deleted' });
  }
}
