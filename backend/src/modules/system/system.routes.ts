import { FastifyInstance } from 'fastify';
import { BackupController } from './backup.controller';
import { authenticate } from '../../middleware/auth';

export const systemRoutes = async (fastify: FastifyInstance) => {
  const controller = new BackupController();

  // Require authentication for all system routes
  fastify.addHook('preHandler', authenticate);

  fastify.post('/backup', controller.createBackup.bind(controller));
  fastify.get('/backups', controller.listBackups.bind(controller));
  fastify.get('/backups/download/:fileName', controller.downloadBackup.bind(controller));
};
