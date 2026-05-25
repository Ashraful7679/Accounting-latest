import { FastifyRequest, FastifyReply } from 'fastify';
import path from 'path';
import fs from 'fs';
import prisma from '../../config/database';
import { saveFile, getFile } from '../../lib/storage';

export class BackupController {
  private BACKUP_DIR: string;

  constructor() {
    this.BACKUP_DIR = process.env.BACKUP_DIR || (process.platform === 'win32' 
      ? path.join(process.cwd(), 'backups') 
      : '/tmp/accabiz_backups');
    
    try {
      if (!fs.existsSync(this.BACKUP_DIR)) {
        fs.mkdirSync(this.BACKUP_DIR, { recursive: true });
      }
    } catch {}
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
        const binPath = path.join('C:\\Program Files\\PostgreSQL', ver, 'bin', `${binName}.exe`);
        if (fs.existsSync(binPath)) {
          return binPath;
        }
      }
      return binName;
    }
    return binName;
  }

  private async dumpDatabase(outputPath: string): Promise<void> {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL is not configured');

    const pgDump = this.findPostgresBin('pg_dump');
    const { password } = this.getDbConfig();
    const escapedPassword = process.platform === 'win32'
      ? password.replace(/"/g, '""')
      : password.replace(/'/g, "'\\''");

    const dumpCmd = process.platform === 'win32'
      ? `set "PGPASSWORD=${escapedPassword}" && "${pgDump}" "${dbUrl}" --no-owner --no-privileges --file "${outputPath}"`
      : `PGPASSWORD='${escapedPassword}' "${pgDump}" "${dbUrl}" --no-owner --no-privileges --file "${outputPath}"`;

    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execPromise = promisify(exec);
    await execPromise(dumpCmd);
  }

  private isServerless(): boolean {
    return process.env.VERCEL === '1' || !!process.env.BLOB_READ_WRITE_TOKEN;
  }

  private async createAuditLog(request: FastifyRequest, action: string, targetResource: string, targetId: string, details?: Record<string, unknown>) {
    const ipAddress = (request.ip || (request.headers['x-forwarded-for'] as string)?.split(',')[0] || 'unknown') as string;
    await (prisma as any).systemAuditLog.create({
      data: {
        adminId: (request.user as any).id,
        action,
        targetResource,
        targetId,
        ipAddress,
        details: details || null,
      },
    });
  }

  private async createCompanyScopedBackup(companyId: string): Promise<{ fileName: string; buffer: Buffer }> {
    const company = await prisma.company.findUnique({ 
      where: { id: companyId },
      include: { settings: true }
    });
    if (!company) {
      throw new Error('Company not found');
    }

    const backupPayload: any = {
      meta: {
        version: '1.0',
        createdAt: new Date().toISOString(),
        companyId,
        companyName: company.name,
        companyCode: company.code,
      },
      data: {
        company,
      },
    };

    const directModels = [
      { name: 'branches', key: 'branch' },
      { name: 'documentSequences', key: 'documentSequence' },
      { name: 'accounts', key: 'account' },
      { name: 'projects', key: 'project' },
      { name: 'costCenters', key: 'costCenter' },
      { name: 'customers', key: 'customer' },
      { name: 'vendors', key: 'vendor' },
      { name: 'products', key: 'product' },
      { name: 'lcs', key: 'lC' },
      { name: 'pis', key: 'pI' },
      { name: 'loans', key: 'loan' },
      { name: 'purchaseOrders', key: 'purchaseOrder' },
      { name: 'salesOrders', key: 'salesOrder' },
      { name: 'invoices', key: 'invoice' },
      { name: 'journalEntries', key: 'journalEntry' },
      { name: 'bills', key: 'bill' },
      { name: 'grns', key: 'gRN' },
      { name: 'dns', key: 'dN' },
      { name: 'payments', key: 'payment' },
      { name: 'employees', key: 'employee' },
      { name: 'employeeAdvances', key: 'employeeAdvance' },
      { name: 'employeeLoans', key: 'employeeLoan' },
      { name: 'employeeLoanRepayments', key: 'employeeLoanRepayment' },
      { name: 'employeeExpenses', key: 'employeeExpense' },
      { name: 'fixedAssets', key: 'fixedAsset' },
      { name: 'payrollRuns', key: 'payrollRun' },
      { name: 'debitNotes', key: 'debitNote' },
      { name: 'creditNotes', key: 'creditNote' },
      { name: 'recurringInvoices', key: 'recurringInvoice' },
      { name: 'activityLogs', key: 'activityLog' },
      { name: 'notifications', key: 'notification' },
      { name: 'attachments', key: 'attachment' },
    ];

    for (const model of directModels) {
      try {
        const data = await (prisma as any)[model.key].findMany({ where: { companyId } });
        backupPayload.data[model.name] = data;
      } catch (err) {
        console.warn(`Could not fetch data for model ${model.name}:`, err);
        backupPayload.data[model.name] = [];
      }
    }

    if (backupPayload.data.pis.length > 0) {
      const piIds = backupPayload.data.pis.map((p: any) => p.id);
      backupPayload.data.piLines = await prisma.pILine.findMany({ where: { piId: { in: piIds } } });
    }
    if (backupPayload.data.purchaseOrders.length > 0) {
      const poIds = backupPayload.data.purchaseOrders.map((p: any) => p.id);
      backupPayload.data.purchaseOrderLines = await prisma.purchaseOrderLine.findMany({ where: { purchaseOrderId: { in: poIds } } });
    }
    if (backupPayload.data.salesOrders.length > 0) {
      const soIds = backupPayload.data.salesOrders.map((p: any) => p.id);
      backupPayload.data.salesOrderLines = await prisma.salesOrderLine.findMany({ where: { salesOrderId: { in: soIds } } });
    }
    if (backupPayload.data.invoices.length > 0) {
      const invIds = backupPayload.data.invoices.map((p: any) => p.id);
      backupPayload.data.invoiceLines = await prisma.invoiceLine.findMany({ where: { invoiceId: { in: invIds } } });
    }
    if (backupPayload.data.journalEntries.length > 0) {
      const journalIds = backupPayload.data.journalEntries.map((p: any) => p.id);
      backupPayload.data.journalEntryLines = await prisma.journalEntryLine.findMany({ where: { journalEntryId: { in: journalIds } } });
    }
    if (backupPayload.data.grns.length > 0) {
      const grnIds = backupPayload.data.grns.map((p: any) => p.id);
      backupPayload.data.grnLines = await prisma.gRNLine.findMany({ where: { grnId: { in: grnIds } } });
    }
    if (backupPayload.data.dns.length > 0) {
      const dnIds = backupPayload.data.dns.map((p: any) => p.id);
      backupPayload.data.dnLines = await prisma.dNLine.findMany({ where: { dnId: { in: dnIds } } });
    }
    if (backupPayload.data.debitNotes.length > 0) {
      const dnIds = backupPayload.data.debitNotes.map((p: any) => p.id);
      backupPayload.data.debitNoteLines = await prisma.debitNoteLine.findMany({ where: { debitNoteId: { in: dnIds } } });
    }
    if (backupPayload.data.creditNotes.length > 0) {
      const cnIds = backupPayload.data.creditNotes.map((p: any) => p.id);
      backupPayload.data.creditNoteLines = await prisma.creditNoteLine.findMany({ where: { creditNoteId: { in: cnIds } } });
    }
    if (backupPayload.data.payrollRuns.length > 0) {
      const runIds = backupPayload.data.payrollRuns.map((p: any) => p.id);
      backupPayload.data.payrollPayslips = await prisma.payrollPayslip.findMany({ where: { payrollRunId: { in: runIds } } });
    }
    if (backupPayload.data.payments.length > 0) {
      const paymentIds = backupPayload.data.payments.map((p: any) => p.id);
      backupPayload.data.paymentPIs = await prisma.paymentPI.findMany({ where: { paymentId: { in: paymentIds } } });
      backupPayload.data.paymentInvoices = await prisma.paymentInvoice.findMany({ where: { paymentId: { in: paymentIds } } });
    }

    const jsonContent = JSON.stringify(backupPayload, null, 2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup-company-${companyId}-${timestamp}.json`;
    return { fileName, buffer: Buffer.from(jsonContent, 'utf8') };
  }

  async createBackup(request: FastifyRequest, reply: FastifyReply) {
    const { companyId } = request.query as { companyId?: string };
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (this.isServerless() && !companyId) {
      return reply.status(503).send({
        success: false,
        message: 'Full database backups (pg_dump) are not available in serverless mode. Use company-scoped backups or Neon built-in backups.',
      });
    }

    try {
      if (companyId) {
        const { fileName, buffer } = await this.createCompanyScopedBackup(companyId);
        const result = await saveFile(fileName, buffer, 'application/json');

        return reply.send({ 
          success: true, 
          data: { 
            fileName, 
            size: result.fileSize,
            timestamp: new Date().toISOString(),
            downloadUrl: result.url || `/api/admin/backups/download/${fileName}`,
            scope: 'COMPANY',
            companyId: companyId || null,
          } 
        });
      } else {
        await this.dumpDatabase(path.join(this.BACKUP_DIR, `backup-${timestamp}.sql`));
        const filePath = path.join(this.BACKUP_DIR, `backup-${timestamp}.sql`);
        const stats = fs.statSync(filePath);

        return reply.send({ 
          success: true, 
          data: { 
            fileName: `backup-${timestamp}.sql`, 
            size: stats.size,
            timestamp: new Date().toISOString(),
            downloadUrl: `/api/admin/backups/download/backup-${timestamp}.sql`,
            scope: 'SYSTEM',
            companyId: null,
          } 
        });
      }
    } catch (error: any) {
      console.error('Backup Error:', error);
      return reply.status(500).send({ success: false, message: 'Failed to create backup', error: error.message });
    }
  }

  async listBackups(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { list } = require('@vercel/blob');
      const { blobs } = await list({ prefix: 'backup-' });
      const files = blobs
        .filter(b => b.pathname.endsWith('.json'))
        .map(b => ({
          id: b.pathname,
          fileName: b.pathname,
          fileSize: b.size,
          size: b.size,
          downloadUrl: b.url,
          status: 'SUCCESS',
          triggeredBy: 'system',
          scope: 'COMPANY',
          createdAt: new Date(b.uploadedAt),
        }))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return reply.send({ success: true, data: files });
    } catch {
      if (!fs.existsSync(this.BACKUP_DIR)) return reply.send({ success: true, data: [] });
      const files = fs.readdirSync(this.BACKUP_DIR)
        .filter(f => f.endsWith('.json') || f.endsWith('.sql') || f.endsWith('.zip'))
        .map(f => {
          const stats = fs.statSync(path.join(this.BACKUP_DIR, f));
          return {
            id: f,
            fileName: f,
            fileSize: stats.size,
            size: stats.size,
            status: 'SUCCESS',
            triggeredBy: 'system',
            scope: f.endsWith('.json') ? 'COMPANY' : 'SYSTEM',
            createdAt: stats.birthtime
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return reply.send({ success: true, data: files });
    }
  }

  async restoreBackup(request: FastifyRequest, reply: FastifyReply) {
    const { fileName } = request.body as { fileName: string };

    if (!fileName.endsWith('.sql')) {
      return reply.status(400).send({ success: false, message: 'Only SQL backup files can be restored through this endpoint' });
    }

    if (this.isServerless()) {
      return reply.status(503).send({
        success: false,
        message: 'SQL restore via psql is not available in serverless mode. Use Neon Console for database restore.',
      });
    }

    const filePath = path.join(this.BACKUP_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ success: false, message: 'Backup file not found' });
    }

    const { user, password, host, port, database } = this.getDbConfig();
    const psqlBin = this.findPostgresBin('psql');

    try {
      const escapedPassword = process.platform === 'win32'
        ? password.replace(/"/g, '""')
        : password.replace(/'/g, "'\\''");

      const restoreCmd = process.platform === 'win32'
        ? `set "PGPASSWORD=${escapedPassword}" && "${psqlBin}" -U ${user} -h ${host} -p ${port} -d ${database} -f "${filePath}"`
        : `PGPASSWORD='${escapedPassword}' "${psqlBin}" -U ${user} -h ${host} -p ${port} -d ${database} -f "${filePath}"`;

      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execPromise = promisify(exec);
      await execPromise(restoreCmd);

      await this.createAuditLog(request, 'RESTORE_BACKUP', 'Backup', fileName, { fileName });

      return reply.send({ success: true, message: 'Database restored successfully' });
    } catch (error: any) {
      console.error('Restore Error:', error);
      return reply.status(500).send({ success: false, message: 'Restoration failed', error: error.message });
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
      return reply.status(404).send({ success: false, message: 'Backup file not found' });
    }

    const stream = fs.createReadStream(filePath);
    reply.header('Content-Type', 'application/octet-stream');
    reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
    return reply.send(stream);
  }
}
