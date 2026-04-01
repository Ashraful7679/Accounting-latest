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
    console.log('Using Prisma-based backup fallback...');
    
    const tablesResult = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma_%'`
    );
    const tables = Array.isArray(tablesResult) ? tablesResult : [];
    
    let sqlContent = '-- Database Backup created at ' + new Date().toISOString() + '\n\n';
    
    for (const table of tables) {
      if (!table?.tablename) continue;
      const tableName = table.tablename;
      
      const columnsResult = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = '${tableName}' AND table_schema = 'public'`
      );
      const columns = Array.isArray(columnsResult) ? columnsResult : [];
      
      if (columns.length === 0) continue;
      
      const rowsResult = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "${tableName}"`);
      const rows = Array.isArray(rowsResult) ? rowsResult : [];
      
      if (rows.length > 0) {
        sqlContent += `-- Data for ${tableName}\n`;
        const colNames = columns.map(c => `"${c.column_name}"`).join(', ');
        
        for (const row of rows) {
          const values = columns.map(col => {
            const val = row[col.column_name];
            if (val === null) return 'NULL';
            if (typeof val === 'number') return val.toString();
            if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
            if (val instanceof Date) return `'${val.toISOString()}'`;
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
            return `'${String(val).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
          });
          sqlContent += `INSERT INTO "${tableName}" (${colNames}) VALUES (${values.join(', ')});\n`;
        }
        sqlContent += '\n';
      }
    }
    
    fs.writeFileSync(outputPath, sqlContent, 'utf8');
    console.log('Simple backup written to:', outputPath);
  }

  async createBackup(request: FastifyRequest, reply: FastifyReply) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup-${timestamp}.sql`;
    const filePath = path.join(this.BACKUP_DIR, fileName);

    if (!fs.existsSync(this.BACKUP_DIR)) {
      fs.mkdirSync(this.BACKUP_DIR, { recursive: true });
    }

    try {
      const { user, password, host, port, database } = this.getDbConfig();
      const pgDumpPath = this.findPostgresBin('pg_dump');
      
      let pgDumpCmd: string;
      if (process.platform === 'win32') {
        pgDumpCmd = `set "PGPASSWORD=${password.replace(/"/g, '""')}" && ${pgDumpPath} -U ${user} -h ${host} -p ${port} -F p -f "${filePath}" ${database}`;
      } else {
        pgDumpCmd = `PGPASSWORD='${password.replace(/'/g, "'\\''")}' ${pgDumpPath} -U ${user} -h ${host} -p ${port} -F p -f "${filePath}" ${database}`;
      }

      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execPromise = promisify(exec);
        await execPromise(pgDumpCmd);
      } catch (cmdError: any) {
        console.log('pg_dump failed, using Prisma fallback...');
        await this.createSimpleBackup(filePath);
      }
      
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
    if (!fs.existsSync(this.BACKUP_DIR)) return reply.send({ success: true, data: [] });

    const files = fs.readdirSync(this.BACKUP_DIR)
      .filter(f => f.endsWith('.sql'))
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
}