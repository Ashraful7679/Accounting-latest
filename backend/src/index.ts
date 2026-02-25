import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { join } from 'path';
import { authRoutes } from './modules/auth/auth.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { ownerRoutes } from './modules/owner/owner.routes';
import { companyRoutes } from './modules/company/company.routes';
import { systemRoutes } from './modules/system/system.routes';
import { BackupController } from './modules/backup/backup.controller';
import { errorHandler } from './middleware/errorHandler';
import { offlineCheck } from './middleware/offlineCheck';

const fastify = Fastify({
  logger: true,
});

// Register plugins
fastify.register(cors, {
  origin: true,
  credentials: true,
});

fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
});

fastify.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

fastify.register(fastifyStatic, {
  root: join(__dirname, '../uploads'),
  prefix: '/uploads/',
});

// Register offline check hook
fastify.addHook('preHandler', offlineCheck);

// Error handler
fastify.setErrorHandler(errorHandler);

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register routes
fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(adminRoutes, { prefix: '/api/admin' });
fastify.register(ownerRoutes, { prefix: '/api/owner' });
fastify.register(companyRoutes, { prefix: '/api/company' });
fastify.register(systemRoutes, { prefix: '/api/system' });

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '5002', 10);
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server running on http://localhost:${port}`);

    // --- Automated Backup Cron (Daily at 2 AM) ---
    const backupController = new BackupController();
    setInterval(async () => {
      const now = new Date();
      // Check every hour, if hour is 2 and minute is 0-59 (runs once in this hour)
      // Note: In production use node-cron for precision, but this works for basic requirement.
      if (now.getHours() === 2) {
        console.log('[Automated Backup] Triggering 2AM backup...');
        try {
          // Internal call simulation
          await backupController.generateBackup({ user: { id: 'system' } } as any, { 
            send: (data: any) => console.log('[Automated Backup] Result:', data),
            status: (code: number) => ({ send: (data: any) => console.log(`[Automated Backup] Status ${code}:`, data) })
          } as any);
        } catch (err) {
          console.error('[Automated Backup] Error:', err);
        }
      }
    }, 3600000); // Check once an hour

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
