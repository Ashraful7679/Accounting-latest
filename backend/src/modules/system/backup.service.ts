import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import prisma from '../../config/database';

const execAsync = promisify(exec);

export class BackupService {
  private static BACKUP_DIR = process.env.VERCEL === '1' ? '/tmp/accabiz_backups' : path.join(process.cwd(), 'backups');

  static async performBackup(userId: string = 'SYSTEM') {
    if (process.env.VERCEL === '1') {
      console.log('[BackupService] pg_dump not available in serverless. Skipping automated backup.');
      return { success: false, error: 'Not available in serverless mode. Use Neon built-in backups.' };
    }

    try {
      if (!fs.existsSync(this.BACKUP_DIR)) {
        fs.mkdirSync(this.BACKUP_DIR, { recursive: true });
      }
    } catch {
      return { success: false, error: 'Cannot create backup directory' };
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `accabiz_backup_${timestamp}.sql`;
    const filePath = path.join(this.BACKUP_DIR, fileName);
    
    const dbUrl = process.env.DATABASE_URL || '';
    
    try {
      await execAsync(`pg_dump "${dbUrl}" > "${filePath}"`);
      
      const stats = fs.statSync(filePath);

      const log = await prisma.backupLog.create({
        data: {
          fileName,
          filePath,
          fileSize: stats.size,
          status: 'SUCCESS',
          triggeredBy: userId
        }
      });

      return { success: true, log };
    } catch (error: any) {
      console.error('Backup Failed:', error);
      
      const log = await prisma.backupLog.create({
        data: {
          fileName,
          status: 'FAILED',
          error: error.message,
          triggeredBy: userId
        }
      });

      return { success: false, error: error.message, log };
    }
  }

  static async listBackups() {
    return await prisma.backupLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  }
}
