"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductPriceRepository = void 0;
const database_1 = __importDefault(require("../config/database"));
const systemMode_1 = require("../lib/systemMode");
class ProductPriceRepository {
    static async findMany(where) {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            try {
                return await database_1.default.productEntityPrice.findMany({
                    where,
                    include: {
                        product: true,
                        customer: true,
                        vendor: true
                    }
                });
            }
            catch (error) {
                console.error('Product price search failed');
            }
        }
        return [];
    }
    static async upsert(productId, entityId, type, price, currency) {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            const where = type === 'customer'
                ? { productId_customerId: { productId, customerId: entityId } }
                : { productId_vendorId: { productId, vendorId: entityId } };
            const createData = {
                productId,
                price,
                currency
            };
            if (type === 'customer')
                createData.customerId = entityId;
            else
                createData.vendorId = entityId;
            try {
                return await database_1.default.productEntityPrice.upsert({
                    where,
                    update: { price, currency },
                    create: createData
                });
            }
            catch (error) {
                console.error('Product price upsert failed');
                throw error;
            }
        }
        return { productId, price, currency, [type === 'customer' ? 'customerId' : 'vendorId']: entityId };
    }
    static async delete(id) {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            try {
                return await database_1.default.productEntityPrice.delete({
                    where: { id }
                });
            }
            catch (error) {
                console.error('Product price deletion failed');
                throw error;
            }
        }
        return { id };
    }
    static async findByEntity(entityId, type) {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            try {
                const where = type === 'customer' ? { customerId: entityId } : { vendorId: entityId };
                return await database_1.default.productEntityPrice.findMany({
                    where,
                    include: {
                        product: true
                    }
                });
            }
            catch (error) {
                console.error('Failed to fetch entity products');
                throw error;
            }
        }
        return [];
    }
}
exports.ProductPriceRepository = ProductPriceRepository;
//# sourceMappingURL=ProductPriceRepository.js.map