import { FastifyRequest, FastifyReply } from 'fastify';
export declare class BackupController {
    private BACKUP_DIR;
    constructor();
    private getDbConfig;
    private createModuleBackup;
    private createZipWithUploads;
    private cleanupOldBackups;
    generateBackup(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    getBackups(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    downloadBackup(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    restoreBackup(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    uploadAndRestore(request: FastifyRequest, reply: FastifyReply): Promise<never>;
}
//# sourceMappingURL=backup.controller.d.ts.map