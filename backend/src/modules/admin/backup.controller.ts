import { FastifyRequest, FastifyReply } from 'fastify';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execPromise = promisify(exec);

export class BackupController {
  
  async createBackup(request: FastifyRequest, reply: FastifyReply) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return reply.status(500).send({ success: false, message: 'DATABASE_URL not configured' });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup-${timestamp}.sql`;
    const filePath = path.join(process.cwd(), 'backups', fileName);

    // Ensure backups directory exists
    if (!fs.existsSync(path.join(process.cwd(), 'backups'))) {
      fs.mkdirSync(path.join(process.cwd(), 'backups'));
    }

    try {
      // Execute pg_dump
      await execPromise(`pg_dump "${databaseUrl}" -f "${filePath}"`);
      
      const stats = fs.statSync(filePath);
      
      return reply.send({ 
        success: true, 
        data: { 
          fileName, 
          size: stats.size,
          timestamp: new Date().toISOString(),
          downloadUrl: `/api/admin/backups/${fileName}`
        } 
      });
    } catch (error: any) {
      console.error('Backup Error:', error);
      return reply.status(500).send({ success: false, message: 'Failed to create backup', error: error.message });
    }
  }

  async listBackups(request: FastifyRequest, reply: FastifyReply) {
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) return reply.send({ success: true, data: [] });

    const files = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.sql'))
      .map(f => {
        const stats = fs.statSync(path.join(backupDir, f));
        return {
          fileName: f,
          size: stats.size,
          createdAt: stats.birthtime
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return reply.send({ success: true, data: files });
  }

  async restoreBackup(request: FastifyRequest, reply: FastifyReply) {
    const { fileName } = request.body as { fileName: string };
    const databaseUrl = process.env.DATABASE_URL;
    const filePath = path.join(process.cwd(), 'backups', fileName);

    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ success: false, message: 'Backup file not found' });
    }

    try {
      // CRITICAL: Auto-backup before restore
      const preRestoreBackup = `pre-restore-${new Date().getTime()}.sql`;
      await execPromise(`pg_dump "${databaseUrl}" -f "${path.join(process.cwd(), 'backups', preRestoreBackup)}"`);

      // Execute psql restore
      // Note: This usually requires --clean to drop existing objects
      await execPromise(`psql "${databaseUrl}" -f "${filePath}"`);

      return reply.send({ success: true, message: 'Database restored successfully' });
    } catch (error: any) {
      console.error('Restore Error:', error);
      return reply.status(500).send({ success: false, message: 'Restoration failed', error: error.message });
    }
  }
}
