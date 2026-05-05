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
        const binPath = path.join('C:\\Program Files\\PostgreSQL', ver, 'bin', `${binName}.exe`);
        if (fs.existsSync(binPath)) {
          return binPath;
        }
      }
      return binName;
    }
    return binName;
  }

  private async dumpDatabase(outputPath: string): Promise<void> {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL is not configured');

    const pgDump = this.findPostgresBin('pg_dump');
    const { password } = this.getDbConfig();
    const escapedPassword = process.platform === 'win32'
      ? password.replace(/"/g, '""')
      : password.replace(/'/g, "'\\''");

    const dumpCmd = process.platform === 'win32'
      ? `set "PGPASSWORD=${escapedPassword}" && "${pgDump}" "${dbUrl}" --no-owner --no-privileges --file "${outputPath}"`
      : `PGPASSWORD='${escapedPassword}' "${pgDump}" "${dbUrl}" --no-owner --no-privileges --file "${outputPath}"`;

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execPromise = promisify(exec);
    await execPromise(dumpCmd);
  }

  private async createAuditLog(request: FastifyRequest, action: string, targetResource: string, targetId: string, details?: Record<string, unknown>) {
    const ipAddress = (request.ip || (request.headers['x-forwarded-for'] as string)?.split(',')[0] || 'unknown') as string;
    await (prisma as any).systemAuditLog.create({
      data: {
        adminId: (request.user as any).id,
        action,
        targetResource,
        targetId,
        ipAddress,
        details: details || null,
      },
    });
  }

  private async createCompanyScopedBackup(companyId: string, outputPath: string): Promise<void> {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      throw new Error('Company not found');
    }

    const backupPayload: any = {
      meta: {
        createdAt: new Date().toISOString(),
        companyId,
        companyName: company.name,
      },
      data: {},
    };

    const scopedModels = [
      { name: 'companies', key: 'company', where: { id: companyId } },
      { name: 'accounts', key: 'account', where: { companyId } },
      { name: 'customers', key: 'customer', where: { companyId } },
      { name: 'vendors', key: 'vendor', where: { companyId } },
      { name: 'products', key: 'product', where: { companyId } },
      { name: 'journals', key: 'journal', where: { companyId } },
      { name: 'invoices', key: 'invoice', where: { companyId } },
      { name: 'purchaseOrders', key: 'purchaseOrder', where: { companyId } },
      { name: 'lcs', key: 'lc', where: { companyId } },
      { name: 'attachments', key: 'attachment', where: { companyId } },
    ];

    for (const model of scopedModels) {
      const data = await (prisma as any)[model.key].findMany({ where: model.where });
      backupPayload.data[model.name] = data;
    }

    fs.writeFileSync(outputPath, JSON.stringify(backupPayload, null, 2));
  }

  async createBackup(request: FastifyRequest, reply: FastifyReply) {
    const { companyId } = request.query as { companyId?: string };
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = companyId ? `backup-company-${companyId}-${timestamp}.json` : `backup-${timestamp}.sql`;
    const filePath = path.join(this.BACKUP_DIR, fileName);

    if (!fs.existsSync(this.BACKUP_DIR)) {
      fs.mkdirSync(this.BACKUP_DIR, { recursive: true });
    }

    try {
      if (companyId) {
        await this.createCompanyScopedBackup(companyId, filePath);
      } else {
        await this.dumpDatabase(filePath);
      }

      const stats = fs.statSync(filePath);

      return reply.send({ 
        success: true, 
        data: { 
          fileName, 
          size: stats.size,
          timestamp: new Date().toISOString(),
          downloadUrl: `/api/admin/backups/download/${fileName}`,
          scope: companyId ? 'COMPANY' : 'SYSTEM',
          companyId: companyId || null,
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
          size: stats.size,
          status: 'SUCCESS',
          triggeredBy: 'system',
          scope: f.endsWith('.json') ? 'COMPANY' : 'SYSTEM',
          createdAt: stats.birthtime
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return reply.send({ success: true, data: files });
  }

  async restoreBackup(request: FastifyRequest, reply: FastifyReply) {
    const { fileName } = request.body as { fileName: string };

    if (!fileName.endsWith('.sql')) {
      return reply.status(400).send({ success: false, message: 'Only SQL backup files can be restored through this endpoint' });
    }

    const filePath = path.join(this.BACKUP_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ success: false, message: 'Backup file not found' });
    }

    const { user, password, host, port, database } = this.getDbConfig();
    const psqlBin = this.findPostgresBin('psql');

    try {
      const escapedPassword = process.platform === 'win32'
        ? password.replace(/"/g, '""')
        : password.replace(/'/g, "'\\''");

      const restoreCmd = process.platform === 'win32'
        ? `set "PGPASSWORD=${escapedPassword}" && "${psqlBin}" -U ${user} -h ${host} -p ${port} -d ${database} -f "${filePath}"`
        : `PGPASSWORD='${escapedPassword}' "${psqlBin}" -U ${user} -h ${host} -p ${port} -d ${database} -f "${filePath}"`;

      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execPromise = promisify(exec);
      await execPromise(restoreCmd);

      const { fileName } = request.body as { fileName: string };
      await this.createAuditLog(request, 'RESTORE_BACKUP', 'Backup', fileName, { fileName });

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