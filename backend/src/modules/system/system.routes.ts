import { FastifyInstance } from 'fastify';
import { BackupController } from './backup.controller';
import { HealthController } from './health.controller';
import { authenticate } from '../../middleware/auth';

export const systemRoutes = async (fastify: FastifyInstance) => {
  const controller = new BackupController();
  const healthController = new HealthController();

  // Require authentication for all system routes
  fastify.addHook('preHandler', authenticate);

  fastify.post('/backup', controller.createBackup.bind(controller));
  fastify.get('/backups', controller.listBackups.bind(controller));
  fastify.get('/backups/download/:fileName', controller.downloadBackup.bind(controller));

  // System Health
  fastify.get('/health/integrity', healthController.checkIntegrity.bind(healthController));
};
