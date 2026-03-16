"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupController = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const execPromise = (0, util_1.promisify)(child_process_1.exec);
class BackupController {
    async createBackup(request, reply) {
        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl) {
            return reply.status(500).send({ success: false, message: 'DATABASE_URL not configured' });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `backup-${timestamp}.sql`;
        const filePath = path_1.default.join(process.cwd(), 'backups', fileName);
        // Ensure backups directory exists
        if (!fs_1.default.existsSync(path_1.default.join(process.cwd(), 'backups'))) {
            fs_1.default.mkdirSync(path_1.default.join(process.cwd(), 'backups'));
        }
        try {
            // Execute pg_dump
            await execPromise(`pg_dump "${databaseUrl}" -f "${filePath}"`);
            const stats = fs_1.default.statSync(filePath);
            return reply.send({
                success: true,
                data: {
                    fileName,
                    size: stats.size,
                    timestamp: new Date().toISOString(),
                    downloadUrl: `/api/admin/backups/${fileName}`
                }
            });
        }
        catch (error) {
            console.error('Backup Error:', error);
            return reply.status(500).send({ success: false, message: 'Failed to create backup', error: error.message });
        }
    }
    async listBackups(request, reply) {
        const backupDir = path_1.default.join(process.cwd(), 'backups');
        if (!fs_1.default.existsSync(backupDir))
            return reply.send({ success: true, data: [] });
        const files = fs_1.default.readdirSync(backupDir)
            .filter(f => f.endsWith('.sql'))
            .map(f => {
            const stats = fs_1.default.statSync(path_1.default.join(backupDir, f));
            return {
                fileName: f,
                size: stats.size,
                createdAt: stats.birthtime
            };
        })
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return reply.send({ success: true, data: files });
    }
    async restoreBackup(request, reply) {
        const { fileName } = request.body;
        const databaseUrl = process.env.DATABASE_URL;
        const filePath = path_1.default.join(process.cwd(), 'backups', fileName);
        if (!fs_1.default.existsSync(filePath)) {
            return reply.status(404).send({ success: false, message: 'Backup file not found' });
        }
        try {
            // CRITICAL: Auto-backup before restore
            const preRestoreBackup = `pre-restore-${new Date().getTime()}.sql`;
            await execPromise(`pg_dump "${databaseUrl}" -f "${path_1.default.join(process.cwd(), 'backups', preRestoreBackup)}"`);
            // Execute psql restore
            // Note: This usually requires --clean to drop existing objects
            await execPromise(`psql "${databaseUrl}" -f "${filePath}"`);
            return reply.send({ success: true, message: 'Database restored successfully' });
        }
        catch (error) {
            console.error('Restore Error:', error);
            return reply.status(500).send({ success: false, message: 'Restoration failed', error: error.message });
        }
    }
}
exports.BackupController = BackupController;
//# sourceMappingURL=backup.controller.js.map