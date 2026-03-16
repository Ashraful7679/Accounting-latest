"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttachmentRepository = void 0;
const database_1 = __importDefault(require("../config/database"));
const systemMode_1 = require("../lib/systemMode");
class AttachmentRepository {
    static async createAttachment(data) {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            return await database_1.default.attachment.create({
                data
            });
        }
        // For offline mode, we just return the data with a mock ID
        return {
            id: `offline-att-${Date.now()}`,
            ...data,
            createdAt: new Date().toISOString()
        };
    }
    static async findByEntity(entityType, entityId) {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            return await database_1.default.attachment.findMany({
                where: {
                    entityType,
                    entityId,
                    isActive: true
                },
                orderBy: { createdAt: 'desc' }
            });
        }
        return [];
    }
    static async deleteAttachment(id) {
        if (systemMode_1.SYSTEM_MODE === "LIVE") {
            return await database_1.default.attachment.update({
                where: { id },
                data: { isActive: false }
            });
        }
        return { id, isActive: false };
    }
}
exports.AttachmentRepository = AttachmentRepository;
//# sourceMappingURL=AttachmentRepository.js.map