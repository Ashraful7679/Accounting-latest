import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { checkDatabase, SYSTEM_MODE } from '../lib/systemMode';

export const offlineCheck = async (request: FastifyRequest, reply: FastifyReply) => {
  // Skip DB check for health route to avoid circular hangs or blocking health checks
  if (request.url === '/health' || request.url.endsWith('/health')) {
    reply.header('X-System-Mode', SYSTEM_MODE);
    return;
  }

  // Check database status on every request (auto-reconnect logic)
  await checkDatabase();
  
  // Inject the system mode into the response headers so the frontend can detect it
  reply.header('X-System-Mode', SYSTEM_MODE);
};
