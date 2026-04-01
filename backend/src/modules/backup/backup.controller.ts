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
    // Use /tmp on Linux/cloud, or local backups folder
    this.BACKUP_DIR = process.env.BACKUP_DIR || (process.platform === 'win32' 
      ? path.join(process.cwd(), 'backups') 
      : '/tmp/accabiz_backups');
    
    if (!fs.existsSync(this.BACKUP_DIR)) {
      fs.mkdirSync(this.BACKUP_DIR, { recursive: true });
    }
    console.log('Backup directory:', this.BACKUP_DIR);
  }

  // Helper to extract DB config from DATABASE_URL
  private getDbConfig() {
    const url = process.env.DATABASE_URL || '';
    console.log('DATABASE_URL:', url.replace(/\/\/[^:]+:[^@]+@/, '//****:****@'));
    
    const matches = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!matches) throw new Error('Invalid DATABASE_URL format in environment');
    return {
      user: matches[1],
      password: matches[2],
      host: matches[3],
      port: matches[4],
      database: matches[5],
    };
  }

  // Helper to find PostgreSQL binaries
  private findPostgresBin(binName: string): string {
    const platform = process.platform;
    
    if (platform === 'win32') {
      // Check common Windows paths
      const versions = ['18', '17', '16', '15', '14', '13', '12', '11'];
      for (const ver of versions) {
        const p = `C:\\Program Files\\PostgreSQL\\${ver}\\bin\\${binName}.exe`;
        if (fs.existsSync(p)) {
          console.log(`Found ${binName} at: ${p}`);
          return `"${p}"`;
        }
      }
    }
    
    // On Linux/cloud, try PATH
    return binName;
  }

  async generateBackup(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request.user as any)?.id || 'system';
    const { user, password, host, port, database } = this.getDbConfig();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dbFileName = `db_${timestamp}.sql`;
    const zipFileName = `backup_${timestamp}.zip`;
    
    const dbFilePath = path.join(this.BACKUP_DIR, dbFileName);
    const zipFilePath = path.join(this.BACKUP_DIR, zipFileName);

    try {
      // Find pg_dump
      const pgDumpPath = this.findPostgresBin('pg_dump');
      console.log('Using pg_dump path:', pgDumpPath);

      // 1. Database Dump (Plain SQL Format)
      let pgDumpCmd: string;
      if (process.platform === 'win32') {
        pgDumpCmd = `set "PGPASSWORD=${password.replace(/"/g, '""')}" && ${pgDumpPath} -U ${user} -h ${host} -p ${port} -F p -b -v -f "${dbFilePath}" ${database}`;
      } else {
        // For Linux/cloud platforms
        pgDumpCmd = `PGPASSWORD='${password.replace(/'/g, "'\\''")}' ${pgDumpPath} -U ${user} -h ${host} -p ${port} -F p -b -v -f "${dbFilePath}" ${database}`;
      }
      
      console.log('Running Backup Command...');

      try {
        await execPromise(pgDumpCmd);
      } catch (cmdError: any) {
        const errorMsg = cmdError.stderr || cmdError.stdout || cmdError.message;
        console.error('pg_dump execution failed:', errorMsg);
        throw new Error(`pg_dump failed: ${errorMsg}`);
      }

      // 2. Create ZIP archive (using zip command or tar)
      let zipCmd: string;
      if (process.platform === 'win32') {
        // Use PowerShell to create zip
        zipCmd = `powershell -Command "Compress-Archive -Path '${dbFilePath}' -DestinationPath '${zipFilePath}'"`;
      } else {
        // Linux - try zip command first, fallback to tar
        zipCmd = `zip -j "${zipFilePath}" "${dbFilePath}" 2>/dev/null || tar -a -cf "${zipFilePath}" "${dbFilePath}"`;
      }
      
      await execPromise(zipCmd);

      // 3. Clean up the standalone DB file after zipping
      if (fs.existsSync(dbFilePath)) {
        fs.unlinkSync(dbFilePath);
      }

      // 4. Log Success
      const stats = fs.statSync(zipFilePath);
      const log = await prisma.backupLog.create({
        data: {
          fileName: zipFileName,
          fileSize: stats.size,
          status: 'SUCCESS',
          triggeredBy: userId,
        }
      });

      return reply.send({ success: true, message: 'Backup completed', data: log });
    } catch (error: any) {
      console.error('Backup Error Detail:', error);
      await prisma.backupLog.create({
        data: {
          fileName: zipFileName,
          fileSize: 0,
          status: 'FAILED',
          triggeredBy: userId,
        }
      });
      return reply.status(500).send({ success: false, error: { message: 'Backup execution failed: ' + error.message } });
    }
  }

  async getBackups(request: FastifyRequest, reply: FastifyReply) {
    const logs = await prisma.backupLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    return reply.send({ success: true, data: logs });
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
    const tempDir = path.join(this.BACKUP_DIR, 'temp_restore_' + Date.now());

    if (!fs.existsSync(filePath)) {
      throw new NotFoundError('Backup file not found on disk');
    }

    const { user, password, host, port, database } = this.getDbConfig();

    try {
      // 1. Create temp directory
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

      // 2. Extract archive (handle both .zip and .tar formats)
      console.log(`Extracting backup ${fileName} to ${tempDir}...`);
      let extractCmd: string;
      
      if (fileName.endsWith('.zip')) {
        if (process.platform === 'win32') {
          extractCmd = `powershell -Command "Expand-Archive -Path '${filePath}' -DestinationPath '${tempDir}' -Force"`;
        } else {
          extractCmd = `unzip -o "${filePath}" -d "${tempDir}"`;
        }
      } else {
        extractCmd = `tar -xf "${filePath}" -C "${tempDir}"`;
      }
      
      await execPromise(extractCmd);

      // 3. Find the SQL file (supports both .sql and .dump)
      const files = fs.readdirSync(tempDir);
      const dumpFile = files.find(f => f.endsWith('.sql') || f.endsWith('.dump'));
      if (!dumpFile) throw new Error('No database dump found in archive (looking for .sql or .dump files)');
      const dumpPath = path.join(tempDir, dumpFile);
      console.log('Found dump file:', dumpFile);

      // 4. Find psql path
      const psqlPath = this.findPostgresBin('psql');
      console.log('Using psql path:', psqlPath);

      // 5. Run restore using psql
      let restoreCmd: string;
      if (process.platform === 'win32') {
        restoreCmd = `set "PGPASSWORD=${password.replace(/"/g, '""')}" && ${psqlPath} -U ${user} -h ${host} -p ${port} -d ${database} -f "${dumpPath}"`;
      } else {
        restoreCmd = `PGPASSWORD='${password.replace(/'/g, "'\\''")}' ${psqlPath} -U ${user} -h ${host} -p ${port} -d ${database} -f "${dumpPath}"`;
      }

      console.log('Running Restore Command...');
      
      try {
        await execPromise(restoreCmd);
      } catch (cmdError: any) {
        const errorMsg = cmdError.stderr || cmdError.stdout || cmdError.message;
        console.error('psql execution failed:', errorMsg);
        throw new Error(`psql failed: ${errorMsg}`);
      }

      // 6. Restore uploads directory if it exists in backup
      const uploadsSource = path.join(tempDir, 'uploads');
      if (fs.existsSync(uploadsSource)) {
        console.log('Restoring uploads directory...');
        const uploadsDest = path.join(process.cwd(), 'uploads');
        const copyCmd = process.platform === 'win32'
          ? `xcopy "${uploadsSource}" "${uploadsDest}" /E /I /Y`
          : `cp -R "${uploadsSource}/." "${uploadsDest}/" 2>/dev/null || true`;
        await execPromise(copyCmd);
      }

      return reply.send({ success: true, message: 'Restoration completed successfully' });
    } catch (error: any) {
      console.error('Restore Error Detail:', error);
      return reply.status(500).send({ success: false, error: { message: 'Restoration failed: ' + error.message } });
    } finally {
      // 7. Cleanup temp directory
      if (fs.existsSync(tempDir)) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (cleanupError) {
          console.error('Failed to cleanup temp restore directory:', cleanupError);
        }
      }
    }
  }

  async uploadAndRestore(request: FastifyRequest, reply: FastifyReply) {
    const userId = (request.user as any)?.id || 'system';
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ success: false, error: { message: 'No file uploaded' } });
    }

    const tempFileName = `manual_restore_${Date.now()}.zip`;
    const tempFilePath = path.join(this.BACKUP_DIR, tempFileName);
    const writeStream = fs.createWriteStream(tempFilePath);
    
    try {
      await new Promise((resolve, reject) => {
        data.file.pipe(writeStream);
        data.file.on('end', resolve);
        data.file.on('error', reject);
      });

      // Force request params for restoreBackup to pick it up
      (request.params as any).fileName = tempFileName;
      
      // Call existing restore logic
      await this.restoreBackup(request, reply);
      
      // Since restoreBackup sends its own reply, we don't need to send another one here
      // but we should delete the temporary zip file
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (error: any) {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      console.error('Manual Restore Error:', error);
      return reply.status(500).send({ success: false, error: { message: 'Manual restoration failed: ' + error.message } });
    }
  }
}
