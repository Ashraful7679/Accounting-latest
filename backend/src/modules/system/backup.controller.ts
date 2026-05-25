import { FastifyRequest, FastifyReply } from 'fastify';
import path from 'path';
import fs from 'fs';
import prisma from '../../config/database';

export class BackupController {
  async createBackup(request: FastifyRequest, reply: FastifyReply) {
    if (process.env.VERCEL === '1') {
      return reply.status(503).send({
        success: false,
        message: 'System backup via pg_dump is not available in serverless mode. Use Neon Console for database backups.',
      });
    }

    const userId = (request.user as any)?.id;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(process.cwd(), 'backups');
    
    try {
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    } catch (error: any) {
      return reply.status(500).send({ success: false, message: 'Cannot create backup directory', error: error.message });
    }

    const dbBackupFile = path.join(backupDir, `db-${timestamp}.sql`);

    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const dbUrl = process.env.DATABASE_URL;
      if (!dbUrl) throw new Error('DATABASE_URL not set');
      
      console.log(`Starting DB backup to ${dbBackupFile}...`);
      await execAsync(`pg_dump "${dbUrl}" --no-password > "${dbBackupFile}"`);

      const stats = fs.statSync(dbBackupFile);
      await prisma.backupLog.create({
        data: {
          fileName: path.basename(dbBackupFile),
          fileSize: stats.size,
          status: 'SUCCESS',
          triggeredBy: userId || 'SYSTEM'
        }
      });

      return reply.send({ 
        success: true, 
        message: 'Database backup completed successfully.',
        fileName: path.basename(dbBackupFile),
        size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB'
      });
    } catch (error: any) {
      console.error('Backup Error:', error);
      
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
        message: 'Backup failed. Ensure pg_dump is in your system PATH.',
        error: error.message 
      });
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
