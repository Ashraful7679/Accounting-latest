"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseOrderRepository = void 0;
const database_1 = __importDefault(require("../config/database"));
const systemMode_1 = require("../lib/systemMode");
class PurchaseOrderRepository {
    static async findMany(where = {}) {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            try {
                return await database_1.default.purchaseOrder.findMany({
                    where,
                    include: {
                        supplier: true,
                        lc: true,
                        lines: true
                    },
                    orderBy: { createdAt: 'desc' }
                });
            }
            catch (e) {
                console.error('Error fetching purchase orders:', e);
                return [];
            }
        }
        return []; // Return empty for mock for now
    }
    static async findById(id) {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            try {
                return await database_1.default.purchaseOrder.findUnique({
                    where: { id },
                    include: {
                        supplier: true,
                        lc: true,
                        lines: true
                    }
                });
            }
            catch (e) {
                console.error('Error fetching purchase order:', e);
                return null;
            }
        }
        return null;
    }
    static async create(data) {
        const { lines, ...poData } = data;
        // Ensure empty relation IDs are treated as null
        if (poData.lcId === "") {
            poData.lcId = null;
        }
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            return await database_1.default.purchaseOrder.create({
                data: {
                    ...poData,
                    lines: {
                        create: lines
                    }
                },
                include: {
                    lines: true,
                    supplier: true,
                    lc: true
                }
            });
        }
        return { ...data, id: `offline-${Date.now()}` };
    }
    static async update(id, data) {
        const { lines, ...poData } = data;
        // Ensure empty relation IDs are treated as null
        if (poData.lcId === "") {
            poData.lcId = null;
        }
        // Ensure empty date fields are treated as null (Prisma requires DateTime or null)
        if (poData.expectedDeliveryDate === "" || poData.expectedDeliveryDate === undefined) {
            poData.expectedDeliveryDate = null;
        }
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            // For updates, we might want to replace lines or update them individually.
            // Simplest: Delete and recreate lines if provided
            if (lines) {
                await database_1.default.purchaseOrderLine.deleteMany({
                    where: { purchaseOrderId: id }
                });
                return await database_1.default.purchaseOrder.update({
                    where: { id },
                    data: {
                        ...poData,
                        lines: {
                            create: lines
                        }
                    },
                    include: {
                        lines: true,
                        supplier: true,
                        lc: true
                    }
                });
            }
            return await database_1.default.purchaseOrder.update({
                where: { id },
                data: poData,
                include: {
                    lines: true,
                    supplier: true,
                    lc: true
                }
            });
        }
        return { ...data, id };
    }
    static async delete(id) {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            return await database_1.default.purchaseOrder.delete({
                where: { id }
            });
        }
        return { id };
    }
}
exports.PurchaseOrderRepository = PurchaseOrderRepository;
//# sourceMappingURL=PurchaseOrderRepository.js.map