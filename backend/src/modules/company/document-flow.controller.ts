import { FastifyRequest, FastifyReply } from 'fastify';
import prismaBase from '../../config/database';

// Cast to any — some relations (payments on Invoice/PI, deliveryChallans on SO, etc.)
// may not yet be in the typed Prisma client
const prisma = prismaBase as any;

export class DocumentFlowController {
  static async getSalesFlow(request: FastifyRequest, reply: FastifyReply) {
    const { entityType, entityId } = request.params as { entityType: string; entityId: string };

    try {
      const docs: any[] = [];

      if (entityType === 'invoice') {
        const invoice = await prisma.invoice.findUnique({
          where: { id: entityId },
          include: { 
            salesOrder: true, 
            deliveryChalan: true,
            payments: true
          }
        });
        
        if (!invoice) {
          return reply.status(404).send({ error: 'Invoice not found' });
        }

        if (invoice.salesOrderId) {
          docs.push({
            type: 'SALES_ORDER',
            number: invoice.salesOrder.soNumber,
            date: invoice.salesOrder.orderDate,
            status: invoice.salesOrder.status,
            id: invoice.salesOrderId,
            amount: invoice.salesOrder.totalBDT
          });
        }

        if (invoice.deliveryChalanId) {
          docs.push({
            type: 'DELIVERY_CHALLAN',
            number: invoice.deliveryChalan.dcNumber,
            date: invoice.deliveryChalan.dcDate,
            status: invoice.deliveryChalan.status,
            id: invoice.deliveryChalanId,
            amount: invoice.total
          });
        }

        docs.push({
          type: 'INVOICE',
          number: invoice.invoiceNumber,
          date: invoice.invoiceDate,
          status: invoice.status,
          id: invoice.id,
          amount: invoice.totalBDT
        });

        for (const payment of invoice.payments || []) {
          docs.push({
            type: 'PAYMENT',
            number: `PAY-${payment.id.slice(0, 8)}`,
            date: payment.paymentDate,
            status: 'PAID',
            id: payment.id,
            amount: payment.amount
          });
        }
      } 
      else if (entityType === 'sales-order') {
        const so = await prisma.salesOrder.findUnique({
          where: { id: entityId },
          include: { 
            customer: true,
            deliveryChallans: true,
            invoices: true 
          }
        });

        if (!so) {
          return reply.status(404).send({ error: 'Sales Order not found' });
        }

        docs.push({
          type: 'SALES_ORDER',
          number: so.soNumber,
          date: so.soDate,
          status: so.status,
          id: so.id,
          amount: so.totalBDT
        });

        for (const dc of so.deliveryChallans || []) {
          docs.push({
            type: 'DELIVERY_CHALLAN',
            number: dc.dcNumber,
            date: dc.dcDate,
            status: dc.status,
            id: dc.id,
            amount: dc.total
          });
        }

        for (const inv of so.invoices || []) {
          docs.push({
            type: 'INVOICE',
            number: inv.invoiceNumber,
            date: inv.invoiceDate,
            status: inv.status,
            id: inv.id,
            amount: inv.totalBDT
          });
        }
      }
      else if (entityType === 'customer') {
        const customerInvoices = await prisma.invoice.findMany({
          where: { customerId: entityId },
          include: { salesOrder: true, payments: true },
          orderBy: { invoiceDate: 'desc' },
          take: 10
        });

        for (const inv of customerInvoices.slice(0, 5)) {
          docs.push({
            type: 'INVOICE',
            number: inv.invoiceNumber,
            date: inv.invoiceDate,
            status: inv.status,
            id: inv.id,
            amount: inv.totalBDT
          });
          
          if (inv.salesOrder) {
            docs.push({
              type: 'SALES_ORDER',
              number: inv.salesOrder.soNumber,
              date: inv.salesOrder.orderDate,
              status: inv.salesOrder.status,
              id: inv.salesOrderId!,
              amount: inv.salesOrder.totalBDT
            });
          }
        }
      }

      return reply.send({ success: true, data: docs });
    } catch (error) {
      console.error('Error fetching document flow:', error);
      return reply.status(500).send({ error: 'Failed to fetch document flow' });
    }
  }

  static async getPurchaseFlow(request: FastifyRequest, reply: FastifyReply) {
    const { entityType, entityId } = request.params as { entityType: string; entityId: string };

    try {
      const docs: any[] = [];

      if (entityType === 'pi') {
        const pi = await prisma.pI.findUnique({
          where: { id: entityId },
          include: { 
            purchaseOrder: true,
            grns: true,
            payments: true
          }
        });

        if (!pi) {
          return reply.status(404).send({ error: 'PI not found' });
        }

        if (pi.purchaseOrderId) {
          docs.push({
            type: 'PURCHASE_ORDER',
            number: pi.purchaseOrder.orderNumber,
            date: pi.purchaseOrder.orderDate,
            status: pi.purchaseOrder.status,
            id: pi.purchaseOrderId,
            amount: pi.purchaseOrder.totalBDT
          });
        }

        for (const grn of pi.grns || []) {
          docs.push({
            type: 'GRN',
            number: grn.grnNumber,
            date: grn.receivedDate,
            status: grn.status,
            id: grn.id,
            amount: grn.total
          });
        }

        docs.push({
          type: 'PURCHASE_INVOICE',
          number: pi.piNumber,
          date: pi.piDate,
          status: pi.status,
          id: pi.id,
          amount: pi.totalBDT
        });

        for (const payment of pi.payments || []) {
          docs.push({
            type: 'PAYMENT',
            number: `PAY-${payment.id.slice(0, 8)}`,
            date: payment.paymentDate,
            status: 'PAID',
            id: payment.id,
            amount: payment.amount
          });
        }
      }

      return reply.send({ success: true, data: docs });
    } catch (error) {
      console.error('Error fetching document flow:', error);
      return reply.status(500).send({ error: 'Failed to fetch document flow' });
    }
  }
}