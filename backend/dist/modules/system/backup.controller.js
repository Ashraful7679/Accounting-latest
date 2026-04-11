"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupController = void 0;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const util_1 = require("util");
const database_1 = __importDefault(require("../../config/database"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class BackupController {
    async createBackup(request, reply) {
        const userId = request.user?.id;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path_1.default.join(process.cwd(), 'backups');
        const uploadsDir = path_1.default.join(process.cwd(), 'uploads');
        if (!fs_1.default.existsSync(backupDir))
            fs_1.default.mkdirSync(backupDir, { recursive: true });
        const dbBackupFile = path_1.default.join(backupDir, `db-${timestamp}.sql`);
        const finalZipFile = path_1.default.join(backupDir, `backup-unified-${timestamp}.zip`);
        try {
            // 1. Export Database
            const dbUrl = process.env.DATABASE_URL;
            if (!dbUrl)
                throw new Error('DATABASE_URL not set');
            // Basic pg_dump command (expects pg_dump in PATH)
            console.log(`Starting DB backup to ${dbBackupFile}...`);
            await execAsync(`pg_dump "${dbUrl}" --no-password > "${dbBackupFile}"`);
            // 2. Zip Database + Uploads
            const password = process.env.BACKUP_PASSWORD ? `-p"${process.env.BACKUP_PASSWORD}"` : '';
            console.log(`Creating unified archive at ${finalZipFile}...`);
            if (process.platform === 'win32') {
                const srcList = `"${dbBackupFile}" "${uploadsDir}"`;
                await execAsync(`7z a -tzip -mx=9 ${password} "${finalZipFile}" ${srcList}`);
            }
            else {
                await execAsync(`zip -r "${finalZipFile}" "${dbBackupFile}" "${uploadsDir}"`);
            }
            // 3. Clean up the SQL dump (it's inside the zip now)
            if (fs_1.default.existsSync(dbBackupFile)) {
                fs_1.default.unlinkSync(dbBackupFile);
            }
            await this.cleanupOldBackups(backupDir);
            // 4. Log the backup
            const stats = fs_1.default.statSync(finalZipFile);
            await database_1.default.backupLog.create({
                data: {
                    fileName: path_1.default.basename(finalZipFile),
                    fileSize: stats.size,
                    status: 'SUCCESS',
                    triggeredBy: userId || 'SYSTEM'
                }
            });
            return reply.send({
                success: true,
                message: 'Unified backup (Database + Media) completed successfully.',
                fileName: path_1.default.basename(finalZipFile),
                size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB'
            });
        }
        catch (error) {
            console.error('Backup Error:', error);
            // Log failure
            await database_1.default.backupLog.create({
                data: {
                    fileName: `failed-${timestamp}`,
                    fileSize: 0,
                    status: 'FAILED',
                    triggeredBy: userId || 'SYSTEM'
                }
            }).catch(console.error);
            return reply.status(500).send({
                success: false,
                message: 'Integrated backup failed. Ensure pg_dump is in your system PATH.',
                error: error.message
            });
        }
    }
    async cleanupOldBackups(backupDir) {
        try {
            if (!fs_1.default.existsSync(backupDir))
                return;
            const files = fs_1.default.readdirSync(backupDir)
                .filter(f => f.startsWith('backup-unified-') && f.endsWith('.zip'))
                .map(f => ({
                name: f,
                path: path_1.default.join(backupDir, f),
                time: fs_1.default.statSync(path_1.default.join(backupDir, f)).mtime.getTime()
            }))
                .sort((a, b) => b.time - a.time);
            const keepCount = 10;
            if (files.length > keepCount) {
                const toDelete = files.slice(keepCount);
                for (const file of toDelete) {
                    fs_1.default.unlinkSync(file.path);
                }
            }
        }
        catch (err) {
            console.error('System backup cleanup failed:', err);
        }
    }
    async listBackups(request, reply) {
        const logs = await database_1.default.backupLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10
        });
        return reply.send({ success: true, data: logs });
    }
    async downloadBackup(request, reply) {
        const { fileName } = request.params;
        const backupPath = path_1.default.join(process.cwd(), 'backups', fileName);
        if (!fs_1.default.existsSync(backupPath)) {
            return reply.status(404).send({ success: false, message: 'Backup file not found' });
        }
        const stream = fs_1.default.createReadStream(backupPath);
        return reply.type('application/zip').send(stream);
    }
}
exports.BackupController = BackupController;
//# sourceMappingURL=backup.controller.js.map