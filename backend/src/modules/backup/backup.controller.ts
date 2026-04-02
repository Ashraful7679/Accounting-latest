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
      { name: 'attachments', key: 'attachment' },
      { name: 'backup_logs', key: 'backupLog' },
      { name: 'activity_logs', key: 'activityLog' },
      { name: 'notifications', key: 'notification' },
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

  private async createZipWithUploads(jsonPath: string, uploadsDir: string, outputZipPath: string): Promise<boolean> {
    const sources: string[] = [jsonPath];
    if (fs.existsSync(uploadsDir)) sources.push(uploadsDir);

    try {
      if (process.platform === 'win32') {
        const srcList = sources.map(s => `"${s}"`).join(' ');
        const password = process.env.BACKUP_PASSWORD ? `-p"${process.env.BACKUP_PASSWORD}"` : '';
        // 7z a (add) -tzip (zip format) -mx=9 (ultra compression)
        await execPromise(`7z a -tzip -mx=9 ${password} "${outputZipPath}" ${srcList}`);
      } else {
        const srcList = sources.map(s => `"${s}"`).join(' ');
        await execPromise(`zip -r "${outputZipPath}" ${srcList}`);
      }
      return fs.existsSync(outputZipPath);
    } catch (err) {
      console.error('Zipping failed:', err);
      return false;
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    try {
      if (!fs.existsSync(this.BACKUP_DIR)) return;
      
      const files = fs.readdirSync(this.BACKUP_DIR)
        .filter(f => f.endsWith('.json') || f.endsWith('.zip') || f.endsWith('.7z'))
        .map(f => ({
          name: f,
          path: path.join(this.BACKUP_DIR, f),
          time: fs.statSync(path.join(this.BACKUP_DIR, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time); // Newest first

      const keepCount = 10;
      if (files.length > keepCount) {
        const toDelete = files.slice(keepCount);
        console.log(`Cleaning up ${toDelete.length} old backups...`);
        for (const file of toDelete) {
          fs.unlinkSync(file.path);
        }
      }
    } catch (err) {
      console.error('Backup cleanup failed:', err);
    }
  }

  async generateBackup(request: FastifyRequest, reply: FastifyReply) {
    const companyId = (request.params as any)?.id || 'default';
    const userId = (request.user as any)?.id || 'system';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonFileName = `backup_${companyId}_${timestamp}.json`;
    const zipFileName = `backup_${companyId}_${timestamp}.zip`;
    const jsonFilePath = path.join(this.BACKUP_DIR, jsonFileName);
    const zipFilePath = path.join(this.BACKUP_DIR, zipFileName);

    try {
      console.log('Starting backup for company:', companyId);
      await this.createModuleBackup(companyId, jsonFilePath);

      if (!fs.existsSync(jsonFilePath)) {
        throw new Error('JSON backup file was not created');
      }

      // Attempt to bundle DB JSON + uploads folder into a ZIP
      const uploadsDir = path.resolve(process.cwd(), 'uploads');
      let finalFileName = jsonFileName;
      let finalPath = jsonFilePath;

      try {
        const zipped = await this.createZipWithUploads(jsonFilePath, uploadsDir, zipFilePath);
        if (zipped) {
          fs.unlinkSync(jsonFilePath); // remove the raw JSON — it lives inside the ZIP
          finalFileName = zipFileName;
          finalPath = zipFilePath;
        }
      } catch (zipErr: any) {
        console.warn('ZIP creation failed, falling back to JSON backup:', zipErr.message);
      }

      await this.cleanupOldBackups();

      const stats = fs.statSync(finalPath);
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
      if (fileName.endsWith('.json')) {
        const content = fs.readFileSync(filePath, 'utf8');
        const backup = JSON.parse(content);
        return reply.send({ success: true, message: 'Restore not implemented natively - data read successfully' });
      } else if (fileName.endsWith('.zip')) {
        const extractDir = path.join(this.BACKUP_DIR, `extracted_${Date.now()}`);
        fs.mkdirSync(extractDir, { recursive: true });

        if (process.platform === 'win32') {
          await execPromise(`powershell -NoProfile -Command "Expand-Archive -Force -Path '${filePath}' -DestinationPath '${extractDir}'"`);
        } else {
          await execPromise(`unzip -o "${filePath}" -d "${extractDir}"`);
        }

        const files = fs.readdirSync(extractDir);
        const jsonFile = files.find(f => f.endsWith('.json'));

        if (jsonFile) {
          const content = fs.readFileSync(path.join(extractDir, jsonFile), 'utf8');
          const backup = JSON.parse(content);
          // Restore DB logic would go here
        }

        const extractedUploadsDir = path.join(extractDir, 'uploads');
        if (fs.existsSync(extractedUploadsDir)) {
          const targetUploads = path.resolve(process.cwd(), 'uploads');
          if (!fs.existsSync(targetUploads)) {
            fs.mkdirSync(targetUploads, { recursive: true });
          }
          if (process.platform === 'win32') {
            await execPromise(`xcopy /e /y /i "${extractedUploadsDir}\\*" "${targetUploads}\\"`);
          } else {
            await execPromise(`cp -r "${extractedUploadsDir}/"* "${targetUploads}/"`);
          }
        }

        fs.rmSync(extractDir, { recursive: true, force: true });
        return reply.send({ success: true, message: 'ZIP backup extracted and uploads restored successfully' });
      } else {
        throw new Error('Unsupported backup format');
      }
    } catch (error: any) {
      console.error('Restore Error:', error);
      return reply.status(500).send({ success: false, error: { message: error.message } });
    }
  }

  async uploadAndRestore(request: FastifyRequest, reply: FastifyReply) {
    try {
      const parts = request.parts();
      let zipBuffer: Buffer | null = null;
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

      const tempFilePath = path.join(this.BACKUP_DIR, filename);
      fs.writeFileSync(tempFilePath, zipBuffer);

      // Programmatically call restoreBackup
      (request.params as any) = { fileName: filename };
      return await this.restoreBackup(request, reply);
    } catch (error: any) {
      console.error('Upload Restore Error:', error);
      return reply.status(500).send({ success: false, error: { message: error.message } });
    }
  }
}
