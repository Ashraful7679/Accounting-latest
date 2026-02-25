import { FastifyInstance } from 'fastify';
import { AdminController } from './admin.controller';
import { BackupController } from './backup.controller';
import { authenticate, requireAdmin } from '../../middleware/auth';

export const adminRoutes = async (fastify: FastifyInstance) => {
  const controller = new AdminController();
  const backupController = new BackupController();

  // All routes require authentication
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireAdmin);

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
  fastify.post('/backups/restore', backupController.restoreBackup.bind(backupController));
};
