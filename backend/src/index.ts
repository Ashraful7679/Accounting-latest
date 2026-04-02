import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { join } from 'path';
import fs from 'fs';
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

// Ensure required directories path
const uploadsDir = join(__dirname, '../uploads');

fastify.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

fastify.register(fastifyStatic, {
  root: uploadsDir,
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
    // Ensure required directories exist (Moved inside start to prevent crash on read-only filesystems)
    const uploadsDir = join(__dirname, '../uploads');
    try {
      if (!fs.existsSync(uploadsDir)) {
        console.log(`Creating uploads directory at: ${uploadsDir}`);
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
    } catch (dirErr: any) {
      console.warn('Warning: Could not create uploads directory. If this is a read-only environment (like Render without persistence), this is expected.', dirErr.message);
    }

    const port = parseInt(process.env.PORT || '5002', 10);
    const host = '0.0.0.0';

    console.log(`Booting server... Attempting to listen on ${host}:${port}`);
    
    await fastify.listen({ port, host });
    
    console.log(`=========================================`);
    console.log(`🚀 Server ready at http://${host}:${port}`);
    console.log(`=========================================`);

    // --- Automated Backup Cron (Daily at 2 AM) ---
    const backupController = new BackupController();
    setInterval(async () => {
      const now = new Date();
      if (now.getHours() === 2) {
        console.log('[Automated Backup] Triggering 2AM backup...');
        try {
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
    console.error('Fatal error during startup:', err);
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
