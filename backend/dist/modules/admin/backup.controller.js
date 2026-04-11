"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupController = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const database_1 = __importDefault(require("../../config/database"));
class BackupController {
    constructor() {
        this.BACKUP_DIR = process.env.BACKUP_DIR || (process.platform === 'win32'
            ? path_1.default.join(process.cwd(), 'backups')
            : '/tmp/accabiz_backups');
        if (!fs_1.default.existsSync(this.BACKUP_DIR)) {
            fs_1.default.mkdirSync(this.BACKUP_DIR, { recursive: true });
        }
        console.log('Backup directory:', this.BACKUP_DIR);
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
    findPostgresBin(binName) {
        if (process.platform === 'win32') {
            const versions = ['18', '17', '16', '15', '14', '13', '12', '11'];
            for (const ver of versions) {
                const p = `C:\\Program Files\\PostgreSQL\\${ver}\\bin\\${binName}.exe`;
                if (fs_1.default.existsSync(p)) {
                    return `"${p}"`;
                }
            }
            return binName;
        }
        return binName;
    }
    async createSimpleBackup(outputPath) {
        console.log('Creating JSON backup...');
        const backupData = {
            meta: {
                timestamp: new Date().toISOString(),
                version: '1.0'
            },
            data: {}
        };
        const modules = [
            { name: 'users', key: 'user' },
            { name: 'roles', key: 'role' },
            { name: 'companies', key: 'company' },
            { name: 'accounts', key: 'account' },
            { name: 'customers', key: 'customer' },
            { name: 'vendors', key: 'vendor' },
            { name: 'products', key: 'product' },
            { name: 'journals', key: 'journalEntry' },
            { name: 'invoices', key: 'invoice' },
            { name: 'purchase_orders', key: 'purchaseOrder' },
            { name: 'lcs', key: 'lc' },
            { name: 'attachments', key: 'attachment' },
        ];
        for (const mod of modules) {
            try {
                const data = await database_1.default[mod.key].findMany({ take: 100 });
                backupData.data[mod.name] = data;
            }
            catch (e) {
                backupData.data[mod.name] = [];
            }
        }
        fs_1.default.writeFileSync(outputPath, JSON.stringify(backupData, null, 2), 'utf8');
        console.log('Backup written to:', outputPath);
    }
    async createBackup(request, reply) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `backup-${timestamp}.json`;
        const filePath = path_1.default.join(this.BACKUP_DIR, fileName);
        if (!fs_1.default.existsSync(this.BACKUP_DIR)) {
            fs_1.default.mkdirSync(this.BACKUP_DIR, { recursive: true });
        }
        try {
            // Direct JSON backup (simpler and works on cloud)
            await this.createSimpleBackup(filePath);
            const stats = fs_1.default.statSync(filePath);
            return reply.send({
                success: true,
                data: {
                    fileName,
                    size: stats.size,
                    timestamp: new Date().toISOString(),
                    downloadUrl: `/api/admin/backups/download/${fileName}`
                }
            });
        }
        catch (error) {
            console.error('Backup Error:', error);
            return reply.status(500).send({ success: false, message: 'Failed to create backup', error: error.message });
        }
    }
    async listBackups(request, reply) {
        if (!fs_1.default.existsSync(this.BACKUP_DIR))
            return reply.send({ success: true, data: [] });
        const files = fs_1.default.readdirSync(this.BACKUP_DIR)
            .filter(f => f.endsWith('.json') || f.endsWith('.sql') || f.endsWith('.zip'))
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
    async restoreBackup(request, reply) {
        const { fileName } = request.body;
        const filePath = path_1.default.join(this.BACKUP_DIR, fileName);
        if (!fs_1.default.existsSync(filePath)) {
            return reply.status(404).send({ success: false, message: 'Backup file not found' });
        }
        const { user, password, host, port, database } = this.getDbConfig();
        const psqlPath = this.findPostgresBin('psql');
        try {
            let restoreCmd;
            if (process.platform === 'win32') {
                restoreCmd = `set "PGPASSWORD=${password.replace(/"/g, '""')}" && ${psqlPath} -U ${user} -h ${host} -p ${port} -d ${database} -f "${filePath}"`;
            }
            else {
                restoreCmd = `PGPASSWORD='${password.replace(/'/g, "'\\''")}' ${psqlPath} -U ${user} -h ${host} -p ${port} -d ${database} -f "${filePath}"`;
            }
            const { exec } = await Promise.resolve().then(() => __importStar(require('child_process')));
            const { promisify } = await Promise.resolve().then(() => __importStar(require('util')));
            const execPromise = promisify(exec);
            await execPromise(restoreCmd);
            return reply.send({ success: true, message: 'Database restored successfully' });
        }
        catch (error) {
            console.error('Restore Error:', error);
            return reply.status(500).send({ success: false, message: 'Restoration failed', error: error.message });
        }
    }
    async downloadBackup(request, reply) {
        const { fileName } = request.params;
        const filePath = path_1.default.join(this.BACKUP_DIR, fileName);
        if (!fs_1.default.existsSync(filePath)) {
            return reply.status(404).send({ success: false, message: 'Backup file not found' });
        }
        const stream = fs_1.default.createReadStream(filePath);
        reply.header('Content-Type', 'application/octet-stream');
        reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
        return reply.send(stream);
    }
}
exports.BackupController = BackupController;
//# sourceMappingURL=backup.controller.js.map