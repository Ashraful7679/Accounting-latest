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
        this.BACKUP_DIR = path_1.default.join(process.cwd(), 'backups');
        if (!fs_1.default.existsSync(this.BACKUP_DIR)) {
            fs_1.default.mkdirSync(this.BACKUP_DIR, { recursive: true });
        }
    }
    // Helper to extract DB config from DATABASE_URL
    getDbConfig() {
        const url = process.env.DATABASE_URL || '';
        const matches = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
        if (!matches)
            throw new Error('Invalid DATABASE_URL format in environment');
        return {
            user: matches[1],
            password: matches[2],
            host: matches[3],
            port: matches[4],
            database: matches[5],
        };
    }
    async generateBackup(request, reply) {
        const userId = request.user?.id || 'system';
        const { user, password, host, port, database } = this.getDbConfig();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const dbFileName = `db_${timestamp}.dump`;
        const zipFileName = `backup_${timestamp}.zip`;
        const dbFilePath = path_1.default.join(this.BACKUP_DIR, dbFileName);
        const zipFilePath = path_1.default.join(this.BACKUP_DIR, zipFileName);
        try {
            // Find pg_dump path on Windows
            let pgDumpPath = 'pg_dump';
            if (process.platform === 'win32') {
                const commonPaths = [
                    'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe',
                    'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe',
                    'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe',
                    'C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe',
                    'C:\\Program Files\\PostgreSQL\\14\\bin\\pg_dump.exe',
                ];
                for (const p of commonPaths) {
                    if (fs_1.default.existsSync(p)) {
                        pgDumpPath = `"${p}"`;
                        break;
                    }
                }
            }
            // 1. Database Dump (Custom Format)
            // Use double quotes for password to handle special characters on Windows
            const pgDumpCmd = process.platform === 'win32'
                ? `set "PGPASSWORD=${password.replace(/"/g, '""')}" && ${pgDumpPath} -U ${user} -h ${host} -p ${port} -F c -b -v -f "${dbFilePath}" ${database}`
                : `PGPASSWORD='${password.replace(/'/g, "'\\''")}' pg_dump -U ${user} -h ${host} -p ${port} -F c -b -v -f "${dbFilePath}" ${database}`;
            console.log('Running Backup Command:', pgDumpCmd.replace(password, '****'));
            try {
                await execPromise(pgDumpCmd);
            }
            catch (cmdError) {
                const errorMsg = cmdError.stderr || cmdError.stdout || cmdError.message;
                console.error('pg_dump execution failed:', errorMsg);
                throw new Error(`pg_dump failed: ${errorMsg}`);
            }
            // 2. Archive everything (DB Dump + Uploads)
            // Standard Windows 'tar' command
            const zipCmd = `tar -a -cf "${zipFilePath}" -C "${this.BACKUP_DIR}" "${dbFileName}" -C "${process.cwd()}" "uploads"`;
            await execPromise(zipCmd);
            // 3. Clean up the standalone DB dump after zipping
            if (fs_1.default.existsSync(dbFilePath)) {
                fs_1.default.unlinkSync(dbFilePath);
            }
            // 4. Log Success
            const stats = fs_1.default.statSync(zipFilePath);
            const log = await database_1.default.backupLog.create({
                data: {
                    fileName: zipFileName,
                    fileSize: stats.size,
                    status: 'SUCCESS',
                    triggeredBy: userId,
                }
            });
            return reply.send({ success: true, message: 'Backup completed', data: log });
        }
        catch (error) {
            console.error('Backup Error Detail:', error);
            await database_1.default.backupLog.create({
                data: {
                    fileName: zipFileName,
                    fileSize: 0,
                    status: 'FAILED',
                    triggeredBy: userId,
                }
            });
            return reply.status(500).send({ success: false, error: { message: 'Backup execution failed: ' + error.message } });
        }
    }
    async getBackups(request, reply) {
        const logs = await database_1.default.backupLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        return reply.send({ success: true, data: logs });
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
        const tempDir = path_1.default.join(this.BACKUP_DIR, 'temp_restore_' + Date.now());
        if (!fs_1.default.existsSync(filePath)) {
            throw new errorHandler_1.NotFoundError('Backup file not found on disk');
        }
        const { user, password, host, port, database } = this.getDbConfig();
        try {
            // 1. Create temp directory
            if (!fs_1.default.existsSync(tempDir))
                fs_1.default.mkdirSync(tempDir, { recursive: true });
            // 2. Extract archive
            console.log(`Extracting backup ${fileName} to ${tempDir}...`);
            const unzipCmd = `tar -xf "${filePath}" -C "${tempDir}"`;
            await execPromise(unzipCmd);
            // 3. Find the .dump file
            const files = fs_1.default.readdirSync(tempDir);
            const dumpFile = files.find(f => f.endsWith('.dump'));
            if (!dumpFile)
                throw new Error('No database dump found in archive');
            const dumpPath = path_1.default.join(tempDir, dumpFile);
            // 4. Find pg_restore path on Windows
            let pgRestorePath = 'pg_restore';
            if (process.platform === 'win32') {
                const commonPaths = [
                    'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe',
                    'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_restore.exe',
                    'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_restore.exe',
                    'C:\\Program Files\\PostgreSQL\\15\\bin\\pg_restore.exe',
                    'C:\\Program Files\\PostgreSQL\\14\\bin\\pg_restore.exe',
                ];
                for (const p of commonPaths) {
                    if (fs_1.default.existsSync(p)) {
                        pgRestorePath = `"${p}"`;
                        break;
                    }
                }
            }
            // 5. Run pg_restore
            // --clean drops database objects before recreating them
            // --if-exists used with --clean
            // -c is short for --clean
            const pgRestoreCmd = process.platform === 'win32'
                ? `set "PGPASSWORD=${password.replace(/"/g, '""')}" && ${pgRestorePath} -U ${user} -h ${host} -p ${port} -d ${database} -c --if-exists -v "${dumpPath}"`
                : `PGPASSWORD='${password.replace(/'/g, "'\\''")}' pg_restore -U ${user} -h ${host} -p ${port} -d ${database} -c --if-exists -v "${dumpPath}"`;
            console.log('Running Restore Command:', pgRestoreCmd.replace(password, '****'));
            try {
                await execPromise(pgRestoreCmd);
            }
            catch (cmdError) {
                const errorMsg = cmdError.stderr || cmdError.stdout || cmdError.message;
                console.error('pg_restore execution failed:', errorMsg);
                throw new Error(`pg_restore failed: ${errorMsg}`);
            }
            // 6. Restore uploads directory if it exists in backup
            const uploadsSource = path_1.default.join(tempDir, 'uploads');
            if (fs_1.default.existsSync(uploadsSource)) {
                console.log('Restoring uploads directory...');
                const uploadsDest = path_1.default.join(process.cwd(), 'uploads');
                // Simple way to "merge" or overwrite: copy files. 
                // Caution: This doesn't delete files that exist in dest but not in source.
                const copyCmd = process.platform === 'win32'
                    ? `xcopy "${uploadsSource}" "${uploadsDest}" /E /I /Y`
                    : `cp -R "${uploadsSource}/." "${uploadsDest}/"`;
                await execPromise(copyCmd);
            }
            return reply.send({ success: true, message: 'Restoration completed successfully' });
        }
        catch (error) {
            console.error('Restore Error Detail:', error);
            return reply.status(500).send({ success: false, error: { message: 'Restoration failed: ' + error.message } });
        }
        finally {
            // 7. Cleanup temp directory
            if (fs_1.default.existsSync(tempDir)) {
                try {
                    fs_1.default.rmSync(tempDir, { recursive: true, force: true });
                }
                catch (cleanupError) {
                    console.error('Failed to cleanup temp restore directory:', cleanupError);
                }
            }
        }
    }
    async uploadAndRestore(request, reply) {
        const userId = request.user?.id || 'system';
        const data = await request.file();
        if (!data) {
            return reply.status(400).send({ success: false, error: { message: 'No file uploaded' } });
        }
        const tempFileName = `manual_restore_${Date.now()}.zip`;
        const tempFilePath = path_1.default.join(this.BACKUP_DIR, tempFileName);
        const writeStream = fs_1.default.createWriteStream(tempFilePath);
        try {
            await new Promise((resolve, reject) => {
                data.file.pipe(writeStream);
                data.file.on('end', resolve);
                data.file.on('error', reject);
            });
            // Force request params for restoreBackup to pick it up
            request.params.fileName = tempFileName;
            // Call existing restore logic
            await this.restoreBackup(request, reply);
            // Since restoreBackup sends its own reply, we don't need to send another one here
            // but we should delete the temporary zip file
            if (fs_1.default.existsSync(tempFilePath)) {
                fs_1.default.unlinkSync(tempFilePath);
            }
        }
        catch (error) {
            if (fs_1.default.existsSync(tempFilePath))
                fs_1.default.unlinkSync(tempFilePath);
            console.error('Manual Restore Error:', error);
            return reply.status(500).send({ success: false, error: { message: 'Manual restoration failed: ' + error.message } });
        }
    }
}
exports.BackupController = BackupController;
//# sourceMappingURL=backup.controller.js.map