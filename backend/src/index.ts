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

// --- STARTUP LOGGING ---
const startupLog = join(process.cwd(), 'startup.log');
fs.appendFileSync(startupLog, `[${new Date().toISOString()}] Backend Starting... CWD: ${process.cwd()}\n`);
fs.appendFileSync(startupLog, `[${new Date().toISOString()}] ENV: PORT=${process.env.PORT}, NODE_ENV=${process.env.NODE_ENV}\n`);

const fastify = Fastify({

  logger: true,
});

// Register plugins
const corsOrigins: (string | RegExp)[] = [/http:\/\/localhost:\d+/];
if (process.env.CORS_ORIGINS) {
  process.env.CORS_ORIGINS.split(',').map(o => o.trim()).forEach(o => corsOrigins.push(o));
} else {
  corsOrigins.push('https://hurainjannatoyshee.com', 'https://www.hurainjannatoyshee.com');
}
fastify.register(cors, {
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
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

    // For Passenger/cPanel: PORT might be a Unix socket path or a dynamic port
    const rawPort = process.env.PORT || '5002';
    const port = isNaN(Number(rawPort)) ? rawPort : parseInt(rawPort, 10);
    const host = '0.0.0.0';

    console.log(`Booting server... Attempting to listen on ${typeof port === 'number' ? `${host}:${port}` : `socket ${port}`}`);
    
    await fastify.listen({ 
      port: port as any, 
      host: typeof port === 'number' ? host : undefined 
    });
    
    console.log(`=========================================`);
    console.log(`🚀 Server ready at ${typeof port === 'number' ? `http://${host}:${port}` : `socket ${port}`}`);
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
