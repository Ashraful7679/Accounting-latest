"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.companyRoutes = void 0;
const company_controller_1 = require("./company.controller");
const dashboard_controller_1 = require("./dashboard.controller");
const lc_controller_1 = require("./lc.controller");
const loan_controller_1 = require("./loan.controller");
const report_controller_1 = require("./report.controller");
const dimension_controller_1 = require("./dimension.controller");
const attachment_controller_1 = require("./attachment.controller");
const notification_controller_1 = require("./notification.controller");
const reconcile_controller_1 = require("./reconcile.controller");
const payment_controller_1 = require("./payment.controller");
const pi_controller_1 = require("./pi.controller");
const product_controller_1 = require("./product.controller");
const backup_controller_1 = require("../backup/backup.controller");
const bills_controller_1 = require("./bills.controller");
// New Modular Controllers
const coa_controller_1 = require("./coa.controller");
const entity_controller_1 = require("./entity.controller");
const invoice_controller_1 = require("./invoice.controller");
const journal_controller_1 = require("./journal.controller");
const order_controller_1 = require("./order.controller");
const employee_controller_1 = require("./employee.controller");
const period_controller_1 = require("./period.controller");
const auth_1 = require("../../middleware/auth");
const companyRoutes = async (fastify) => {
    const controller = new company_controller_1.CompanyController();
    const dashboardController = new dashboard_controller_1.DashboardController();
    const lcController = new lc_controller_1.LCController();
    const loanController = new loan_controller_1.LoanController();
    const reportController = new report_controller_1.ReportController();
    const dimensionController = new dimension_controller_1.DimensionController();
    const attachmentController = new attachment_controller_1.AttachmentController();
    const notificationController = new notification_controller_1.NotificationController();
    const reconcileController = new reconcile_controller_1.ReconcileController();
    const paymentController = new payment_controller_1.PaymentController();
    const piController = new pi_controller_1.PIController();
    const productController = new product_controller_1.ProductController();
    const backupController = new backup_controller_1.BackupController();
    const billsController = new bills_controller_1.BillsController();
    // Instances of new modular controllers
    const coaController = new coa_controller_1.CoaController();
    const entityController = new entity_controller_1.EntityController();
    const invoiceController = new invoice_controller_1.InvoiceController();
    const journalController = new journal_controller_1.JournalController();
    const orderController = new order_controller_1.OrderController();
    const employeeController = new employee_controller_1.EmployeeController();
    const periodController = new period_controller_1.PeriodController();
    // All routes require authentication
    fastify.addHook('preHandler', auth_1.authenticate);
    // Dashboards
    fastify.get('/:id/dashboard-stats', dashboardController.getStats.bind(dashboardController));
    fastify.get('/:id/activities', dashboardController.getActivities.bind(dashboardController));
    // Notifications & Audit Trail
    fastify.post('/:id/notifications/generate', notificationController.generate.bind(notificationController));
    fastify.get('/:id/notifications', notificationController.list.bind(notificationController));
    fastify.patch('/:id/notifications/read-all', notificationController.markAllRead.bind(notificationController));
    fastify.patch('/notifications/:notifId/read', notificationController.markRead.bind(notificationController));
    fastify.delete('/notifications/:notifId', notificationController.delete.bind(notificationController));
    fastify.get('/:id/audit', notificationController.listActivities.bind(notificationController));
    // LC Management
    fastify.get('/:id/lcs', lcController.getLCs.bind(lcController));
    fastify.post('/:id/lcs', lcController.createLC.bind(lcController));
    fastify.put('/lcs/:lcId', lcController.updateLC.bind(lcController));
    fastify.delete('/lcs/:lcId', lcController.deleteLC.bind(lcController));
    fastify.post('/lcs/:lcId/approve', lcController.approveLC.bind(lcController));
    fastify.get('/lcs/:lcId/detail', lcController.getLCDetail.bind(lcController));
    // PI Management
    fastify.get('/lcs/:id/pis', piController.getPIs.bind(piController));
    fastify.post('/lcs/:id/pis', piController.createPI.bind(piController));
    fastify.put('/:id/pis/:piId', piController.updatePI.bind(piController));
    fastify.get('/:id/pis/:piId', piController.getPIDetail.bind(piController));
    fastify.get('/:id/pis', piController.getAllPIs.bind(piController));
    fastify.get('/:id/all-pis', piController.getAllPIs.bind(piController));
    fastify.delete('/:id/pis/:piId', piController.deletePI.bind(piController));
    // PI Status Workflow
    fastify.post('/:id/pis/:piId/verify', piController.verifyPI.bind(piController));
    fastify.post('/:id/pis/:piId/approve', piController.approvePI.bind(piController));
    fastify.post('/:id/pis/:piId/reject', piController.rejectPI.bind(piController));
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
    fastify.get('/:id/customers', entityController.getCustomers.bind(entityController));
    fastify.post('/:id/customers', entityController.createCustomer.bind(entityController));
    fastify.put('/:id/customers/:customerId', entityController.updateCustomer.bind(entityController));
    fastify.delete('/:id/customers/:customerId', entityController.deleteCustomer.bind(entityController));
    // Vendors
    fastify.get('/:id/vendors', entityController.getVendors.bind(entityController));
    fastify.post('/:id/vendors', entityController.createVendor.bind(entityController));
    fastify.put('/:id/vendors/:vendorId', entityController.updateVendor.bind(entityController));
    fastify.delete('/:id/vendors/:vendorId', entityController.deleteVendor.bind(entityController));
    // Purchase Orders
    fastify.get('/:id/purchase-orders', orderController.getPurchaseOrders.bind(orderController));
    fastify.post('/:id/purchase-orders', orderController.createPurchaseOrder.bind(orderController));
    fastify.put('/:id/purchase-orders/:poId', orderController.updatePurchaseOrder.bind(orderController));
    fastify.patch('/:id/purchase-orders/:poId/status', orderController.updatePurchaseOrderStatus.bind(orderController));
    fastify.delete('/:id/purchase-orders/:poId', orderController.deletePurchaseOrder.bind(orderController));
    // Accounts (COA)
    fastify.get('/:id/accounts', coaController.getAccounts.bind(coaController));
    fastify.post('/:id/accounts', coaController.createAccount.bind(coaController));
    fastify.put('/:id/accounts/:accountId', coaController.updateAccount.bind(coaController));
    fastify.get('/:id/account-types', coaController.getAccountTypes.bind(coaController));
    fastify.post('/:id/heal-balances', coaController.healBalances.bind(coaController));
    // Products
    fastify.get('/:id/products', productController.getProducts.bind(productController));
    fastify.post('/:id/products', productController.createProduct.bind(productController));
    fastify.get('/:id/products/:productId', productController.getProduct.bind(productController));
    fastify.put('/:id/products/:productId', productController.updateProduct.bind(productController));
    fastify.delete('/:id/products/:productId', productController.deleteProduct.bind(productController));
    // Employees
    fastify.get('/:id/employees', employeeController.getEmployees.bind(employeeController));
    fastify.post('/:id/employees', employeeController.createEmployee.bind(employeeController));
    fastify.put('/:id/employees/:employeeId', employeeController.updateEmployee.bind(employeeController));
    fastify.delete('/:id/employees/:employeeId', employeeController.deleteEmployee.bind(employeeController));
    fastify.post('/:id/employees/:employeeId/pay-salary', employeeController.paySalary.bind(employeeController));
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
    fastify.delete('/:id/invoices/:invoiceId', invoiceController.deleteInvoice.bind(invoiceController));
    fastify.post('/:id/invoices/:invoiceId/verify', invoiceController.verifyInvoice.bind(invoiceController));
    fastify.post('/:id/invoices/:invoiceId/approve', invoiceController.approveInvoice.bind(invoiceController));
    fastify.post('/:id/invoices/:invoiceId/submit', invoiceController.submitInvoice.bind(invoiceController));
    fastify.post('/:id/invoices/:invoiceId/reject', invoiceController.rejectInvoice.bind(invoiceController));
    fastify.post('/:id/invoices/:invoiceId/retrieve', invoiceController.retrieveInvoice.bind(invoiceController));
    // Journals
    fastify.get('/:id/journals', journalController.getJournals.bind(journalController));
    fastify.get('/:id/journals/:journalId', journalController.getJournal.bind(journalController));
    fastify.post('/:id/journals', journalController.createJournal.bind(journalController));
    fastify.put('/:id/journals/:journalId', journalController.updateJournal.bind(journalController));
    fastify.delete('/:id/journals/:journalId', journalController.deleteJournal.bind(journalController));
    fastify.post('/:id/journals/:journalId/verify', journalController.verifyJournal.bind(journalController));
    fastify.post('/:id/journals/:journalId/submit', journalController.submitJournal.bind(journalController));
    fastify.post('/:id/journals/:journalId/reject', journalController.rejectJournal.bind(journalController));
    fastify.post('/:id/journals/:journalId/retrieve', journalController.retrieveJournal.bind(journalController));
    fastify.post('/:id/journals/:journalId/approve', journalController.approveJournal.bind(journalController));
    // Payments
    fastify.get('/:id/payments', paymentController.listPayments.bind(paymentController));
    fastify.post('/:id/payments', paymentController.createPayment.bind(paymentController));
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
    // Dimensions
    fastify.get('/:id/branches', dimensionController.getBranches.bind(dimensionController));
    fastify.get('/:id/projects', dimensionController.getProjects.bind(dimensionController));
    fastify.post('/:id/projects', dimensionController.createProject.bind(dimensionController));
    fastify.get('/:id/cost-centers', dimensionController.getCostCenters.bind(dimensionController));
    fastify.post('/:id/cost-centers', dimensionController.createCostCenter.bind(dimensionController));
    // Attachments (New Secure System)
    fastify.post('/:id/attachments/upload', attachmentController.upload.bind(attachmentController));
    fastify.get('/:id/attachments/related/:type/:entityId', attachmentController.listByEntity.bind(attachmentController));
    fastify.get('/:id/attachments/secure/:attachmentId', attachmentController.getSecureFile.bind(attachmentController));
    fastify.delete('/:id/attachments/:attachmentId', attachmentController.deleteAttachment.bind(attachmentController));
    // Backup & Restore (System Wide / Multi-Company Context)
    fastify.post('/:id/backup/generate', backupController.generateBackup.bind(backupController));
    fastify.get('/:id/backups', backupController.getBackups.bind(backupController));
    fastify.get('/:id/backups/download/:fileName', backupController.downloadBackup.bind(backupController));
    fastify.post('/:id/backup/restore/:fileName', backupController.restoreBackup.bind(backupController));
    fastify.post('/:id/backup/restore/upload', backupController.uploadAndRestore.bind(backupController));
    // Company Settings & Period Closing
    fastify.get('/:id/settings', controller.getCompany.bind(controller)); // Use getCompany for general settings
    // Note: updateSettings should probably be in CompanyController if it's general company profile
    // For now I'll map them to the facade.
    fastify.post('/:id/close-period', periodController.closePeriod.bind(periodController));
    // Bills (Accounts Payable Documents)
    fastify.get('/:id/bills', billsController.getBills.bind(billsController));
    fastify.post('/:id/bills', billsController.createBill.bind(billsController));
    fastify.get('/:id/bills/:billId', billsController.getBill.bind(billsController));
    fastify.put('/:id/bills/:billId', billsController.updateBill.bind(billsController));
    fastify.delete('/:id/bills/:billId', billsController.deleteBill.bind(billsController));
    fastify.post('/:id/bills/:billId/approve', billsController.approveBill.bind(billsController));
};
exports.companyRoutes = companyRoutes;
//# sourceMappingURL=company.routes.js.map