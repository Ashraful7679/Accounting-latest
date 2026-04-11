import { FastifyRequest, FastifyReply } from 'fastify';
import { ProductRepository } from '../../repositories/ProductRepository';
import { NotificationController } from './notification.controller';
import { SequenceService } from './sequence.service';
import { ValidationError, NotFoundError } from '../../middleware/errorHandler';

export class ProductController {
  async getProducts(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const products = await ProductRepository.findMany({ companyId });
    return reply.send({ success: true, data: products });
  }

  async getProduct(request: FastifyRequest, reply: FastifyReply) {
    const { productId } = request.params as { productId: string };
    const product = await ProductRepository.findById(productId);
    if (!product) throw new NotFoundError('Product not found');
    return reply.send({ success: true, data: product });
  }

  async createProduct(request: FastifyRequest, reply: FastifyReply) {
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;
    const { name, sku, description, unitType, unitPrice, currency, stockAmount, type, isActive } = request.body as any;

    if (!name) throw new ValidationError('Product name is required');

    const code = await SequenceService.generateDocumentNumber(companyId, 'product');

    const product = await ProductRepository.create({
      code,
      name,
      companyId,
      sku: sku || code,
      description,
      unitType: unitType || 'PCS',
      unitPrice: Number(unitPrice || 0),
      currency: currency || 'BDT',
      stockAmount: Number(stockAmount || 0),
      type: type || 'GOODS',
      isActive: isActive !== undefined ? isActive : true,
    });

    await NotificationController.logActivity({
      companyId,
      entityType: 'product',
      entityId: product.id,
      action: 'CREATED',
      performedById: userId,
      metadata: { docNumber: code, name },
    });

    return reply.status(201).send({ success: true, data: product });
  }

  async updateProduct(request: FastifyRequest, reply: FastifyReply) {
    const { productId } = request.params as { productId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;
    const data = request.body as any;

    const existing = await ProductRepository.findById(productId);
    if (!existing) throw new NotFoundError('Product not found');

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.sku !== undefined) updateData.sku = data.sku;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.unitType !== undefined) updateData.unitType = data.unitType;
    if (data.unitPrice !== undefined) updateData.unitPrice = Number(data.unitPrice);
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.stockAmount !== undefined) updateData.stockAmount = Number(data.stockAmount);
    if (data.type !== undefined) updateData.type = data.type;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const product = await ProductRepository.update(productId, updateData);

    await NotificationController.logActivity({
      companyId,
      entityType: 'product',
      entityId: product.id,
      action: 'UPDATED',
      performedById: userId,
      metadata: { docNumber: product.code, name: product.name },
    });

    return reply.send({ success: true, data: product });
  }


  async deleteProduct(request: FastifyRequest, reply: FastifyReply) {
    const { productId } = request.params as { productId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;

    const product = await ProductRepository.findById(productId);
    if (!product) throw new NotFoundError('Product not found');

    await ProductRepository.delete(productId);

    await NotificationController.logActivity({
      companyId,
      entityType: 'product',
      entityId: productId,
      action: 'DELETED',
      performedById: userId,
      metadata: { name: product.name },
    });

    return reply.send({ success: true, message: 'Product deleted' });
  }

  async adjustStock(request: FastifyRequest, reply: FastifyReply) {
    const { productId } = request.params as { productId: string };
    const { id: companyId } = request.params as { id: string };
    const userId = (request.user as any).id;
    const { stockAmount, notes } = request.body as any;

    if (stockAmount === undefined) throw new ValidationError('Stock amount is required');

    const product = await ProductRepository.adjustStock(productId, Number(stockAmount), userId, notes);

    await NotificationController.logActivity({
      companyId,
      entityType: 'product',
      entityId: product.id,
      action: 'STOCK_ADJUSTED',
      performedById: userId,
      metadata: { docNumber: product.code, name: product.name, newAmount: product.stockAmount },
    });

    return reply.send({ success: true, data: product });
  }
}
