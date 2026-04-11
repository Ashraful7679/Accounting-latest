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
const fs_1 = __importDefault(require("fs"));
const auth_routes_1 = require("./modules/auth/auth.routes");
const admin_routes_1 = require("./modules/admin/admin.routes");
const owner_routes_1 = require("./modules/owner/owner.routes");
const company_routes_1 = require("./modules/company/company.routes");
const system_routes_1 = require("./modules/system/system.routes");
const backup_controller_1 = require("./modules/backup/backup.controller");
const errorHandler_1 = require("./middleware/errorHandler");
const offlineCheck_1 = require("./middleware/offlineCheck");
// --- STARTUP LOGGING ---
const startupLog = (0, path_1.join)(process.cwd(), 'startup.log');
fs_1.default.appendFileSync(startupLog, `[${new Date().toISOString()}] Backend Starting... CWD: ${process.cwd()}\n`);
fs_1.default.appendFileSync(startupLog, `[${new Date().toISOString()}] ENV: PORT=${process.env.PORT}, NODE_ENV=${process.env.NODE_ENV}\n`);
const fastify = (0, fastify_1.default)({
    logger: true,
});
// Register plugins
fastify.register(cors_1.default, {
    origin: [/http:\/\/localhost:\d+/, 'https://hurainjannatoyshee.com', 'https://www.hurainjannatoyshee.com'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
});
fastify.register(jwt_1.default, {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
});
// Ensure required directories path
const uploadsDir = (0, path_1.join)(__dirname, '../uploads');
fastify.register(multipart_1.default, {
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
});
fastify.register(static_1.default, {
    root: uploadsDir,
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
        // Ensure required directories exist (Moved inside start to prevent crash on read-only filesystems)
        const uploadsDir = (0, path_1.join)(__dirname, '../uploads');
        try {
            if (!fs_1.default.existsSync(uploadsDir)) {
                console.log(`Creating uploads directory at: ${uploadsDir}`);
                fs_1.default.mkdirSync(uploadsDir, { recursive: true });
            }
        }
        catch (dirErr) {
            console.warn('Warning: Could not create uploads directory. If this is a read-only environment (like Render without persistence), this is expected.', dirErr.message);
        }
        // For Passenger/cPanel: PORT might be a Unix socket path or a dynamic port
        const rawPort = process.env.PORT || '5002';
        const port = isNaN(Number(rawPort)) ? rawPort : parseInt(rawPort, 10);
        const host = '0.0.0.0';
        console.log(`Booting server... Attempting to listen on ${typeof port === 'number' ? `${host}:${port}` : `socket ${port}`}`);
        await fastify.listen({
            port: port,
            host: typeof port === 'number' ? host : undefined
        });
        console.log(`=========================================`);
        console.log(`🚀 Server ready at ${typeof port === 'number' ? `http://${host}:${port}` : `socket ${port}`}`);
        console.log(`=========================================`);
        // --- Automated Backup Cron (Daily at 2 AM) ---
        const backupController = new backup_controller_1.BackupController();
        setInterval(async () => {
            const now = new Date();
            if (now.getHours() === 2) {
                console.log('[Automated Backup] Triggering 2AM backup...');
                try {
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
        console.error('Fatal error during startup:', err);
        fastify.log.error(err);
        process.exit(1);
    }
};
start();
//# sourceMappingURL=index.js.map