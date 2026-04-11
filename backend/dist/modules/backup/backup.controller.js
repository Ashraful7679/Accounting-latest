"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupController = void 0;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const util_1 = __importDefault(require("util"));
const database_1 = __importDefault(require("../../config/database"));
const errorHandler_1 = require("../../middleware/errorHandler");
const execPromise = util_1.default.promisify(child_process_1.exec);
class BackupController {
    constructor() {
        this.BACKUP_DIR = process.env.BACKUP_DIR || (process.platform === 'win32'
            ? path_1.default.join(process.cwd(), 'backups')
            : '/tmp/accabiz_backups');
        try {
            if (!fs_1.default.existsSync(this.BACKUP_DIR)) {
                console.log(`Creating backup directory at: ${this.BACKUP_DIR}`);
                fs_1.default.mkdirSync(this.BACKUP_DIR, { recursive: true });
            }
        }
        catch (err) {
            console.warn(`Warning: Could not create backup directory [${this.BACKUP_DIR}]. Backup functionality may fail, but server will continue to start.`, err.message);
        }
        console.log('Backup configuration:', { directory: this.BACKUP_DIR });
    }
    getDbConfig() {
        const url = process.env.DATABASE_URL || '';
        const matches = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
        if (!matches)
            throw new Error('Invalid DATABASE_URL format');
        return {
            user: matches[1],
            password: matches[2],
            host: matches[3],
            port: matches[4],
            database: matches[5],
        };
    }
    // Simple JSON backup - one file per module
    async createModuleBackup(companyId, outputPath) {
        console.log('Starting module-based backup for company:', companyId);
        const backupData = {
            meta: {
                companyId,
                timestamp: new Date().toISOString(),
                version: '1.0'
            },
            data: {}
        };
        const modules = [
            { name: 'accounts', key: 'account' },
            { name: 'customers', key: 'customer' },
            { name: 'vendors', key: 'vendor' },
            { name: 'products', key: 'product' },
            { name: 'journals', key: 'journalEntry' },
            { name: 'invoices', key: 'invoice' },
            { name: 'purchase_orders', key: 'purchaseOrder' },
            { name: 'employees', key: 'employee' },
            { name: 'lcs', key: 'lc' },
            { name: 'attachments', key: 'attachment' },
            { name: 'backup_logs', key: 'backupLog' },
            { name: 'activity_logs', key: 'activityLog' },
            { name: 'notifications', key: 'notification' },
        ];
        for (const mod of modules) {
            try {
                console.log('Backing up:', mod.name);
                const data = await database_1.default[mod.key].findMany({
                    where: { companyId },
                    take: 100
                });
                backupData.data[mod.name] = data;
            }
            catch (e) {
                console.log('Skip', mod.name, '-', e.message);
                backupData.data[mod.name] = [];
            }
        }
        fs_1.default.writeFileSync(outputPath, JSON.stringify(backupData, null, 2), 'utf8');
        console.log('Backup written:', outputPath, 'Size:', fs_1.default.statSync(outputPath).size);
    }
    async createZipWithUploads(jsonPath, uploadsDir, outputZipPath) {
        const sources = [jsonPath];
        if (fs_1.default.existsSync(uploadsDir))
            sources.push(uploadsDir);
        try {
            if (process.platform === 'win32') {
                const srcList = sources.map(s => `"${s}"`).join(' ');
                const password = process.env.BACKUP_PASSWORD ? `-p"${process.env.BACKUP_PASSWORD}"` : '';
                // 7z a (add) -tzip (zip format) -mx=9 (ultra compression)
                await execPromise(`7z a -tzip -mx=9 ${password} "${outputZipPath}" ${srcList}`);
            }
            else {
                const srcList = sources.map(s => `"${s}"`).join(' ');
                await execPromise(`zip -r "${outputZipPath}" ${srcList}`);
            }
            return fs_1.default.existsSync(outputZipPath);
        }
        catch (err) {
            console.error('Zipping failed:', err);
            return false;
        }
    }
    async cleanupOldBackups() {
        try {
            if (!fs_1.default.existsSync(this.BACKUP_DIR))
                return;
            const files = fs_1.default.readdirSync(this.BACKUP_DIR)
                .filter(f => f.endsWith('.json') || f.endsWith('.zip') || f.endsWith('.7z'))
                .map(f => ({
                name: f,
                path: path_1.default.join(this.BACKUP_DIR, f),
                time: fs_1.default.statSync(path_1.default.join(this.BACKUP_DIR, f)).mtime.getTime()
            }))
                .sort((a, b) => b.time - a.time); // Newest first
            const keepCount = 10;
            if (files.length > keepCount) {
                const toDelete = files.slice(keepCount);
                console.log(`Cleaning up ${toDelete.length} old backups...`);
                for (const file of toDelete) {
                    fs_1.default.unlinkSync(file.path);
                }
            }
        }
        catch (err) {
            console.error('Backup cleanup failed:', err);
        }
    }
    async generateBackup(request, reply) {
        const companyId = request.params?.id || 'default';
        const userId = request.user?.id || 'system';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const jsonFileName = `backup_${companyId}_${timestamp}.json`;
        const zipFileName = `backup_${companyId}_${timestamp}.zip`;
        const jsonFilePath = path_1.default.join(this.BACKUP_DIR, jsonFileName);
        const zipFilePath = path_1.default.join(this.BACKUP_DIR, zipFileName);
        try {
            console.log('Starting backup for company:', companyId);
            await this.createModuleBackup(companyId, jsonFilePath);
            if (!fs_1.default.existsSync(jsonFilePath)) {
                throw new Error('JSON backup file was not created');
            }
            // Attempt to bundle DB JSON + uploads folder into a ZIP
            const uploadsDir = path_1.default.resolve(process.cwd(), 'uploads');
            let finalFileName = jsonFileName;
            let finalPath = jsonFilePath;
            try {
                const zipped = await this.createZipWithUploads(jsonFilePath, uploadsDir, zipFilePath);
                if (zipped) {
                    fs_1.default.unlinkSync(jsonFilePath); // remove the raw JSON — it lives inside the ZIP
                    finalFileName = zipFileName;
                    finalPath = zipFilePath;
                }
            }
            catch (zipErr) {
                console.warn('ZIP creation failed, falling back to JSON backup:', zipErr.message);
            }
            await this.cleanupOldBackups();
            const stats = fs_1.default.statSync(finalPath);
            console.log('Backup completed:', finalPath, 'Size:', stats.size);
            return reply.send({
                success: true,
                message: 'Backup completed',
                data: {
                    fileName: finalFileName,
                    size: stats.size,
                    downloadUrl: `/api/company/${companyId}/backups/download/${finalFileName}`,
                },
            });
        }
        catch (error) {
            console.error('Backup Error:', error);
            return reply.status(500).send({ success: false, error: { message: error.message } });
        }
    }
    async getBackups(request, reply) {
        if (!fs_1.default.existsSync(this.BACKUP_DIR)) {
            return reply.send({ success: true, data: [] });
        }
        const files = fs_1.default.readdirSync(this.BACKUP_DIR)
            .filter(f => f.endsWith('.json') || f.endsWith('.zip') || f.endsWith('.sql'))
            .map(f => {
            const stats = fs_1.default.statSync(path_1.default.join(this.BACKUP_DIR, f));
            return {
                id: f,
                fileName: f,
                fileSize: stats.size,
                status: 'SUCCESS',
                triggeredBy: 'system',
                createdAt: stats.birthtime
            };
        })
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        return reply.send({ success: true, data: files });
    }
    async downloadBackup(request, reply) {
        const { fileName } = request.params;
        const filePath = path_1.default.join(this.BACKUP_DIR, fileName);
        if (!fs_1.default.existsSync(filePath)) {
            throw new errorHandler_1.NotFoundError('Backup file not found on disk');
        }
        const stream = fs_1.default.createReadStream(filePath);
        reply.header('Content-Type', 'application/octet-stream');
        reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
        return reply.send(stream);
    }
    async restoreBackup(request, reply) {
        const { fileName } = request.params;
        const filePath = path_1.default.join(this.BACKUP_DIR, fileName);
        if (!fs_1.default.existsSync(filePath)) {
            throw new errorHandler_1.NotFoundError('Backup file not found');
        }
        try {
            if (fileName.endsWith('.json')) {
                const content = fs_1.default.readFileSync(filePath, 'utf8');
                const backup = JSON.parse(content);
                return reply.send({ success: true, message: 'Restore not implemented natively - data read successfully' });
            }
            else if (fileName.endsWith('.zip')) {
                const extractDir = path_1.default.join(this.BACKUP_DIR, `extracted_${Date.now()}`);
                fs_1.default.mkdirSync(extractDir, { recursive: true });
                if (process.platform === 'win32') {
                    await execPromise(`powershell -NoProfile -Command "Expand-Archive -Force -Path '${filePath}' -DestinationPath '${extractDir}'"`);
                }
                else {
                    await execPromise(`unzip -o "${filePath}" -d "${extractDir}"`);
                }
                const files = fs_1.default.readdirSync(extractDir);
                const jsonFile = files.find(f => f.endsWith('.json'));
                if (jsonFile) {
                    const content = fs_1.default.readFileSync(path_1.default.join(extractDir, jsonFile), 'utf8');
                    const backup = JSON.parse(content);
                    // Restore DB logic would go here
                }
                const extractedUploadsDir = path_1.default.join(extractDir, 'uploads');
                if (fs_1.default.existsSync(extractedUploadsDir)) {
                    const targetUploads = path_1.default.resolve(process.cwd(), 'uploads');
                    if (!fs_1.default.existsSync(targetUploads)) {
                        fs_1.default.mkdirSync(targetUploads, { recursive: true });
                    }
                    if (process.platform === 'win32') {
                        await execPromise(`xcopy /e /y /i "${extractedUploadsDir}\\*" "${targetUploads}\\"`);
                    }
                    else {
                        await execPromise(`cp -r "${extractedUploadsDir}/"* "${targetUploads}/"`);
                    }
                }
                fs_1.default.rmSync(extractDir, { recursive: true, force: true });
                return reply.send({ success: true, message: 'ZIP backup extracted and uploads restored successfully' });
            }
            else {
                throw new Error('Unsupported backup format');
            }
        }
        catch (error) {
            console.error('Restore Error:', error);
            return reply.status(500).send({ success: false, error: { message: error.message } });
        }
    }
    async uploadAndRestore(request, reply) {
        try {
            const parts = request.parts();
            let zipBuffer = null;
            let filename = 'uploaded_backup.zip';
            for await (const part of parts) {
                if (part.type === 'file') {
                    zipBuffer = await part.toBuffer();
                    filename = part.filename;
                }
            }
            if (!zipBuffer) {
                return reply.status(400).send({ success: false, message: 'Backup file is required' });
            }
            const tempFilePath = path_1.default.join(this.BACKUP_DIR, filename);
            fs_1.default.writeFileSync(tempFilePath, zipBuffer);
            // Programmatically call restoreBackup
            request.params = { fileName: filename };
            return await this.restoreBackup(request, reply);
        }
        catch (error) {
            console.error('Upload Restore Error:', error);
            return reply.status(500).send({ success: false, error: { message: error.message } });
        }
    }
}
exports.BackupController = BackupController;
//# sourceMappingURL=backup.controller.js.map