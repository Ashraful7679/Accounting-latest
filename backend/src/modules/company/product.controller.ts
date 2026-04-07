import { FastifyRequest, FastifyReply } from 'fastify';
import { ProductRepository } from '../../repositories/ProductRepository';
import { ProductPriceRepository } from '../../repositories/ProductPriceRepository';
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
    const { name, sku, description, unitPrice, isActive } = request.body as any;

    const code = await SequenceService.generateDocumentNumber(companyId, 'product');
    
    const product = await ProductRepository.create({
      code,
      name,
      companyId,
      sku: sku || code,
      description,
      unitPrice: Number(unitPrice || 0),
      isActive: isActive !== undefined ? isActive : true
    });

    // Log Activity
    await NotificationController.logActivity({
      companyId,
      entityType: 'product',
      entityId: product.id,
      action: 'CREATED',
      performedById: (request.user as any).id,
      metadata: { docNumber: code, name }
    });

    return reply.status(201).send({ success: true, data: product });
  }

  async updateProduct(request: FastifyRequest, reply: FastifyReply) {
    const { productId } = request.params as { productId: string };
    const { id: companyId } = request.params as { id: string };
    const data = request.body as any;

    const existing = await ProductRepository.findById(productId);
    if (!existing) throw new NotFoundError('Product not found');

    const product = await ProductRepository.update(productId, {
      ...data,
      unitPrice: data.unitPrice !== undefined ? Number(data.unitPrice) : undefined
    });

    // Log Activity
    await NotificationController.logActivity({
      companyId,
      entityType: 'product',
      entityId: product.id,
      action: 'UPDATED',
      performedById: (request.user as any).id,
      metadata: { docNumber: product.code, name: product.name }
    });

    return reply.send({ success: true, data: product });
  }

  async deleteProduct(request: FastifyRequest, reply: FastifyReply) {
    const { productId } = request.params as { productId: string };
    const { id: companyId } = request.params as { id: string };

    const product = await ProductRepository.findById(productId);
    if (!product) throw new NotFoundError('Product not found');

    await ProductRepository.delete(productId);

    // Log Activity
    await NotificationController.logActivity({
      companyId,
      entityType: 'product',
      entityId: productId,
      action: 'DELETED',
      performedById: (request.user as any).id,
      metadata: { name: product.name }
    });

    return reply.send({ success: true, message: 'Product deleted' });
  }

  async assignEntityPrice(request: FastifyRequest, reply: FastifyReply) {
    const { productId, entityId, type, price, currency } = request.body as any;
    const { id: companyId } = request.params as { id: string };

    if (!productId || !entityId || !type || price === undefined) {
      throw new ValidationError('productId, entityId, type and price are required');
    }

    const assignment = await ProductPriceRepository.upsert(productId, entityId, type, Number(price), currency || 'BDT');

    // Log Activity
    await NotificationController.logActivity({
      companyId,
      entityType: 'product_price',
      entityId: assignment.id,
      action: 'ASSIGNED',
      performedById: (request.user as any).id,
      metadata: { productId, entityId, type, price }
    });

    return reply.send({ success: true, data: assignment });
  }

  async getEntityProducts(request: FastifyRequest, reply: FastifyReply) {
    const { entityId, type } = request.query as { entityId: string, type: 'customer' | 'vendor' };
    
    if (!entityId || !type) {
      throw new ValidationError('entityId and type query parameters are required');
    }

    const products = await ProductPriceRepository.findByEntity(entityId, type);
    return reply.send({ success: true, data: products });
  }

  async removeEntityPrice(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { companyId } = request.params as { companyId: string };

    await ProductPriceRepository.delete(id);

    return reply.send({ success: true, message: 'Price assignment removed' });
  }
}
