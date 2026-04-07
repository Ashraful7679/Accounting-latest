"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttachmentController = void 0;
const database_1 = __importDefault(require("../../config/database"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const promises_1 = require("stream/promises");
const errorHandler_1 = require("../../middleware/errorHandler");
class AttachmentController {
    constructor() {
        this.UPLOAD_DIR = path_1.default.join(process.cwd(), 'uploads');
        if (!fs_1.default.existsSync(this.UPLOAD_DIR)) {
            fs_1.default.mkdirSync(this.UPLOAD_DIR, { recursive: true });
        }
    }
    async upload(request, reply) {
        const { id: companyId } = request.params;
        const parts = request.parts();
        let uploadedAttachment = null;
        for await (const part of parts) {
            if (part.type === 'file') {
                const query = request.query;
                const entityType = query.entityType;
                const entityId = query.entityId;
                const documentType = query.documentType;
                if (!entityType || !entityId) {
                    throw new errorHandler_1.ValidationError('entityType and entityId are required in query params');
                }
                const relativeDir = path_1.default.join('transactions', entityType.toLowerCase(), entityId);
                const folderPath = path_1.default.join(this.UPLOAD_DIR, relativeDir);
                if (!fs_1.default.existsSync(folderPath)) {
                    fs_1.default.mkdirSync(folderPath, { recursive: true });
                }
                const fileName = `${Date.now()}-${part.filename}`;
                const filePath = path_1.default.join(folderPath, fileName);
                const relativeFilePath = path_1.default.join(relativeDir, fileName);
                // Use stream to calculate hash and save file
                const hash = crypto_1.default.createHash('sha256');
                const writeStream = fs_1.default.createWriteStream(filePath);
                let fileSize = 0;
                // Pipeline handles the streaming properly
                await (0, promises_1.pipeline)(part.file, async function* (source) {
                    for await (const chunk of source) {
                        fileSize += chunk.length;
                        hash.update(chunk);
                        yield chunk;
                    }
                }, writeStream);
                const hashValue = hash.digest('hex');
                // Create DB record using the new Attachment model
                uploadedAttachment = await database_1.default.attachment.create({
                    data: {
                        name: part.filename,
                        fileName: fileName,
                        fileType: part.mimetype,
                        filePath: relativeFilePath,
                        fileSize: fileSize,
                        entityType: entityType.toUpperCase(),
                        entityId: entityId,
                        documentType: documentType || 'GENERAL',
                        hashValue: hashValue,
                        uploadedById: request.user.id,
                    }
                });
            }
        }
        if (!uploadedAttachment) {
            throw new errorHandler_1.ValidationError('No file was uploaded');
        }
        return reply.send({ success: true, data: uploadedAttachment });
    }
    async getSecureFile(request, reply) {
        const { id: attachmentId } = request.params;
        const attachment = await database_1.default.attachment.findUnique({
            where: { id: attachmentId, isActive: true }
        });
        if (!attachment) {
            throw new errorHandler_1.NotFoundError('Attachment not found');
        }
        // Permission Verification
        // Secure serving logic: verify if the user has access to the company context
        // This part will be expanded once we have a more granular permission service.
        const filePath = path_1.default.join(this.UPLOAD_DIR, attachment.filePath.replace(/\\/g, path_1.default.sep).replace(/\//g, path_1.default.sep));
        if (!fs_1.default.existsSync(filePath)) {
            throw new errorHandler_1.NotFoundError(`Physical file not found on disk: ${attachment.filePath}`);
        }
        // Stream the file for performance and security
        const stream = fs_1.default.createReadStream(filePath);
        reply.header('Content-Type', attachment.fileType);
        reply.header('Content-Disposition', `inline; filename="${attachment.name}"`);
        return reply.send(stream);
    }
    async listByEntity(request, reply) {
        const { type: entityType, id: entityId } = request.params;
        const attachments = await database_1.default.attachment.findMany({
            where: {
                entityType: entityType.toUpperCase(),
                entityId: entityId,
                isActive: true
            },
            orderBy: { createdAt: 'desc' }
        });
        return reply.send({ success: true, data: attachments });
    }
    async deleteAttachment(request, reply) {
        const { id: attachmentId } = request.params;
        // Soft delete as per RMG audit requirements
        await database_1.default.attachment.update({
            where: { id: attachmentId },
            data: { isActive: false }
        });
        return reply.send({ success: true, message: 'Attachment removed successfully' });
    }
}
exports.AttachmentController = AttachmentController;
//# sourceMappingURL=attachment.controller.js.map