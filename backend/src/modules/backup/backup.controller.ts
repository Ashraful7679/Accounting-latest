import { FastifyRequest, FastifyReply } from 'fastify';
import path from 'path';
import fs from 'fs';
import prisma from '../../config/database';
import { NotFoundError } from '../../middleware/errorHandler';
import { saveFile, getFile, deleteFile, fileExists } from '../../lib/storage';

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
      console.warn(`Warning: Could not create backup directory [${this.BACKUP_DIR}]. Backup persistence may be limited.`, err.message);
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

  private async createModuleBackup(companyId: string): Promise<any> {
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
      { name: 'accounts', key: 'account', hasCompanyId: true },
      { name: 'customers', key: 'customer', hasCompanyId: true },
      { name: 'vendors', key: 'vendor', hasCompanyId: true },
      { name: 'products', key: 'product', hasCompanyId: true },
      { name: 'journals', key: 'journalEntry', hasCompanyId: true },
      { name: 'invoices', key: 'invoice', hasCompanyId: true },
      { name: 'purchase_orders', key: 'purchaseOrder', hasCompanyId: true },
      { name: 'employees', key: 'employee', hasCompanyId: true },
      { name: 'lcs', key: 'lc', hasCompanyId: true },
      { name: 'attachments', key: 'attachment', hasCompanyId: true },
      { name: 'backup_logs', key: 'backupLog', hasCompanyId: false },
      { name: 'activity_logs', key: 'activityLog', hasCompanyId: false },
      { name: 'notifications', key: 'notification', hasCompanyId: false },
    ];

    for (const mod of modules) {
      try {
        console.log('Backing up:', mod.name);
        let allRecords: any[] = [];
        let cursor: string | undefined;
        while (true) {
          const whereClause = mod.hasCompanyId ? { companyId } : {};
          const batch = await (prisma as any)[mod.key].findMany({
            where: whereClause,
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

    return backupData;
  }

  async generateBackup(request: FastifyRequest, reply: FastifyReply) {
    const companyId = (request.params as any)?.id || 'default';
    const userId = (request.user as any)?.id || 'system';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonFileName = `backup_${companyId}_${timestamp}.json`;

    try {
      console.log('Starting backup for company:', companyId);
      const backupData = await this.createModuleBackup(companyId);
      const jsonContent = JSON.stringify(backupData, null, 2);
      const buffer = Buffer.from(jsonContent, 'utf8');

      const result = await saveFile(jsonFileName, buffer, 'application/json');

      const size = result.fileSize;
      const downloadUrl = result.url || `/api/company/${companyId}/backups/download/${jsonFileName}`;

      return reply.send({
        success: true,
        message: 'Backup completed',
        data: {
          fileName: jsonFileName,
          size,
          downloadUrl,
          url: result.url,
        },
      });
    } catch (error: any) {
      console.error('Backup Error:', error);
      return reply.status(500).send({ success: false, error: { message: error.message } });
    }
  }

  async getBackups(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { list } = require('@vercel/blob');
      const { blobs } = await list({ prefix: 'backup_' });
      const files = blobs
        .filter(b => b.pathname.endsWith('.json'))
        .map(b => ({
          id: b.pathname,
          fileName: b.pathname,
          fileSize: b.size,
          downloadUrl: b.url,
          status: 'SUCCESS',
          triggeredBy: 'system',
          createdAt: new Date(b.uploadedAt),
        }))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return reply.send({ success: true, data: files });
    } catch {
      if (!fs.existsSync(this.BACKUP_DIR)) {
        return reply.send({ success: true, data: [] });
      }
      const files = fs.readdirSync(this.BACKUP_DIR)
        .filter(f => f.endsWith('.json') || f.endsWith('.zip'))
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
  }

  async downloadBackup(request: FastifyRequest, reply: FastifyReply) {
    const { fileName } = request.params as { fileName: string };

    try {
      const file = await getFile(fileName);
      if (file) {
        reply.header('Content-Type', 'application/octet-stream');
        reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
        return reply.send(file.stream);
      }
    } catch {}

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

    try {
      const file = await getFile(fileName);
      if (file) {
        const chunks: Buffer[] = [];
        for await (const chunk of file.stream) {
          chunks.push(Buffer.from(chunk));
        }
        const content = Buffer.concat(chunks).toString('utf8');
        const backup = JSON.parse(content);
        const result = await this.restoreFromJSON(backup);
        return reply.send({ success: true, message: 'Database restored successfully', data: result });
      }
    } catch {}

    const filePath = path.join(this.BACKUP_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundError('Backup file not found');
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const backup = JSON.parse(content);
      const result = await this.restoreFromJSON(backup);
      return reply.send({ success: true, message: 'Database restored successfully', data: result });
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
      console.log('[Restore] Phase 1: Deleting existing company data...');
      for (const model of deleteOrder) {
        try {
          const result = await tx[model].deleteMany({ where: { companyId } });
          console.log(`  Deleted ${result.count} from ${model}`);
        } catch (e: any) {
          console.log(`  Skip delete ${model}: ${e.message}`);
        }
      }

      console.log('[Restore] Phase 2: Inserting backup data...');
      for (const { backupKey, prismaKey } of insertMap) {
        const records = data[backupKey];
        if (!records || !Array.isArray(records) || records.length === 0) continue;

        try {
          const cleaned = records.map((r: any) => {
            const copy = { ...r };
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
            for (const key of Object.keys(copy)) {
              if (typeof copy[key] === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(copy[key])) {
                copy[key] = new Date(copy[key]);
              }
            }
            return copy;
          });

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
    }, { timeout: 120000 });

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
      let filename = 'uploaded_backup.json';

      for await (const part of parts) {
        if (part.type === 'file') {
          zipBuffer = await part.toBuffer();
          filename = part.filename;
        }
      }

      if (!zipBuffer) {
        return reply.status(400).send({ success: false, message: 'Backup file is required' });
      }

      const content = zipBuffer.toString('utf8');
      const backup = JSON.parse(content);
      const result = await this.restoreFromJSON(backup);
      return reply.send({ success: true, message: 'Database restored successfully', data: result });
    } catch (error: any) {
      console.error('Upload Restore Error:', error);
      return reply.status(500).send({ success: false, error: { message: error.message } });
    }
  }
}
