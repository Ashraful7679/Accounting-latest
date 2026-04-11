"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRoutes = void 0;
const admin_controller_1 = require("./admin.controller");
const backup_controller_1 = require("./backup.controller");
const auth_1 = require("../../middleware/auth");
const adminRoutes = async (fastify) => {
    const controller = new admin_controller_1.AdminController();
    const backupController = new backup_controller_1.BackupController();
    // All routes require authentication
    fastify.addHook('preHandler', auth_1.authenticate);
    fastify.addHook('preHandler', auth_1.requireAdmin);
    // Companies
    fastify.get('/companies', controller.getCompanies.bind(controller));
    fastify.post('/companies', controller.createCompany.bind(controller));
    fastify.put('/companies/:id', controller.updateCompany.bind(controller));
    fastify.delete('/companies/:id', controller.deleteCompany.bind(controller));
    fastify.put('/companies/:id/status', controller.toggleCompanyStatus.bind(controller));
    // Owners
    fastify.get('/owners', controller.getOwners.bind(controller));
    fastify.post('/owners', controller.createOwner.bind(controller));
    fastify.delete('/owners/:id', controller.deleteOwner.bind(controller));
    fastify.post('/owners/:id/reset-password', controller.resetOwnerPassword.bind(controller));
    // Backups
    fastify.get('/backups', backupController.listBackups.bind(backupController));
    fastify.post('/backups', backupController.createBackup.bind(backupController));
    fastify.get('/backups/download/:fileName', backupController.downloadBackup.bind(backupController));
    fastify.post('/backups/restore', backupController.restoreBackup.bind(backupController));
};
exports.adminRoutes = adminRoutes;
//# sourceMappingURL=admin.routes.js.map