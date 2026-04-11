"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductRepository = void 0;
const database_1 = __importDefault(require("../config/database"));
class ProductRepository {
    static async findMany(where = {}) {
        return database_1.default.product.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
    }
    static async findById(id) {
        return database_1.default.product.findUnique({
            where: { id },
        });
    }
    static async create(data) {
        return database_1.default.product.create({ data });
    }
    static async update(id, data) {
        return database_1.default.product.update({ where: { id }, data });
    }
    static async delete(id) {
        return database_1.default.product.delete({ where: { id } });
    }
}
exports.ProductRepository = ProductRepository;
//# sourceMappingURL=ProductRepository.js.map