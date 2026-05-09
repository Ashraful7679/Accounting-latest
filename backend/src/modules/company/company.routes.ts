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
import { PIController } from './pi.controller';
import { ProductController } from './product.controller';
import { ProductPricingController } from './product-pricing.controller';
import { DocumentFlowController } from './document-flow.controller';
import { ReportDrilldownController } from './report-drilldown.controller';
import { PortalController } from './portal.controller';
import { BackupController } from '../backup/backup.controller';
import { BillsController } from './bills.controller';

// New Modular Controllers
import { CoaController } from './coa.controller';
import { EntityController } from './entity.controller';
import { InvoiceController } from './invoice.controller';
import { JournalController } from './journal.controller';
import { OrderController } from './order.controller';
import { EmployeeController } from './employee.controller';
import { PeriodController } from './period.controller';
import { DebitNoteController } from './debit-note.controller';
import { CreditNoteController } from './credit-note.controller';
import { BankReconciliationController } from './bank-reconciliation.controller';
import { FixedAssetController } from './fixed-asset.controller';
import { ExchangeRateController } from './exchange-rate.controller';
import { PayrollController } from './payroll.controller';
import { RBACController } from './rbac.controller';

import { authenticate } from '../../middleware/auth';

export const companyRoutes = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', authenticate);

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
  const piController = new PIController();
  const productController = new ProductController();
  const documentFlowController = new DocumentFlowController();
  const reportDrilldownController = new ReportDrilldownController();
  const portalController = new PortalController();
  const backupController = new BackupController();
  const billsController = new BillsController();
  const coaController = new CoaController();
  const entityController = new EntityController();
  const invoiceController = new InvoiceController();
  const journalController = new JournalController();
  const orderController = new OrderController();
  const employeeController = new EmployeeController();
  const periodController = new PeriodController();
  const debitNoteController = new DebitNoteController();
  const creditNoteController = new CreditNoteController();
  const bankReconciliationController = new BankReconciliationController();
  const fixedAssetController = new FixedAssetController();
  const exchangeRateController = new ExchangeRateController();
  const payrollController = new PayrollController();
  const rbacController = new RBACController();

  // Products
  fastify.get('/:id/products', productController.getProducts.bind(productController));
  fastify.post('/:id/products', productController.createProduct.bind(productController));
  fastify.get('/:id/products/:productId', productController.getProduct.bind(productController));
  fastify.put('/:id/products/:productId', productController.updateProduct.bind(productController));
  fastify.post('/:id/products/:productId/adjust-stock', productController.adjustStock.bind(productController));
  fastify.delete('/:id/products/:productId', productController.deleteProduct.bind(productController));

  // Fixed Assets
  fastify.get('/:id/fixed-assets', FixedAssetController.getAssets);
  fastify.post('/:id/fixed-assets', FixedAssetController.createAsset);
  fastify.get('/:id/fixed-assets/:assetId', FixedAssetController.getAsset);
  fastify.put('/:id/fixed-assets/:assetId', FixedAssetController.updateAsset);
  fastify.delete('/:id/fixed-assets/:assetId', FixedAssetController.deleteAsset);
  fastify.post('/:id/fixed-assets/run-depreciation', FixedAssetController.runDepreciation);
  fastify.post('/:id/fixed-assets/:assetId/dispose', FixedAssetController.dispose);

  // Product Pricing
  fastify.get('/:id/products/pricing', ProductPricingController.calculateAverageCost.bind(ProductPricingController));
  fastify.get('/:id/products/:productId/cost', ProductPricingController.getProductCost.bind(ProductPricingController));
  fastify.put('/:id/products/:productId/minimum-margin', ProductPricingController.updateMinimumMargin.bind(ProductPricingController));

  // Document Flow
  fastify.get('/:id/document-flow/sales/:entityType/:entityId', DocumentFlowController.getSalesFlow.bind(DocumentFlowController));
  fastify.get('/:id/document-flow/purchase/:entityType/:entityId', DocumentFlowController.getPurchaseFlow.bind(DocumentFlowController));

  // Chart of Accounts
  fastify.get('/:id/accounts', coaController.getAccounts.bind(coaController));
  fastify.post('/:id/accounts', coaController.createAccount.bind(coaController));
  fastify.put('/:id/accounts/:accountId', coaController.updateAccount.bind(coaController));
  fastify.get('/:id/account-types', coaController.getAccountTypes.bind(coaController));
  fastify.post('/:id/heal-balances', coaController.healBalances.bind(coaController));

  // Customers (CRUD)
  fastify.get('/:id/customers', entityController.getCustomers.bind(entityController));
  fastify.post('/:id/customers', entityController.createCustomer.bind(entityController));
  fastify.put('/:id/customers/:customerId', entityController.updateCustomer.bind(entityController));
  fastify.delete('/:id/customers/:customerId', entityController.deleteCustomer.bind(entityController));

  // Vendors (CRUD)
  fastify.get('/:id/vendors', entityController.getVendors.bind(entityController));
  fastify.post('/:id/vendors', entityController.createVendor.bind(entityController));
  fastify.put('/:id/vendors/:vendorId', entityController.updateVendor.bind(entityController));
  fastify.delete('/:id/vendors/:vendorId', entityController.deleteVendor.bind(entityController));

  // Dashboard Stats
  fastify.get('/:id/dashboard-stats', dashboardController.getStats.bind(dashboardController));

  // Report Drilldown
  fastify.get('/:id/reports/account-transactions', ReportDrilldownController.getAccountTransactions.bind(ReportDrilldownController));
  fastify.get('/:id/reports/trial-balance-detail', ReportDrilldownController.getTrialBalanceDrilldown.bind(ReportDrilldownController));

  // Customer/Vendor Portal Management
  fastify.post('/:id/customers/:customerId/enable-portal', PortalController.enableCustomerPortal.bind(PortalController));
  fastify.post('/:id/vendors/:vendorId/enable-portal', PortalController.enableVendorPortal.bind(PortalController));
  fastify.post('/:id/portal/:type/:id/disable', PortalController.disablePortal.bind(PortalController));

  // Public Portal Routes (no auth required)
  fastify.get('/portal/:companyId/customer/:token', PortalController.getCustomerPortalData.bind(PortalController));
  fastify.get('/portal/:companyId/vendor/:token', PortalController.getVendorPortalData.bind(PortalController));

  // Staff / Employees
  fastify.get('/:id/staff', employeeController.getEmployees.bind(employeeController));
  fastify.post('/:id/staff', employeeController.createEmployee.bind(employeeController));
  fastify.get('/:id/staff/:employeeId', employeeController.getEmployeeDetail.bind(employeeController));
  fastify.put('/:id/staff/:employeeId', employeeController.updateEmployee.bind(employeeController));
  fastify.delete('/:id/staff/:employeeId', employeeController.deleteEmployee.bind(employeeController));
  fastify.post('/:id/staff/:employeeId/pay-salary', employeeController.paySalary.bind(employeeController));

  // Employee Advances
  fastify.get('/:id/employee-advances', employeeController.getEmployeeAdvances.bind(employeeController));
  fastify.post('/:id/employee-advances', employeeController.createEmployeeAdvance.bind(employeeController));
  fastify.put('/:id/employee-advances/:advanceId', employeeController.updateEmployeeAdvance.bind(employeeController));
  fastify.delete('/:id/employee-advances/:advanceId', employeeController.deleteEmployeeAdvance.bind(employeeController));
  fastify.post('/:id/employee-advances/:advanceId/verify', employeeController.verifyEmployeeAdvance.bind(employeeController));
  fastify.post('/:id/employee-advances/:advanceId/approve', employeeController.approveEmployeeAdvance.bind(employeeController));

  // Employee Loans
  fastify.get('/:id/employee-loans', employeeController.getEmployeeLoans.bind(employeeController));
  fastify.post('/:id/employee-loans', employeeController.createEmployeeLoan.bind(employeeController));
  fastify.put('/:id/employee-loans/:loanId', employeeController.updateEmployeeLoan.bind(employeeController));
  fastify.delete('/:id/employee-loans/:loanId', employeeController.deleteEmployeeLoan.bind(employeeController));
  fastify.post('/:id/employee-loans/:loanId/verify', employeeController.verifyEmployeeLoan.bind(employeeController));
  fastify.post('/:id/employee-loans/:loanId/approve', employeeController.approveEmployeeLoan.bind(employeeController));
  fastify.get('/:id/employee-loans/:loanId/repayments', employeeController.getLoanRepayments.bind(employeeController));
  fastify.post('/:id/employee-loans/:loanId/repayments', employeeController.createLoanRepayment.bind(employeeController));
  fastify.post('/:id/employee-loan-repayments/:repaymentId/verify', employeeController.verifyLoanRepayment.bind(employeeController));
  fastify.post('/:id/employee-loan-repayments/:repaymentId/approve', employeeController.approveLoanRepayment.bind(employeeController));

  // Employee Expenses
  fastify.get('/:id/employee-expenses', employeeController.getEmployeeExpenses.bind(employeeController));
  fastify.post('/:id/employee-expenses', employeeController.createEmployeeExpense.bind(employeeController));
  fastify.put('/:id/employee-expenses/:expenseId', employeeController.updateEmployeeExpense.bind(employeeController));
  fastify.delete('/:id/employee-expenses/:expenseId', employeeController.deleteEmployeeExpense.bind(employeeController));
  fastify.post('/:id/employee-expenses/:expenseId/verify', employeeController.verifyEmployeeExpense.bind(employeeController));
  fastify.post('/:id/employee-expenses/:expenseId/approve', employeeController.approveEmployeeExpense.bind(employeeController));

  // Invoices
  fastify.get('/:id/invoices', invoiceController.getInvoices.bind(invoiceController));
  fastify.get('/:id/invoices/:invoiceId', invoiceController.getInvoice.bind(invoiceController));
  fastify.post('/:id/invoices', invoiceController.createInvoice.bind(invoiceController));
  fastify.put('/:id/invoices/:invoiceId', invoiceController.updateInvoice.bind(invoiceController));
  fastify.patch('/:id/invoices/:invoiceId', invoiceController.updateInvoice.bind(invoiceController));
  fastify.post('/:id/invoices/:invoiceId/delink-dn', invoiceController.delinkDN.bind(invoiceController));
  fastify.post('/:id/invoices/:invoiceId/delink-grn', invoiceController.delinkGRN.bind(invoiceController));
  fastify.delete('/:id/invoices/:invoiceId', invoiceController.deleteInvoice.bind(invoiceController));
  fastify.post('/:id/invoices/:invoiceId/reverse', invoiceController.deleteInvoice.bind(invoiceController));
  fastify.post('/:id/invoices/:invoiceId/verify', invoiceController.verifyInvoice.bind(invoiceController));
  fastify.post('/:id/invoices/:invoiceId/approve', invoiceController.approveInvoice.bind(invoiceController));
  fastify.post('/:id/invoices/:invoiceId/submit', invoiceController.submitInvoice.bind(invoiceController));
  fastify.post('/:id/invoices/:invoiceId/reject', invoiceController.rejectInvoice.bind(invoiceController));
  fastify.post('/:id/invoices/:invoiceId/retrieve', invoiceController.retrieveInvoice.bind(invoiceController));
  fastify.post('/:id/invoices/:invoiceId/revert-approval', (req, rep) => invoiceController.revertInvoice(req, rep));

  // Delivery Challans (DN) & GRN deletion
  fastify.delete('/:id/challans/:dnId', orderController.deleteDeliveryChallan.bind(orderController));
  fastify.delete('/:id/grns/:grnId', orderController.deleteGRN.bind(orderController));

  // Journals
  fastify.get('/:id/journals', journalController.getJournals.bind(journalController));
  fastify.get('/:id/journals/:journalId', journalController.getJournal.bind(journalController));
  fastify.post('/:id/journals', journalController.createJournal.bind(journalController));
  fastify.put('/:id/journals/:journalId', journalController.updateJournal.bind(journalController));
  fastify.delete('/:id/journals/:journalId', journalController.deleteJournal.bind(journalController));
  fastify.post('/:id/journals/:journalId/reverse', journalController.deleteJournal.bind(journalController));
  fastify.post('/:id/journals/:journalId/verify', journalController.verifyJournal.bind(journalController));
  fastify.post('/:id/journals/:journalId/submit', journalController.submitJournal.bind(journalController));
  fastify.post('/:id/journals/:journalId/reject', journalController.rejectJournal.bind(journalController));
  fastify.post('/:id/journals/:journalId/retrieve', journalController.retrieveJournal.bind(journalController));
  fastify.post('/:id/journals/:journalId/approve', journalController.approveJournal.bind(journalController));

  // Payments
  fastify.get('/:id/payments', paymentController.listPayments.bind(paymentController));
  fastify.post('/:id/payments', paymentController.createPayment.bind(paymentController));
  fastify.post('/:id/payments/make', paymentController.createPayment.bind(paymentController));
  fastify.post('/:id/payments/receive', paymentController.createPayment.bind(paymentController));
  fastify.post('/:id/payments/allocate', paymentController.allocatePayment.bind(paymentController));
  fastify.post('/:id/payments/transfer', paymentController.createTransfer.bind(paymentController));
  fastify.post('/:id/payments/:paymentId/verify', paymentController.verifyTransfer.bind(paymentController));
  fastify.post('/:id/payments/:paymentId/approve', paymentController.approveTransfer.bind(paymentController));

  // Reports
  fastify.get('/:id/reports/trial-balance', reportController.getTrialBalance.bind(reportController));
  fastify.get('/:id/reports/ledger', reportController.getLedger.bind(reportController));
  fastify.get('/:id/reports/profit-loss', reportController.getProfitLoss.bind(reportController));
  fastify.get('/:id/reports/balance-sheet', reportController.getBalanceSheet.bind(reportController));
  fastify.get('/:id/reports/aging', reportController.getAgingReport.bind(reportController));
  fastify.get('/:id/reports/receivables-search', reportController.searchReceivables.bind(reportController));
  fastify.get('/:id/reports/lc-liability', reportController.getLCLiability.bind(reportController));
  fastify.get('/:id/reports/cash-flow', reportController.getCashFlowStatement.bind(reportController));
  fastify.get('/:id/reports/customer-statement/:customerId', reportController.getCustomerStatement.bind(reportController));

  // LC (Letters of Credit)
  fastify.get('/:id/lcs', lcController.getLCs.bind(lcController));
  fastify.get('/:id/lcs/:lcId', lcController.getLCDetail.bind(lcController));
  fastify.post('/:id/lcs', lcController.createLC.bind(lcController));

  // PI (Proforma Invoices)
  fastify.get('/:id/pis', piController.getAllPIs.bind(piController));
  fastify.get('/:id/pis/:piId', piController.getPIDetail.bind(piController));
  fastify.post('/:id/pis', piController.createPI.bind(piController));

  // Dimensions
  fastify.get('/:id/projects', dimensionController.getProjects.bind(dimensionController));
  fastify.post('/:id/projects', dimensionController.createProject.bind(dimensionController));
  fastify.get('/:id/cost-centers', dimensionController.getCostCenters.bind(dimensionController));
  fastify.post('/:id/cost-centers', dimensionController.createCostCenter.bind(dimensionController));

  // Attachments
  fastify.post('/:id/attachments/upload', attachmentController.upload.bind(attachmentController));
  fastify.get('/:id/attachments/related/:type/:entityId', attachmentController.listByEntity.bind(attachmentController));
  fastify.get('/:id/attachments/secure/:attachmentId', attachmentController.getSecureFile.bind(attachmentController));
  fastify.delete('/:id/attachments/:attachmentId', attachmentController.deleteAttachment.bind(attachmentController));

  // Backup & Restore
  fastify.post('/:id/backup/generate', backupController.generateBackup.bind(backupController));
  fastify.get('/:id/backups', backupController.getBackups.bind(backupController));
  fastify.get('/:id/backups/download/:fileName', backupController.downloadBackup.bind(backupController));
  fastify.post('/:id/backup/restore/:fileName', backupController.restoreBackup.bind(backupController));
  fastify.post('/:id/backup/restore/upload', backupController.uploadAndRestore.bind(backupController));

  // Company Details & Settings
  fastify.get('/:id', controller.getCompany.bind(controller));
  fastify.get('/:id/settings', controller.getCompany.bind(controller));
  fastify.post('/:id/close-period', periodController.closePeriod.bind(periodController));

  // Bills (Accounts Payable Documents)
  fastify.get('/:id/bills', billsController.getBills.bind(billsController));
  fastify.post('/:id/bills', billsController.createBill.bind(billsController));
  fastify.get('/:id/bills/:billId', billsController.getBill.bind(billsController));
  fastify.put('/:id/bills/:billId', billsController.updateBill.bind(billsController));
  fastify.delete('/:id/bills/:billId', billsController.deleteBill.bind(billsController));
  fastify.post('/:id/bills/:billId/approve', billsController.approveBill.bind(billsController));

  // Role-Based Access Control (RBAC)
  fastify.get('/:id/roles', rbacController.getRoles.bind(rbacController));
  fastify.get('/:id/roles/:roleId', rbacController.getRole.bind(rbacController));
  fastify.post('/:id/roles', rbacController.createRole.bind(rbacController));
  fastify.put('/:id/roles/:roleId', rbacController.updateRole.bind(rbacController));
  fastify.delete('/:id/roles/:roleId', rbacController.deleteRole.bind(rbacController));
  fastify.put('/:id/roles/:roleId/permissions', rbacController.updatePermission.bind(rbacController));
  fastify.post('/:id/roles/:roleId/assign', rbacController.assignRoleToUser.bind(rbacController));
  fastify.delete('/:id/roles/:roleId/assign/:userId', rbacController.removeRoleFromUser.bind(rbacController));
};
