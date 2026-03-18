"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const multipart_1 = __importDefault(require("@fastify/multipart"));
const static_1 = __importDefault(require("@fastify/static"));
const path_1 = require("path");
const auth_routes_1 = require("./modules/auth/auth.routes");
const admin_routes_1 = require("./modules/admin/admin.routes");
const owner_routes_1 = require("./modules/owner/owner.routes");
const company_routes_1 = require("./modules/company/company.routes");
const system_routes_1 = require("./modules/system/system.routes");
const backup_controller_1 = require("./modules/backup/backup.controller");
const errorHandler_1 = require("./middleware/errorHandler");
const offlineCheck_1 = require("./middleware/offlineCheck");
const fastify = (0, fastify_1.default)({
    logger: true,
});
// Register plugins
fastify.register(cors_1.default, {
    origin: true,
    credentials: true,
});
fastify.register(jwt_1.default, {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
});
fastify.register(multipart_1.default, {
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
});
fastify.register(static_1.default, {
    root: (0, path_1.join)(__dirname, '../uploads'),
    prefix: '/uploads/',
});
// Register offline check hook
fastify.addHook('preHandler', offlineCheck_1.offlineCheck);
// Error handler
fastify.setErrorHandler(errorHandler_1.errorHandler);
// Health check
fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
});
// Register routes
fastify.register(auth_routes_1.authRoutes, { prefix: '/api/auth' });
fastify.register(admin_routes_1.adminRoutes, { prefix: '/api/admin' });
fastify.register(owner_routes_1.ownerRoutes, { prefix: '/api/owner' });
fastify.register(company_routes_1.companyRoutes, { prefix: '/api/company' });
fastify.register(system_routes_1.systemRoutes, { prefix: '/api/system' });
// Start server
const start = async () => {
    try {
        // For Passenger/cPanel: PORT might be a Unix socket path or a dynamic port
        const rawPort = process.env.PORT || '5002';
        const port = isNaN(Number(rawPort)) ? rawPort : parseInt(rawPort, 10);
        await fastify.listen({
            port: port,
            host: typeof port === 'number' ? '0.0.0.0' : undefined
        });
        console.log(`Server running on ${typeof port === 'number' ? `http://localhost:${port}` : `socket ${port}`}`);
        // --- Automated Backup Cron (Daily at 2 AM) ---
        const backupController = new backup_controller_1.BackupController();
        setInterval(async () => {
            const now = new Date();
            // Check every hour, if hour is 2 and minute is 0-59 (runs once in this hour)
            // Note: In production use node-cron for precision, but this works for basic requirement.
            if (now.getHours() === 2) {
                console.log('[Automated Backup] Triggering 2AM backup...');
                try {
                    // Internal call simulation
                    await backupController.generateBackup({ user: { id: 'system' } }, {
                        send: (data) => console.log('[Automated Backup] Result:', data),
                        status: (code) => ({ send: (data) => console.log(`[Automated Backup] Status ${code}:`, data) })
                    });
                }
                catch (err) {
                    console.error('[Automated Backup] Error:', err);
                }
            }
        }, 3600000); // Check once an hour
    }
    catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};
start();
//# sourceMappingURL=index.js.map