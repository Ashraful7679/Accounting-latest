import { FastifyInstance } from 'fastify';
import { AuthController } from './auth.controller';

export const authRoutes = async (fastify: FastifyInstance) => {
  const controller = new AuthController();

  // Public routes
  fastify.post('/login', controller.login.bind(controller));
  fastify.post('/register', controller.register.bind(controller));

  // Protected routes
  fastify.register(async (protectedRoutes) => {
    protectedRoutes.addHook('preHandler', async (request, reply) => {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ success: false, error: { message: 'Unauthorized' } });
      }
    });

    protectedRoutes.get('/me', controller.getMe.bind(controller));
    protectedRoutes.put('/me', controller.updateMe.bind(controller));
    protectedRoutes.get('/roles', controller.getRoles.bind(controller));
    protectedRoutes.post('/logout', controller.logout.bind(controller));
  });
};
