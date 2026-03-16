"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductRepository = exports.demoProducts = void 0;
const database_1 = __importDefault(require("../config/database"));
const systemMode_1 = require("../lib/systemMode");
exports.demoProducts = [
    { id: "prod-1", code: "PRD-2026-0001", name: "Steel Pipes", sku: "SP-001", description: "High quality export grade steel pipes", unitPrice: 150, isActive: true },
    { id: "prod-2", code: "PRD-2026-0002", name: "Aluminum Sheets", sku: "AL-002", description: "Industrial grade aluminum sheets", unitPrice: 85, isActive: true },
];
class ProductRepository {
    static async findMany(where = {}) {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            try {
                return await database_1.default.product.findMany({
                    where,
                    orderBy: { createdAt: 'desc' }
                });
            }
            catch (error) {
                console.error('Product search failed, falling back to mock');
            }
        }
        return exports.demoProducts;
    }
    static async findById(id) {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            try {
                return await database_1.default.product.findUnique({
                    where: { id }
                });
            }
            catch (error) {
                console.error('Product retrieval failed');
            }
        }
        return exports.demoProducts.find(p => p.id === id);
    }
    static async create(data) {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            try {
                return await database_1.default.product.create({ data });
            }
            catch (error) {
                console.error('Product creation failed');
                throw error;
            }
        }
        return { ...data, id: `offline-${Date.now()}` };
    }
    static async update(id, data) {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            try {
                return await database_1.default.product.update({
                    where: { id },
                    data
                });
            }
            catch (error) {
                console.error('Product update failed');
                throw error;
            }
        }
        return { ...data, id };
    }
    static async delete(id) {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            try {
                return await database_1.default.product.delete({
                    where: { id }
                });
            }
            catch (error) {
                console.error('Product deletion failed');
                throw error;
            }
        }
        return { id };
    }
}
exports.ProductRepository = ProductRepository;
//# sourceMappingURL=ProductRepository.js.map