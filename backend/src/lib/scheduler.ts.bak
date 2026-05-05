import cron from 'node-cron';
import prisma from '../config/database';

export class CronScheduler {
  private static jobs: Map<string, cron.ScheduledTask> = new Map();
  
  static start() {
    console.log('[CronScheduler] Starting background jobs...');
    
    // Overdue Invoice Reminders - Daily at 9 AM
    this.registerJob(
      'overdue-invoice-reminders',
      '0 9 * * *',
      this.processOverdueInvoiceReminders.bind(this)
    );
    
    // Recurring Invoice Generation - Daily at 1 AM
    this.registerJob(
      'recurring-invoices',
      '0 1 * * *',
      this.processRecurringInvoices.bind(this)
    );
    
    // Month-end Depreciation - 1st of month at 2 AM
    this.registerJob(
      'month-end-depreciation',
      '0 2 1 * *',
      this.processMonthEndDepreciation.bind(this)
    );
    
    // Cleanup old notifications - Weekly on Sundays at 3 AM
    this.registerJob(
      'cleanup-notifications',
      '0 3 * * 0',
      this.cleanupOldNotifications.bind(this)
    );
    
    console.log(`[CronScheduler] Started ${this.jobs.size} jobs`);
  }
  
  static stop() {
    console.log('[CronScheduler] Stopping all jobs...');
    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`[CronScheduler] Stopped: ${name}`);
    }
    this.jobs.clear();
  }
  
  private static registerJob(name: string, cronExpr: string, handler: () => Promise<void>) {
    if (!cron.validate(cronExpr)) {
      console.error(`[CronScheduler] Invalid cron expression for ${name}: ${cronExpr}`);
      return;
    }
    
    const job = cron.schedule(cronExpr, async () => {
      console.log(`[CronScheduler] Running: ${name}`);
      try {
        await handler();
        console.log(`[CronScheduler] Completed: ${name}`);
      } catch (error) {
        console.error(`[CronScheduler] Error in ${name}:`, error);
      }
    });
    
    this.jobs.set(name, job);
  }
  
  // ============================================
  // JOB: Overdue Invoice Reminders
  // ============================================
  private static async processOverdueInvoiceReminders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find all companies with invoice reminder settings
    const companies = await prisma.company.findMany({
      where: {
        settings: { path: ['invoiceReminders'], equals: true }
      },
      select: { id: true, name: true }
    });
    
    for (const company of companies) {
      try {
        await this.sendOverdueReminders(company.id, company.name, today);
      } catch (error) {
        console.error(`[CronScheduler] Error processing reminders for ${company.name}:`, error);
      }
    }
  }
  
  private static async sendOverdueReminders(companyId: string, companyName: string, today: Date) {
    // Find invoices overdue by 1, 7, 14, 30 days
    const overdueDays = [1, 7, 14, 30];
    
    for (const days of overdueDays) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() - days);
      targetDate.setHours(23, 59, 59, 999);
      
      const startDate = new Date(targetDate);
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      
      // Find invoices that became N days overdue (within the target window)
      const invoices = await prisma.invoice.findMany({
        where: {
          companyId,
          status: { in: ['OPEN', 'PENDING_PAYMENT'] },
          dueDate: {
            gte: startDate,
            lte: targetDate
          }
        },
        include: {
          customer: { select: { id: true, name: true, email: true } }
        }
      });
      
      for (const invoice of invoices) {
        // Check if we already sent a reminder for this milestone
        const existingNotification = await prisma.notification.findFirst({
          where: {
            companyId,
            entityType: 'InvoiceReminder',
            entityId: invoice.id,
            data: { path: ['days'], equals: days }
          }
        });
        
        if (!existingNotification && invoice.customer) {
          // Create reminder notification
          await prisma.notification.create({
            data: {
              companyId,
              userId: invoice.createdById,
              type: 'INVOICE Reminder',
              title: `Invoice Overdue - ${invoice.invoiceNumber}`,
              message: `Invoice ${invoice.invoiceNumber} for ${invoice.customer.name} is ${days} days overdue. Amount: ${invoice.totalBDT}`,
              entityType: 'Invoice',
              entityId: invoice.id,
              data: { days }
            }
          });
          
          // Send email reminder if customer has email
          if (invoice.customer.email) {
            await this.sendReminderEmail(invoice, days);
          }
        }
      }
    }
  }
  
  private static async sendReminderEmail(invoice: any, daysOverdue: number) {
    // Placeholder for email sending logic
    // In production, integrate with your email service (SendGrid, AWS SES, etc.)
    console.log(`[CronScheduler] Sending ${daysOverdue}-day overdue reminder for invoice ${invoice.invoiceNumber} to ${invoice.customer.email}`);
  }
  
  // ============================================
  // JOB: Recurring Invoices
  // ============================================
  private static async processRecurringInvoices() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find all recurring invoices due for generation
    const recurringInvoices = await prisma.recurringInvoice.findMany({
      where: {
        isActive: true,
        nextRunDate: { lte: today }
      },
      include: {
        customer: true,
        company: { select: { id: true, name: true } }
      }
    });
    
    for (const recurring of recurringInvoices) {
      try {
        await this.generateRecurringInvoice(recurring);
        
        // Update next run date
        const nextDate = this.calculateNextRunDate(recurring.nextRunDate, recurring.frequency);
        await prisma.recurringInvoice.update({
          where: { id: recurring.id },
          data: { 
            nextRunDate: nextDate,
            lastRunDate: new Date()
          }
        });
      } catch (error) {
        console.error(`[CronScheduler] Error generating recurring invoice ${recurring.id}:`, error);
      }
    }
  }
  
  private static calculateNextRunDate(currentDate: Date, frequency: string): Date {
    const next = new Date(currentDate);
    
    switch (frequency) {
      case 'DAILY':
        next.setDate(next.getDate() + 1);
        break;
      case 'WEEKLY':
        next.setDate(next.getDate() + 7);
        break;
      case 'BIWEEKLY':
        next.setDate(next.getDate() + 14);
        break;
      case 'MONTHLY':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'QUARTERLY':
        next.setMonth(next.getMonth() + 3);
        break;
      case 'YEARLY':
        next.setFullYear(next.getFullYear() + 1);
        break;
      default:
        next.setMonth(next.getMonth() + 1);
    }
    
    return next;
  }
  
  private static async generateRecurringInvoice(recurring: any) {
    const company = recurring.company;
    const customer = recurring.customer;
    
    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber(company.id, 'INV');
    
    // Calculate due date
    const invoiceDate = new Date();
    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + (recurring.paymentTerms || 30));
    
    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        companyId: company.id,
        customerId: customer.id,
        currency: customer.currency || 'BDT',
        exchangeRate: 1,
        invoiceDate: invoiceDate,
        dueDate: dueDate,
        status: 'PENDING_VERIFICATION',
        totalBDT: recurring.amount,
        totalForeign: recurring.amount,
        lines: {
          create: [{
            productId: recurring.productId,
            description: recurring.description || `Recurring invoice - ${recurring.frequency}`,
            quantity: 1,
            unitPrice: recurring.amount,
            taxRate: recurring.taxRate || 0,
            taxAmount: (recurring.amount * (recurring.taxRate || 0)) / 100,
            amount: recurring.amount
          }]
        }
      },
      include: { lines: true }
    });
    
    // Create notification for createdBy
    if (recurring.createdById) {
      await prisma.notification.create({
        data: {
          companyId: company.id,
          userId: recurring.createdById,
          type: 'RECURRING Invoice',
          title: `Recurring Invoice Generated - ${invoiceNumber}`,
          message: `Auto-generated invoice for ${customer.name}. Amount: ${recurring.amount}`,
          entityType: 'Invoice',
          entityId: invoice.id
        }
      });
    }
    
    console.log(`[CronScheduler] Generated recurring invoice ${invoiceNumber} for ${customer.name}`);
  }
  
  private static async generateInvoiceNumber(companyId: string, prefix: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.invoice.count({
      where: { companyId, invoiceNumber: { startsWith: `${prefix}-${year}` } }
    });
    
    return `${prefix}-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  
  // ============================================
  // JOB: Month-end Depreciation
  // ============================================
  private static async processMonthEndDepreciation() {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const periodStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
    const periodEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
    
    // Find all companies
    const companies = await prisma.company.findMany({
      select: { id: true, name: true }
    });
    
    for (const company of companies) {
      try {
        await this.runDepreciation(company.id, company.name, periodStart, periodEnd);
      } catch (error) {
        console.error(`[CronScheduler] Error running depreciation for ${company.name}:`, error);
      }
    }
  }
  
  private static async runDepreciation(companyId: string, companyName: string, periodStart: Date, periodEnd: Date) {
    // Find all active fixed assets that need depreciation
    const assets = await prisma.fixedAsset.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        depreciationStartDate: { lte: periodEnd },
        isDepreciated: false
      }
    });
    
    for (const asset of assets) {
      try {
        const depreciation = this.calculateDepreciation(asset);
        
        if (depreciation <= 0) continue;
        
        // Create depreciation journal entry
        const entryNumber = await this.generateJournalNumber(companyId, 'DEPR');
        
        await prisma.journalEntry.create({
          data: {
            entryNumber,
            companyId,
            date: periodEnd,
            description: `Depreciation - ${asset.assetName} (${periodEnd.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })})`,
            totalDebit: depreciation,
            totalCredit: depreciation,
            status: 'POSTED',
            createdById: 'SYSTEM',
            lines: {
              create: [
                {
                  accountId: asset.depreciationAccountId,
                  description: `Depreciation expense - ${asset.assetName}`,
                  debit: depreciation
                },
                {
                  accountId: asset.accumulatedDepreciationAccountId,
                  description: `Accumulated depreciation - ${asset.assetName}`,
                  credit: depreciation
                }
              ]
            }
          }
        });
        
        // Update asset with new accumulated depreciation
        const newAccumulated = (asset.accumulatedDepreciation || 0) + depreciation;
        await prisma.fixedAsset.update({
          where: { id: asset.id },
          data: {
            accumulatedDepreciation: newAccumulated,
            lastDepreciationDate: periodEnd,
            currentValue: asset.purchaseValue - newAccumulated
          }
        });
        
        console.log(`[CronScheduler] Depreciation ${depreciation} posted for ${asset.assetName} (${companyName})`);
      } catch (error) {
        console.error(`[CronScheduler] Error depreciating asset ${asset.assetName}:`, error);
      }
    }
  }
  
  private static calculateDepreciation(asset: any): number {
    const today = new Date();
    const startDate = new Date(asset.depreciationStartDate);
    
    // Calculate months since start
    let months = (today.getFullYear() - startDate.getFullYear()) * 12 + 
                 (today.getMonth() - startDate.getMonth());
    
    if (months <= 0) return 0;
    
    let annualDepreciation: number;
    
    switch (asset.depreciationMethod) {
      case 'STRAIGHT_LINE':
        const usefulLife = asset.usefulLife || 5;
        annualDepreciation = asset.purchaseValue / usefulLife;
        break;
      case 'DECLINING_BALANCE':
        const rate = asset.depreciationRate || 0.2;
        const currentValue = asset.purchaseValue - (asset.accumulatedDepreciation || 0);
        annualDepreciation = currentValue * rate;
        break;
      case 'SUM_OF_YEARS':
        const remainingLife = asset.usefulLife - Math.floor((asset.accumulatedDepreciation || 0) / (asset.purchaseValue / asset.usefulLife));
        const sumOfYears = (asset.usefulLife * (asset.usefulLife + 1)) / 2;
        annualDepreciation = (asset.purchaseValue * remainingLife) / sumOfYears;
        break;
      default:
        annualDepreciation = asset.purchaseValue / (asset.usefulLife || 5);
    }
    
    return annualDepreciation / 12; // Monthly depreciation
  }
  
  private static async generateJournalNumber(companyId: string, prefix: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.journalEntry.count({
      where: { companyId, entryNumber: { startsWith: `${prefix}-${year}` } }
    });
    
    return `${prefix}-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  
  // ============================================
  // JOB: Cleanup Old Notifications
  // ============================================
  private static async cleanupOldNotifications() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90); // Keep 90 days
    
    const result = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        isRead: true
      }
    });
    
    console.log(`[CronScheduler] Cleaned up ${result.count} old notifications`);
  }
}