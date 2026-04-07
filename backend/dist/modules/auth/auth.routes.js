"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const auth_controller_1 = require("./auth.controller");
const authRoutes = async (fastify) => {
    const controller = new auth_controller_1.AuthController();
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
exports.authRoutes = authRoutes;
//# sourceMappingURL=auth.routes.js.map