import { FastifyInstance } from 'fastify';
import { CompanyController } from './company.controller';
import { DashboardController } from './dashboard.controller';
import { LCController } from './lc.controller';
import { LoanController } from './loan.controller';
import { ReportController } from './report.controller';
import { DimensionController } from './dimension.controller';
import { AttachmentController } from './attachment.controller';
import { NotificationController } from './notification.controller';
import { ReconcileController } from './reconcile.controller';
import { PaymentController } from './payment.controller';
import { BackupController } from '../backup/backup.controller';
import { authenticate } from '../../middleware/auth';

export const companyRoutes = async (fastify: FastifyInstance) => {
  const controller = new CompanyController();
  const dashboardController = new DashboardController();
  const lcController = new LCController();
  const loanController = new LoanController();
  const reportController = new ReportController();
  const dimensionController = new DimensionController();
  const attachmentController = new AttachmentController();
  const notificationController = new NotificationController();
  const reconcileController = new ReconcileController();
  const paymentController = new PaymentController();
  const backupController = new BackupController();

  // All routes require authentication
  fastify.addHook('preHandler', authenticate);

  // Dashboards
  fastify.get('/:id/dashboard-stats', dashboardController.getStats.bind(dashboardController));

  // Notifications
  fastify.post('/:id/notifications/generate', notificationController.generate.bind(notificationController));
  fastify.get('/:id/notifications', notificationController.list.bind(notificationController));
  fastify.patch('/:id/notifications/read-all', notificationController.markAllRead.bind(notificationController));
  fastify.patch('/notifications/:notifId/read', notificationController.markRead.bind(notificationController));
  fastify.delete('/notifications/:notifId', notificationController.delete.bind(notificationController));

  // LC Management
  fastify.get('/:id/lcs', lcController.getLCs.bind(lcController));
  fastify.post('/:id/lcs', lcController.createLC.bind(lcController));
  fastify.put('/lcs/:lcId', lcController.updateLC.bind(lcController));
  fastify.delete('/lcs/:lcId', lcController.deleteLC.bind(lcController));
  fastify.post('/lcs/:lcId/approve', lcController.approveLC.bind(lcController));

  // Loan Management
  fastify.get('/:id/loans', loanController.getLoans.bind(loanController));
  fastify.post('/:id/loans', loanController.createLoan.bind(loanController));
  fastify.put('/loans/:loanId', loanController.updateLoan.bind(loanController));
  fastify.delete('/loans/:loanId', loanController.deleteLoan.bind(loanController));

  // Bank Reconciliation
  fastify.get('/:id/bank/reconcile-lines', reconcileController.getReconcileLines.bind(reconcileController));
  fastify.post('/:id/bank/mark-reconciled', reconcileController.markAsReconciled.bind(reconcileController));

  // Get company info
  fastify.get('/:id', controller.getCompany.bind(controller));

  // Customers
  fastify.get('/:id/customers', controller.getCustomers.bind(controller));
  fastify.post('/:id/customers', controller.createCustomer.bind(controller));
  fastify.put('/:id/customers/:customerId', controller.updateCustomer.bind(controller));
  fastify.delete('/:id/customers/:customerId', controller.deleteCustomer.bind(controller));

  // Vendors
  fastify.get('/:id/vendors', controller.getVendors.bind(controller));
  fastify.post('/:id/vendors', controller.createVendor.bind(controller));
  fastify.put('/:id/vendors/:vendorId', controller.updateVendor.bind(controller));
  fastify.delete('/:id/vendors/:vendorId', controller.deleteVendor.bind(controller));

  // Accounts
  fastify.get('/:id/accounts', controller.getAccounts.bind(controller));
  fastify.post('/:id/accounts', controller.createAccount.bind(controller));
  fastify.put('/:id/accounts/:accountId', controller.updateAccount.bind(controller));
  fastify.get('/:id/account-types', controller.getAccountTypes.bind(controller));
  fastify.post('/:id/heal-balances', controller.healBalances.bind(controller));

  // Invoices
  fastify.get('/:id/invoices', controller.getInvoices.bind(controller));
  fastify.get('/:id/invoices/:invoiceId', controller.getInvoice.bind(controller));
  fastify.post('/:id/invoices', controller.createInvoice.bind(controller));
  fastify.put('/:id/invoices/:invoiceId', controller.updateInvoice.bind(controller));
  fastify.delete('/:id/invoices/:invoiceId', controller.deleteInvoice.bind(controller));
  fastify.post('/:id/invoices/:invoiceId/verify', controller.verifyInvoice.bind(controller));
  fastify.post('/:id/invoices/:invoiceId/reject', controller.rejectInvoice.bind(controller));
  fastify.post('/:id/invoices/:invoiceId/retrieve', controller.retrieveInvoice.bind(controller));
  fastify.post('/:id/invoices/:invoiceId/approve', controller.approveInvoice.bind(controller));

  // Journals
  fastify.get('/:id/journals', controller.getJournals.bind(controller));
  fastify.get('/:id/journals/:journalId', controller.getJournal.bind(controller));
  fastify.post('/:id/journals', controller.createJournal.bind(controller));
  fastify.put('/:id/journals/:journalId', controller.updateJournal.bind(controller));
  fastify.delete('/:id/journals/:journalId', controller.deleteJournal.bind(controller));
  fastify.post('/:id/journals/:journalId/verify', controller.verifyJournal.bind(controller));
  fastify.post('/:id/journals/:journalId/submit', controller.submitJournal.bind(controller));
  fastify.post('/:id/journals/:journalId/reject', controller.rejectJournal.bind(controller));
  fastify.post('/:id/journals/:journalId/retrieve', controller.retrieveJournal.bind(controller));
  fastify.post('/:id/journals/:journalId/approve', controller.approveJournal.bind(controller));

  // Payments
  fastify.get('/:id/payments', paymentController.listPayments.bind(paymentController));
  fastify.post('/:id/payments', paymentController.createPayment.bind(paymentController));

  // Reports
  fastify.get('/:id/reports/trial-balance', reportController.getTrialBalance.bind(reportController));
  fastify.get('/:id/reports/ledger', reportController.getLedger.bind(reportController));
  fastify.get('/:id/reports/profit-loss', reportController.getProfitLoss.bind(reportController));
  fastify.get('/:id/reports/aging', reportController.getAgingReport.bind(reportController));
  fastify.get('/:id/reports/receivables-search', reportController.searchReceivables.bind(reportController));
  fastify.get('/:id/reports/lc-liability', reportController.getLCLiability.bind(reportController));

  // Dimensions
  fastify.get('/:id/projects', dimensionController.getProjects.bind(dimensionController));
  fastify.post('/:id/projects', dimensionController.createProject.bind(dimensionController));
  fastify.get('/:id/cost-centers', dimensionController.getCostCenters.bind(dimensionController));
  fastify.post('/:id/cost-centers', dimensionController.createCostCenter.bind(dimensionController));

  // Attachments (New Secure System)
  fastify.post('/:id/attachments/upload', attachmentController.upload.bind(attachmentController));
  fastify.get('/attachments/secure/:id', attachmentController.getSecureFile.bind(attachmentController));
  fastify.get('/attachments/related/:type/:id', attachmentController.listByEntity.bind(attachmentController));
  fastify.delete('/attachments/:id', attachmentController.deleteAttachment.bind(attachmentController));

  // Backup & Restore (System Wide / Multi-Company Context)
  fastify.post('/:id/backup/generate', backupController.generateBackup.bind(backupController));
  fastify.get('/:id/backups', backupController.getBackups.bind(backupController));
  fastify.get('/:id/backups/download/:fileName', backupController.downloadBackup.bind(backupController));
  fastify.post('/:id/backup/restore/:fileName', backupController.restoreBackup.bind(backupController));
  fastify.post('/:id/backup/restore/upload', backupController.uploadAndRestore.bind(backupController));
};
