import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { checkDatabase, SYSTEM_MODE } from '../lib/systemMode';

export const offlineCheck = async (request: FastifyRequest, reply: FastifyReply) => {
  // Check database status on every request (auto-reconnect logic)
  await checkDatabase();
  
  // Inject the system mode into the response headers so the frontend can detect it
  reply.header('X-System-Mode', SYSTEM_MODE);
};
