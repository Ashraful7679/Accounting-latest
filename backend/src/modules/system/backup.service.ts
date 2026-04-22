import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import prisma from '../../config/database';

const execAsync = promisify(exec);

export class BackupService {
  private static BACKUP_DIR = path.join(process.cwd(), 'backups');

  /**
   * Performs a database backup using pg_dump.
   * Note: Requires pg_dump to be installed on the host system.
   */
  static async performBackup(userId: string = 'SYSTEM') {
    if (!fs.existsSync(this.BACKUP_DIR)) {
      fs.mkdirSync(this.BACKUP_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `accabiz_backup_${timestamp}.sql`;
    const filePath = path.join(this.BACKUP_DIR, fileName);
    
    // Extract DB params from DATABASE_URL
    const dbUrl = process.env.DATABASE_URL || '';
    
    try {
      // Basic pg_dump command. 
      // For industrial use, we'd use a more robust cloud-native solution (e.g. S3 upload)
      // but for this modernization step, local snapshotting is the baseline.
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
