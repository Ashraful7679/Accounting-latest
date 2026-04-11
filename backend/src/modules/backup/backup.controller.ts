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
    
    try {
      if (!fs.existsSync(this.BACKUP_DIR)) {
        console.log(`Creating backup directory at: ${this.BACKUP_DIR}`);
        fs.mkdirSync(this.BACKUP_DIR, { recursive: true });
      }
    } catch (err: any) {
      console.warn(`Warning: Could not create backup directory [${this.BACKUP_DIR}]. Backup functionality may fail, but server will continue to start.`, err.message);
    }
    console.log('Backup configuration:', { directory: this.BACKUP_DIR });
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
        // Cursor-based pagination to fetch ALL records (no 100-record limit)
        let allRecords: any[] = [];
        let cursor: string | undefined;
        while (true) {
          const batch = await (prisma as any)[mod.key].findMany({
            where: { companyId },
            take: 1000,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
            orderBy: { id: 'asc' }
          });
          allRecords = allRecords.concat(batch);
          if (batch.length < 1000) break;
          cursor = batch[batch.length - 1].id;
        }
        backupData.data[mod.name] = allRecords;
        console.log(`  ${mod.name}: ${allRecords.length} records`);
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
        const result = await this.restoreFromJSON(backup);
        return reply.send({ success: true, message: 'Database restored successfully', data: result });
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
          await this.restoreFromJSON(backup);
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

  private async restoreFromJSON(backup: any): Promise<{ restored: Record<string, number> }> {
    const companyId = backup.meta?.companyId;
    if (!companyId) throw new Error('Backup file missing companyId in meta');

    const data = backup.data || {};
    const restored: Record<string, number> = {};

    // Delete order: reverse dependency (children first, then parents)
    const deleteOrder = [
      'activityLog', 'notification', 'backupLog',
      'attachment',
      'journalEntryLine', 'journalEntry',
      'payment', 'paymentPI',
      'invoiceLine', 'invoice',
      'purchaseOrderLine', 'purchaseOrder',
      'piLine', 'pI',
      'lC',
      'employeeLoanRepayment', 'employeeLoan', 'employeeAdvance', 'employeeExpense',
      'employee',
      'product',
      'customer', 'vendor',
      'account',
    ];

    // Insert order: forward dependency (parents first, then children)
    const insertMap: { backupKey: string; prismaKey: string }[] = [
      { backupKey: 'accounts', prismaKey: 'account' },
      { backupKey: 'customers', prismaKey: 'customer' },
      { backupKey: 'vendors', prismaKey: 'vendor' },
      { backupKey: 'products', prismaKey: 'product' },
      { backupKey: 'employees', prismaKey: 'employee' },
      { backupKey: 'lcs', prismaKey: 'lC' },
      { backupKey: 'purchase_orders', prismaKey: 'purchaseOrder' },
      { backupKey: 'invoices', prismaKey: 'invoice' },
      { backupKey: 'journals', prismaKey: 'journalEntry' },
      { backupKey: 'attachments', prismaKey: 'attachment' },
      { backupKey: 'activity_logs', prismaKey: 'activityLog' },
      { backupKey: 'notifications', prismaKey: 'notification' },
      { backupKey: 'backup_logs', prismaKey: 'backupLog' },
    ];

    await prisma.$transaction(async (tx: any) => {
      // Phase 1: Delete existing company data in reverse dependency order
      console.log('[Restore] Phase 1: Deleting existing company data...');
      for (const model of deleteOrder) {
        try {
          const result = await tx[model].deleteMany({ where: { companyId } });
          console.log(`  Deleted ${result.count} from ${model}`);
        } catch (e: any) {
          // Some models may not have companyId or may not exist
          console.log(`  Skip delete ${model}: ${e.message}`);
        }
      }

      // Phase 2: Insert backup data in forward dependency order
      console.log('[Restore] Phase 2: Inserting backup data...');
      for (const { backupKey, prismaKey } of insertMap) {
        const records = data[backupKey];
        if (!records || !Array.isArray(records) || records.length === 0) continue;

        try {
          // Clean records: remove relation fields that Prisma doesn't accept in createMany
          const cleaned = records.map((r: any) => {
            const copy = { ...r };
            // Remove common relation fields
            delete copy.company;
            delete copy.accountType;
            delete copy.parent;
            delete copy.children;
            delete copy.journalLines;
            delete copy.journalEntry;
            delete copy.lines;
            delete copy.payments;
            delete copy.customer;
            delete copy.vendor;
            delete copy.employee;
            delete copy.pis;
            delete copy.purchaseOrders;
            delete copy.invoices;
            delete copy.bills;
            delete copy.repayments;
            delete copy.loan;
            delete copy.account;
            delete copy.performedBy;
            delete copy.targetUser;
            delete copy.paymentAllocations;
            // Convert date strings back to Date objects
            for (const key of Object.keys(copy)) {
              if (typeof copy[key] === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(copy[key])) {
                copy[key] = new Date(copy[key]);
              }
            }
            return copy;
          });

          // Use createMany with skipDuplicates to handle any existing records
          const result = await tx[prismaKey].createMany({
            data: cleaned,
            skipDuplicates: true,
          });
          restored[backupKey] = result.count;
          console.log(`  Restored ${result.count} ${backupKey}`);
        } catch (e: any) {
          console.error(`  Failed to restore ${backupKey}:`, e.message);
          restored[backupKey] = 0;
        }
      }
    }, { timeout: 120000 }); // 2 minute timeout for large restores

    // Phase 3: Recalculate account balances from journal entries
    console.log('[Restore] Phase 3: Recalculating account balances...');
    const accounts = await prisma.account.findMany({
      where: { companyId },
      include: {
        accountType: true,
        journalLines: {
          where: { journalEntry: { status: 'APPROVED' } }
        }
      }
    });

    for (const acc of accounts) {
      const isDebitNormal = (acc as any).accountType?.type === 'DEBIT';
      const lineBalance = (acc as any).journalLines.reduce((s: number, l: any) => {
        return s + (isDebitNormal
          ? (Number(l.debit || 0) - Number(l.credit || 0))
          : (Number(l.credit || 0) - Number(l.debit || 0)));
      }, 0);
      const newBalance = (acc.openingBalance || 0) + lineBalance;
      await prisma.account.update({
        where: { id: acc.id },
        data: { currentBalance: newBalance }
      });
    }

    console.log('[Restore] Complete.');
    return { restored };
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
