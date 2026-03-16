import { FastifyRequest, FastifyReply } from 'fastify';
export declare class AttachmentController {
    private readonly UPLOAD_DIR;
    constructor();
    upload(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    getSecureFile(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    listByEntity(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    deleteAttachment(request: FastifyRequest, reply: FastifyReply): Promise<never>;
}
//# sourceMappingURL=attachment.controller.d.ts.map