"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemRoutes = void 0;
const backup_controller_1 = require("./backup.controller");
const auth_1 = require("../../middleware/auth");
const systemRoutes = async (fastify) => {
    const controller = new backup_controller_1.BackupController();
    // Require authentication for all system routes
    fastify.addHook('preHandler', auth_1.authenticate);
    fastify.post('/backup', controller.createBackup.bind(controller));
    fastify.get('/backups', controller.listBackups.bind(controller));
    fastify.get('/backups/download/:fileName', controller.downloadBackup.bind(controller));
};
exports.systemRoutes = systemRoutes;
//# sourceMappingURL=system.routes.js.map