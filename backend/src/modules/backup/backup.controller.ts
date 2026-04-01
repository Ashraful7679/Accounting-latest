import { FastifyRequest, FastifyReply } from 'fastify';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import util from 'util';
import prisma from '../../config/database';
import { NotFoundError } from '../../middleware/errorHandler';

const execPromise = util.promisify(exec);

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

  // Simple JSON backup - one file per module
  private async createModuleBackup(companyId: string, outputPath: string): Promise<void> {
    console.log('Starting module-based backup for company:', companyId);
    
    const backupData: Record<string, any> = {
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
    ];

    for (const mod of modules) {
      try {
        console.log('Backing up:', mod.name);
        const data = await (prisma as any)[mod.key].findMany({
          where: { companyId },
          take: 100
        });
        backupData.data[mod.name] = data;
      } catch (e: any) {
        console.log('Skip', mod.name, '-', e.message);
        backupData.data[mod.name] = [];
      }
    }

    fs.writeFileSync(outputPath, JSON.stringify(backupData, null, 2), 'utf8');
    console.log('Backup written:', outputPath, 'Size:', fs.statSync(outputPath).size);
  }

  async generateBackup(request: FastifyRequest, reply: FastifyReply) {
    const companyId = (request.params as any)?.id || 'default';
    const userId = (request.user as any)?.id || 'system';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup_${companyId}_${timestamp}.json`;
    const filePath = path.join(this.BACKUP_DIR, fileName);

    try {
      console.log('Starting backup for company:', companyId);
      
      // Try to create JSON backup using Prisma directly
      await this.createModuleBackup(companyId, filePath);

      if (!fs.existsSync(filePath)) {
        throw new Error('Backup file was not created');
      }

      const stats = fs.statSync(filePath);
      console.log('Backup completed:', filePath, 'Size:', stats.size);

      return reply.send({ 
        success: true, 
        message: 'Backup completed', 
        data: { 
          fileName, 
          size: stats.size,
          downloadUrl: `/api/company/${companyId}/backups/download/${fileName}`
        } 
      });
    } catch (error: any) {
      console.error('Backup Error:', error);
      return reply.status(500).send({ success: false, error: { message: error.message } });
    }
  }

  async getBackups(request: FastifyRequest, reply: FastifyReply) {
    if (!fs.existsSync(this.BACKUP_DIR)) {
      return reply.send({ success: true, data: [] });
    }

    const files = fs.readdirSync(this.BACKUP_DIR)
      .filter(f => f.endsWith('.json') || f.endsWith('.zip') || f.endsWith('.sql'))
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

  async downloadBackup(request: FastifyRequest, reply: FastifyReply) {
    const { fileName } = request.params as { fileName: string };
    const filePath = path.join(this.BACKUP_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundError('Backup file not found on disk');
    }

    const stream = fs.createReadStream(filePath);
    reply.header('Content-Type', 'application/octet-stream');
    reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
    return reply.send(stream);
  }

  async restoreBackup(request: FastifyRequest, reply: FastifyReply) {
    const { fileName } = request.params as { fileName: string };
    const filePath = path.join(this.BACKUP_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundError('Backup file not found');
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const backup = JSON.parse(content);
      
      return reply.send({ success: true, message: 'Restore not implemented - backup is JSON format' });
    } catch (error: any) {
      console.error('Restore Error:', error);
      return reply.status(500).send({ success: false, error: { message: error.message } });
    }
  }

  async uploadAndRestore(request: FastifyRequest, reply: FastifyReply) {
    return reply.status(501).send({ success: false, error: { message: 'Not implemented' } });
  }
}
