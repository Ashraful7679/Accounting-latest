import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../config/database';

export class ProductPricingController {
  static async calculateAverageCost(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const { productIds } = request.query as { productIds?: string };

    let ids: string[] = [];
    
    if (productIds) {
      ids = productIds.split(',');
    } else {
      // If no IDs provided, fetch all products for the company
      const products = await prisma.product.findMany({
        where: { companyId },
        select: { id: true }
      });
      ids = products.map(p => p.id);
    }

    if (ids.length === 0) {
      return reply.send({ success: true, data: [] });
    }

    const results = [];

    for (const productId of ids) {
      const grnLines = await prisma.gRNLine.findMany({
        where: {
          productId,
          grn: { companyId, status: 'APPROVED' }
        },
        include: { grn: true },
        orderBy: { grn: { receivedDate: 'desc' } },
        take: 50
      });

      const piLines = await prisma.pILine.findMany({
        where: {
          productId,
          pi: { companyId, status: 'APPROVED' }
        },
        include: { pi: true },
        orderBy: { pi: { piDate: 'desc' } },
        take: 50
      });

      const allLines = [
        ...grnLines.map(l => ({ ...l, date: l.grn.receivedDate })),
        ...piLines.map(l => ({ ...l, date: l.pi.piDate }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      if (allLines.length === 0) {
        results.push({ productId, averageCost: 0, totalQuantity: 0, purchaseCount: 0 });
        continue;
      }

      const totalValue = allLines.reduce((sum, l) => sum + (Number(l.unitPrice || 0) * Number(l.quantity || 0)), 0);
      const totalQuantity = allLines.reduce((sum, l) => sum + Number(l.quantity || 0), 0);
      const averageCost = totalQuantity > 0 ? totalValue / totalQuantity : 0;

      results.push({
        productId,
        averageCost: Math.round(averageCost * 100) / 100,
        totalQuantity,
        purchaseCount: allLines.length,
        lastPurchasePrice: allLines[0]?.unitPrice || 0,
        lastPurchaseDate: allLines[0]?.date
      });
    }

    return reply.send({ success: true, data: results });
  }

  static async getProductCost(request: FastifyRequest, reply: FastifyReply) {
    const { productId } = request.params as { productId: string };

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, code: true, unitPrice: true }
    });

    if (!product) {
      return reply.status(404).send({ error: 'Product not found' });
    }

    const grnLines = await prisma.gRNLine.findMany({
      where: { productId, grn: { status: 'APPROVED' } },
      include: { grn: { select: { receivedDate: true } } },
      orderBy: { grn: { receivedDate: 'desc' } },
      take: 10
    });

    const recentCosts = grnLines.map(l => ({
      date: l.grn.receivedDate,
      cost: l.unitPrice || 0,
      quantity: l.quantity
    }));

    // Calculate average cost from recent GRN lines
    const totalValue = grnLines.reduce((s, l) => s + (Number(l.unitPrice || 0) * Number(l.quantity || 0)), 0);
    const totalQty = grnLines.reduce((s, l) => s + Number(l.quantity || 0), 0);
    const averageCost = totalQty > 0 ? totalValue / totalQty : 0;

    const sellingPrice = product.unitPrice || 0;
    const margin = sellingPrice > 0 ? ((sellingPrice - averageCost) / sellingPrice) * 100 : 0;
    const markup = averageCost > 0 ? ((sellingPrice - averageCost) / averageCost) * 100 : 0;

    return reply.send({
      success: true,
      data: {
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        averageCost: Math.round(averageCost * 100) / 100,
        sellingPrice: product.unitPrice,
        margin: Math.round(margin * 100) / 100,
        markup: Math.round(markup * 100) / 100,
        recentCosts
      }
    });
  }

  static async updateMinimumMargin(request: FastifyRequest, reply: FastifyReply) {
    // minimumMargin field not in schema yet — return success stub
    const { productId } = request.params as { productId: string };
    return reply.send({ success: true, message: 'minimumMargin not yet tracked in schema', productId });
  }
}