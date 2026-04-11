import { FastifyRequest, FastifyReply } from 'fastify';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import prisma from '../../config/database';

const execAsync = promisify(exec);

export class BackupController {
  async createBackup(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request.user as any)?.id;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(process.cwd(), 'backups');
    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const dbBackupFile = path.join(backupDir, `db-${timestamp}.sql`);
    const finalZipFile = path.join(backupDir, `backup-unified-${timestamp}.zip`);

    try {
      // 1. Export Database
      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) throw new Error('DATABASE_URL not set');
      
      // Basic pg_dump command (expects pg_dump in PATH)
      console.log(`Starting DB backup to ${dbBackupFile}...`);
      await execAsync(`pg_dump "${dbUrl}" --no-password > "${dbBackupFile}"`);

      // 2. Zip Database + Uploads
      const password = process.env.BACKUP_PASSWORD ? `-p"${process.env.BACKUP_PASSWORD}"` : '';
      console.log(`Creating unified archive at ${finalZipFile}...`);
      
      if (process.platform === 'win32') {
        const srcList = `"${dbBackupFile}" "${uploadsDir}"`;
        await execAsync(`7z a -tzip -mx=9 ${password} "${finalZipFile}" ${srcList}`);
      } else {
        await execAsync(`zip -r "${finalZipFile}" "${dbBackupFile}" "${uploadsDir}"`);
      }

      // 3. Clean up the SQL dump (it's inside the zip now)
      if (fs.existsSync(dbBackupFile)) {
        fs.unlinkSync(dbBackupFile);
      }

      await this.cleanupOldBackups(backupDir);

      // 4. Log the backup
      const stats = fs.statSync(finalZipFile);
      await prisma.backupLog.create({
        data: {
          fileName: path.basename(finalZipFile),
          fileSize: stats.size,
          status: 'SUCCESS',
          triggeredBy: userId || 'SYSTEM'
        }
      });

      return reply.send({ 
        success: true, 
        message: 'Unified backup (Database + Media) completed successfully.',
        fileName: path.basename(finalZipFile),
        size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB'
      });
    } catch (error: any) {
      console.error('Backup Error:', error);
      
      // Log failure
      await prisma.backupLog.create({
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

  private async cleanupOldBackups(backupDir: string): Promise<void> {
    try {
      if (!fs.existsSync(backupDir)) return;
      
      const files = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('backup-unified-') && f.endsWith('.zip'))
        .map(f => ({
          name: f,
          path: path.join(backupDir, f),
          time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      const keepCount = 10;
      if (files.length > keepCount) {
        const toDelete = files.slice(keepCount);
        for (const file of toDelete) {
          fs.unlinkSync(file.path);
        }
      }
    } catch (err) {
      console.error('System backup cleanup failed:', err);
    }
  }

  async listBackups(request: FastifyRequest, reply: FastifyReply) {
    const logs = await prisma.backupLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    return reply.send({ success: true, data: logs });
  }

  async downloadBackup(request: FastifyRequest, reply: FastifyReply) {
    const { fileName } = request.params as { fileName: string };
    const backupPath = path.join(process.cwd(), 'backups', fileName);

    if (!fs.existsSync(backupPath)) {
      return reply.status(404).send({ success: false, message: 'Backup file not found' });
    }

    const stream = fs.createReadStream(backupPath);
    return reply.type('application/zip').send(stream);
  }
}
