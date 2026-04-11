import { FastifyRequest, FastifyReply } from 'fastify';
import path from 'path';
import fs from 'fs';
import prisma from '../../config/database';

export class BackupController {
  private BACKUP_DIR: string;

  constructor() {
    this.BACKUP_DIR = process.env.BACKUP_DIR || (process.platform === 'win32' 
      ? path.join(process.cwd(), 'backups') 
      : '/tmp/accabiz_backups');
    
    if (!fs.existsSync(this.BACKUP_DIR)) {
      fs.mkdirSync(this.BACKUP_DIR, { recursive: true });
    }
    console.log('Backup directory:', this.BACKUP_DIR);
  }

  private getDbConfig() {
    const url = process.env.DATABASE_URL || '';
    const matches = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!matches) throw new Error('Invalid DATABASE_URL format');
    return {
      user: matches[1],
      password: matches[2],
      host: matches[3],
      port: matches[4],
      database: matches[5],
    };
  }

  private findPostgresBin(binName: string): string {
    if (process.platform === 'win32') {
      const versions = ['18', '17', '16', '15', '14', '13', '12', '11'];
      for (const ver of versions) {
        const p = `C:\\Program Files\\PostgreSQL\\${ver}\\bin\\${binName}.exe`;
        if (fs.existsSync(p)) {
          return `"${p}"`;
        }
      }
      return binName;
    }
    return binName;
  }

  private async createSimpleBackup(outputPath: string): Promise<void> {
    console.log('Creating JSON backup...');
    
    const backupData: Record<string, any> = {
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
        const data = await (prisma as any)[mod.key].findMany({ take: 100 });
        backupData.data[mod.name] = data;
      } catch (e: any) {
        backupData.data[mod.name] = [];
      }
    }

    fs.writeFileSync(outputPath, JSON.stringify(backupData, null, 2), 'utf8');
    console.log('Backup written to:', outputPath);
  }

  async createBackup(request: FastifyRequest, reply: FastifyReply) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup-${timestamp}.json`;
    const filePath = path.join(this.BACKUP_DIR, fileName);

    if (!fs.existsSync(this.BACKUP_DIR)) {
      fs.mkdirSync(this.BACKUP_DIR, { recursive: true });
    }

    try {
      // Direct JSON backup (simpler and works on cloud)
      await this.createSimpleBackup(filePath);
      
      const stats = fs.statSync(filePath);
      
      return reply.send({ 
        success: true, 
        data: { 
          fileName, 
          size: stats.size,
          timestamp: new Date().toISOString(),
          downloadUrl: `/api/admin/backups/download/${fileName}`
        } 
      });
    } catch (error: any) {
      console.error('Backup Error:', error);
      return reply.status(500).send({ success: false, message: 'Failed to create backup', error: error.message });
    }
  }

  async listBackups(request: FastifyRequest, reply: FastifyReply) {
    if (!fs.existsSync(this.BACKUP_DIR)) return reply.send({ success: true, data: [] });

    const files = fs.readdirSync(this.BACKUP_DIR)
      .filter(f => f.endsWith('.json') || f.endsWith('.sql') || f.endsWith('.zip'))
      .map(f => {
        const stats = fs.statSync(path.join(this.BACKUP_DIR, f));
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

  async restoreBackup(request: FastifyRequest, reply: FastifyReply) {
    const { fileName } = request.body as { fileName: string };
    const filePath = path.join(this.BACKUP_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ success: false, message: 'Backup file not found' });
    }

    const { user, password, host, port, database } = this.getDbConfig();
    const psqlPath = this.findPostgresBin('psql');

    try {
      let restoreCmd: string;
      if (process.platform === 'win32') {
        restoreCmd = `set "PGPASSWORD=${password.replace(/"/g, '""')}" && ${psqlPath} -U ${user} -h ${host} -p ${port} -d ${database} -f "${filePath}"`;
      } else {
        restoreCmd = `PGPASSWORD='${password.replace(/'/g, "'\\''")}' ${psqlPath} -U ${user} -h ${host} -p ${port} -d ${database} -f "${filePath}"`;
      }

      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execPromise = promisify(exec);
      await execPromise(restoreCmd);

      return reply.send({ success: true, message: 'Database restored successfully' });
    } catch (error: any) {
      console.error('Restore Error:', error);
      return reply.status(500).send({ success: false, message: 'Restoration failed', error: error.message });
    }
  }

  async downloadBackup(request: FastifyRequest, reply: FastifyReply) {
    const { fileName } = request.params as { fileName: string };
    const filePath = path.join(this.BACKUP_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ success: false, message: 'Backup file not found' });
    }

    const stream = fs.createReadStream(filePath);
    reply.header('Content-Type', 'application/octet-stream');
    reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
    return reply.send(stream);
  }
}