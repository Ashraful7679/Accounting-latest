export declare class AttachmentRepository {
    static createAttachment(data: any): Promise<any>;
    static findByEntity(entityType: string, entityId: string): Promise<{
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        version: number;
        fileName: string;
        verifiedById: string | null;
        entityType: string;
        entityId: string;
        fileSize: number;
        fileType: string;
        filePath: string;
        documentType: string | null;
        hashValue: string | null;
        isVerified: boolean;
        uploadedById: string;
    }[]>;
    static deleteAttachment(id: string): Promise<{
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        version: number;
        fileName: string;
        verifiedById: string | null;
        entityType: string;
        entityId: string;
        fileSize: number;
        fileType: string;
        filePath: string;
        documentType: string | null;
        hashValue: string | null;
        isVerified: boolean;
        uploadedById: string;
    } | {
        id: string;
        isActive: boolean;
    }>;
}
//# sourceMappingURL=AttachmentRepository.d.ts.map