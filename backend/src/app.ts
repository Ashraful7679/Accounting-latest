import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { authRoutes } from './modules/auth/auth.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { ownerRoutes } from './modules/owner/owner.routes';
import { companyRoutes, portalRoutes } from './modules/company/company.routes';
import { systemRoutes } from './modules/system/system.routes';
import { errorHandler } from './middleware/errorHandler';
import { offlineCheck } from './middleware/offlineCheck';

export function createApp() {
  const fastify = Fastify({ logger: true });

  const corsOrigins: (string | RegExp)[] = [
    /http:\/\/localhost:\d+/,
    /http:\/\/127.0.0.1:\d+/,
    'https://accabiz-frontend.onrender.com',
    'https://accabiz-backend.onrender.com',
    /\.onrender\.com$/,
    /\.netlify\.app$/,
    /\.vercel\.app$/,
  ];
  if (process.env.CORS_ORIGINS) {
    process.env.CORS_ORIGINS.split(',').map(o => o.trim()).forEach(o => corsOrigins.push(o));
  }

  fastify.register(cors, {
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    credentials: true,
    exposedHeaders: ['set-cookie', 'x-system-mode'],
    strictPreflight: false,
  });

  fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  });

  fastify.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  fastify.addHook('onRequest', async (request) => {
    const origin = request.headers.origin;
    if (origin) {
      request.log.info(`[CORS DEBUG] Incoming Origin: ${origin}`);
    }
  });

  fastify.addHook('preHandler', offlineCheck);
  fastify.setErrorHandler(errorHandler);

  fastify.get('/', async () => ({ status: 'ok' }));
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  fastify.register(authRoutes, { prefix: '/api/auth' });
  fastify.register(adminRoutes, { prefix: '/api/admin' });
  fastify.register(ownerRoutes, { prefix: '/api/owner' });
  fastify.register(portalRoutes, { prefix: '/api' });
  fastify.register(companyRoutes, { prefix: '/api/company' });
  fastify.register(systemRoutes, { prefix: '/api/system' });

  return fastify;
}
