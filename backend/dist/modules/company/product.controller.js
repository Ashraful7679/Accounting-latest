"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductController = void 0;
const ProductRepository_1 = require("../../repositories/ProductRepository");
const notification_controller_1 = require("./notification.controller");
const sequence_service_1 = require("./sequence.service");
const errorHandler_1 = require("../../middleware/errorHandler");
class ProductController {
    async getProducts(request, reply) {
        const { id: companyId } = request.params;
        const products = await ProductRepository_1.ProductRepository.findMany({ companyId });
        return reply.send({ success: true, data: products });
    }
    async getProduct(request, reply) {
        const { productId } = request.params;
        const product = await ProductRepository_1.ProductRepository.findById(productId);
        if (!product)
            throw new errorHandler_1.NotFoundError('Product not found');
        return reply.send({ success: true, data: product });
    }
    async createProduct(request, reply) {
        const { id: companyId } = request.params;
        const { name, sku, description, unitPrice, isActive } = request.body;
        const code = await sequence_service_1.SequenceService.generateDocumentNumber(companyId, 'product');
        const product = await ProductRepository_1.ProductRepository.create({
            code,
            name,
            companyId,
            sku: sku || code,
            description,
            unitPrice: Number(unitPrice || 0),
            isActive: isActive !== undefined ? isActive : true
        });
        // Log Activity
        await notification_controller_1.NotificationController.logActivity({
            companyId,
            entityType: 'product',
            entityId: product.id,
            action: 'CREATED',
            performedById: request.user.id,
            metadata: { docNumber: code, name }
        });
        return reply.status(201).send({ success: true, data: product });
    }
    async updateProduct(request, reply) {
        const { productId } = request.params;
        const { id: companyId } = request.params;
        const data = request.body;
        const existing = await ProductRepository_1.ProductRepository.findById(productId);
        if (!existing)
            throw new errorHandler_1.NotFoundError('Product not found');
        const product = await ProductRepository_1.ProductRepository.update(productId, {
            ...data,
            unitPrice: data.unitPrice !== undefined ? Number(data.unitPrice) : undefined
        });
        // Log Activity
        await notification_controller_1.NotificationController.logActivity({
            companyId,
            entityType: 'product',
            entityId: product.id,
            action: 'UPDATED',
            performedById: request.user.id,
            metadata: { docNumber: product.code, name: product.name }
        });
        return reply.send({ success: true, data: product });
    }
    async deleteProduct(request, reply) {
        const { productId } = request.params;
        const { id: companyId } = request.params;
        const product = await ProductRepository_1.ProductRepository.findById(productId);
        if (!product)
            throw new errorHandler_1.NotFoundError('Product not found');
        await ProductRepository_1.ProductRepository.delete(productId);
        // Log Activity
        await notification_controller_1.NotificationController.logActivity({
            companyId,
            entityType: 'product',
            entityId: productId,
            action: 'DELETED',
            performedById: request.user.id,
            metadata: { name: product.name }
        });
        return reply.send({ success: true, message: 'Product deleted' });
    }
}
exports.ProductController = ProductController;
//# sourceMappingURL=product.controller.js.map