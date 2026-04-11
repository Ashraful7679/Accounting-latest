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
        const userId = request.user.id;
        const { name, sku, description, unitType, unitPrice, currency, stockAmount, type, isActive } = request.body;
        if (!name)
            throw new errorHandler_1.ValidationError('Product name is required');
        const code = await sequence_service_1.SequenceService.generateDocumentNumber(companyId, 'product');
        const product = await ProductRepository_1.ProductRepository.create({
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
        await notification_controller_1.NotificationController.logActivity({
            companyId,
            entityType: 'product',
            entityId: product.id,
            action: 'CREATED',
            performedById: userId,
            metadata: { docNumber: code, name },
        });
        return reply.status(201).send({ success: true, data: product });
    }
    async updateProduct(request, reply) {
        const { productId } = request.params;
        const { id: companyId } = request.params;
        const userId = request.user.id;
        const data = request.body;
        const existing = await ProductRepository_1.ProductRepository.findById(productId);
        if (!existing)
            throw new errorHandler_1.NotFoundError('Product not found');
        const updateData = {};
        if (data.name !== undefined)
            updateData.name = data.name;
        if (data.sku !== undefined)
            updateData.sku = data.sku;
        if (data.description !== undefined)
            updateData.description = data.description;
        if (data.unitType !== undefined)
            updateData.unitType = data.unitType;
        if (data.unitPrice !== undefined)
            updateData.unitPrice = Number(data.unitPrice);
        if (data.currency !== undefined)
            updateData.currency = data.currency;
        if (data.stockAmount !== undefined)
            updateData.stockAmount = Number(data.stockAmount);
        if (data.type !== undefined)
            updateData.type = data.type;
        if (data.isActive !== undefined)
            updateData.isActive = data.isActive;
        const product = await ProductRepository_1.ProductRepository.update(productId, updateData);
        await notification_controller_1.NotificationController.logActivity({
            companyId,
            entityType: 'product',
            entityId: product.id,
            action: 'UPDATED',
            performedById: userId,
            metadata: { docNumber: product.code, name: product.name },
        });
        return reply.send({ success: true, data: product });
    }
    async deleteProduct(request, reply) {
        const { productId } = request.params;
        const { id: companyId } = request.params;
        const userId = request.user.id;
        const product = await ProductRepository_1.ProductRepository.findById(productId);
        if (!product)
            throw new errorHandler_1.NotFoundError('Product not found');
        await ProductRepository_1.ProductRepository.delete(productId);
        await notification_controller_1.NotificationController.logActivity({
            companyId,
            entityType: 'product',
            entityId: productId,
            action: 'DELETED',
            performedById: userId,
            metadata: { name: product.name },
        });
        return reply.send({ success: true, message: 'Product deleted' });
    }
}
exports.ProductController = ProductController;
//# sourceMappingURL=product.controller.js.map