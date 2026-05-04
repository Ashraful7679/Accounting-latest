import { FastifyRequest, FastifyReply } from 'fastify';
import prismaBase from '../../config/database';
import { randomBytes } from 'crypto';

// Portal controller uses schema fields not yet migrated (portalToken, portalExpiry,
// paymentDate, paymentMethod, totalBDT on Invoice, dueDate on PI, etc.).
// Cast to any until migration adds these fields.
const prisma = prismaBase as any;

export class PortalController {
  // Enable portal access for a customer
  static async enableCustomerPortal(request: FastifyRequest, reply: FastifyReply) {
    const { customerId } = request.params as { customerId: string };
    const { extendDays = 30 } = request.body as { extendDays?: number };

    try {
      const token = randomBytes(32).toString('hex');
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + (extendDays || 30));

      const customer = await prisma.customer.update({
        where: { id: customerId },
        data: { 
          portalEnabled: true, 
          portalToken: token,
          portalExpiry: expiry
        }
      });

      const portalUrl = `/portal/customer/${customer.companyId}/${token}`;

      return reply.send({ 
        success: true, 
        data: { 
          enabled: true,
          token,
          expiry,
          portalUrl,
          expiresAt: expiry.toISOString()
        } 
      });
    } catch (error) {
      console.error('Error enabling customer portal:', error);
      return reply.status(500).send({ error: 'Failed to enable portal' });
    }
  }

  // Enable portal access for a vendor
  static async enableVendorPortal(request: FastifyRequest, reply: FastifyReply) {
    const { vendorId } = request.params as { vendorId: string };
    const { extendDays = 30 } = request.body as { extendDays?: number };

    try {
      const token = randomBytes(32).toString('hex');
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + (extendDays || 30));

      const vendor = await prisma.vendor.update({
        where: { id: vendorId },
        data: { 
          portalEnabled: true, 
          portalToken: token,
          portalExpiry: expiry
        }
      });

      return reply.send({ 
        success: true, 
        data: { 
          enabled: true,
          token,
          expiry,
          expiresAt: expiry.toISOString()
        } 
      });
    } catch (error) {
      console.error('Error enabling vendor portal:', error);
      return reply.status(500).send({ error: 'Failed to enable portal' });
    }
  }

  // Disable portal access
  static async disablePortal(request: FastifyRequest, reply: FastifyReply) {
    const { type, id } = request.params as { type: string; id: string };

    try {
      if (type === 'customer') {
        await prisma.customer.update({
          where: { id },
          data: { portalEnabled: false, portalToken: null, portalExpiry: null }
        });
      } else {
        await prisma.vendor.update({
          where: { id },
          data: { portalEnabled: false, portalToken: null, portalExpiry: null }
        });
      }

      return reply.send({ success: true, data: { enabled: false } });
    } catch (error) {
      return reply.status(500).send({ error: 'Failed to disable portal' });
    }
  }

  // Public portal login (customer)
  static async customerLogin(request: FastifyRequest, reply: FastifyReply) {
    const { companyId, token } = request.params as { companyId: string; token: string };

    try {
      const customer = await prisma.customer.findFirst({
        where: { 
          portalToken: token,
          portalEnabled: true,
          companyId
        }
      });

      if (!customer) {
        return reply.status(401).send({ error: 'Invalid token' });
      }

      if (customer.portalExpiry && new Date() > customer.portalExpiry) {
        return reply.status(401).send({ error: 'Token expired' });
      }

      // Get summary data
      const invoices = await prisma.invoice.findMany({
        where: { customerId: customer.id, status: { in: ['APPROVED', 'PARTIALLY_PAID'] } },
        select: { total: true, totalBDT: true, status: true, invoiceDate: true, dueDate: true }
      });

      const payments = await prisma.payment.findMany({
        where: { customerId: customer.id },
        select: { amount: true, paymentDate: true }
      });

      const totalDue = invoices.reduce((sum, inv) => sum + Number(inv.totalBDT || 0), 0);
      const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

      return reply.send({
        success: true,
        data: {
          customer: {
            id: customer.id,
            code: customer.code,
            name: customer.name,
            email: customer.email,
            creditLimit: customer.creditLimit
          },
          summary: {
            totalInvoiceValue: totalDue + totalPaid,
            totalDue: totalDue - totalPaid,
            totalPaid,
            openInvoices: invoices.length
          }
        }
      });
    } catch (error) {
      console.error('Portal login error:', error);
      return reply.status(500).send({ error: 'Login failed' });
    }
  }

  // Public portal login (vendor)
  static async vendorLogin(request: FastifyRequest, reply: FastifyReply) {
    const { companyId, token } = request.params as { companyId: string; token: string };

    try {
      const vendor = await prisma.vendor.findFirst({
        where: { 
          portalToken: token,
          portalEnabled: true,
          companyId
        }
      });

      if (!vendor) {
        return reply.status(401).send({ error: 'Invalid token' });
      }

      if (vendor.portalExpiry && new Date() > vendor.portalExpiry) {
        return reply.status(401).send({ error: 'Token expired' });
      }

      // Get summary data
      const pis = await prisma.pI.findMany({
        where: { vendorId: vendor.id, status: { in: ['APPROVED', 'PARTIALLY_PAID'] } },
        select: { total: true, totalBDT: true, status: true, piDate: true, dueDate: true }
      });

      const payments = await prisma.payment.findMany({
        where: { vendorId: vendor.id },
        select: { amount: true, paymentDate: true }
      });

      const totalDue = pis.reduce((sum, pi) => sum + Number(pi.totalBDT || 0), 0);
      const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

      return reply.send({
        success: true,
        data: {
          vendor: {
            id: vendor.id,
            code: vendor.code,
            name: vendor.name,
            email: vendor.email,
            creditLimit: vendor.creditLimit
          },
          summary: {
            totalInvoiceValue: totalDue + totalPaid,
            totalDue: totalDue - totalPaid,
            totalPaid,
            openInvoices: pis.length
          }
        }
      });
    } catch (error) {
      console.error('Portal login error:', error);
      return reply.status(500).send({ error: 'Login failed' });
    }
  }

  // Get customer portal data
  static async getCustomerPortalData(request: FastifyRequest, reply: FastifyReply) {
    const { companyId, token } = request.params as { companyId: string; token: string };

    const customer = await prisma.customer.findFirst({
      where: { portalToken: token, portalEnabled: true, companyId }
    });

    if (!customer || (customer.portalExpiry && new Date() > customer.portalExpiry)) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // Get invoices
    const invoices = await prisma.invoice.findMany({
      where: { customerId: customer.id },
      include: { customer: { select: { name: true } } },
      orderBy: { invoiceDate: 'desc' },
      take: 50
    });

    // Get payments
    const payments = await prisma.payment.findMany({
      where: { customerId: customer.id },
      orderBy: { paymentDate: 'desc' },
      take: 50
    });

    // Calculate aging
    const now = new Date();
    const aging = { current: 0, days30: 0, days60: 0, days90Plus: 0 };

    for (const inv of invoices) {
      if (inv.status !== 'PAID' && inv.dueDate) {
        const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000);
        const amount = Number(inv.totalBDT || 0);
        
        if (daysOverdue <= 0) aging.current += amount;
        else if (daysOverdue <= 30) aging.days30 += amount;
        else if (daysOverdue <= 60) aging.days60 += amount;
        else aging.days90Plus += amount;
      }
    }

    return reply.send({
      success: true,
      data: {
        customer: {
          id: customer.id,
          code: customer.code,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          creditLimit: customer.creditLimit
        },
        invoices: invoices.map(inv => ({
          id: inv.id,
          number: inv.invoiceNumber,
          date: inv.invoiceDate,
          dueDate: inv.dueDate,
          total: inv.totalBDT,
          currency: inv.currency,
          status: inv.status
        })),
        payments: payments.map(pay => ({
          id: pay.id,
          amount: pay.amount,
          date: pay.paymentDate,
          method: pay.paymentMethod
        })),
        aging,
        summary: {
          totalInvoiceValue: invoices.reduce((s, i) => s + Number(i.totalBDT || 0), 0),
          totalDue: aging.current + aging.days30 + aging.days60 + aging.days90Plus,
          openInvoices: invoices.filter(i => i.status !== 'PAID').length
        }
      }
    });
  }

  // Get vendor portal data  
  static async getVendorPortalData(request: FastifyRequest, reply: FastifyReply) {
    const { companyId, token } = request.params as { companyId: string; token: string };

    const vendor = await prisma.vendor.findFirst({
      where: { portalToken: token, portalEnabled: true, companyId }
    });

    if (!vendor || (vendor.portalExpiry && new Date() > vendor.portalExpiry)) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    // Get purchase invoices
    const pis = await prisma.pI.findMany({
      where: { vendorId: vendor.id },
      orderBy: { piDate: 'desc' },
      take: 50
    });

    // Get payments
    const payments = await prisma.payment.findMany({
      where: { vendorId: vendor.id },
      orderBy: { paymentDate: 'desc' },
      take: 50
    });

    // Calculate aging
    const now = new Date();
    const aging = { current: 0, days30: 0, days60: 0, days90Plus: 0 };

    for (const pi of pis) {
      if (pi.status !== 'PAID' && pi.dueDate) {
        const daysOverdue = Math.floor((now.getTime() - new Date(pi.dueDate).getTime()) / 86400000);
        const amount = Number(pi.totalBDT || 0);
        
        if (daysOverdue <= 0) aging.current += amount;
        else if (daysOverdue <= 30) aging.days30 += amount;
        else if (daysOverdue <= 60) aging.days60 += amount;
        else aging.days90Plus += amount;
      }
    }

    return reply.send({
      success: true,
      data: {
        vendor: {
          id: vendor.id,
          code: vendor.code,
          name: vendor.name,
          email: vendor.email,
          phone: vendor.phone,
          address: vendor.address,
          creditLimit: vendor.creditLimit
        },
        invoices: pis.map(pi => ({
          id: pi.id,
          number: pi.piNumber,
          date: pi.piDate,
          dueDate: pi.dueDate,
          total: pi.totalBDT,
          currency: pi.currency,
          status: pi.status
        })),
        payments: payments.map(pay => ({
          id: pay.id,
          amount: pay.amount,
          date: pay.paymentDate,
          method: pay.paymentMethod
        })),
        aging,
        summary: {
          totalInvoiceValue: pis.reduce((s, i) => s + Number(i.totalBDT || 0), 0),
          totalDue: aging.current + aging.days30 + aging.days60 + aging.days90Plus,
          openInvoices: pis.filter(i => i.status !== 'PAID').length
        }
      }
    });
  }
}