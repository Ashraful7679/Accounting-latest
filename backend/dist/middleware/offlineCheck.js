"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.offlineCheck = void 0;
const systemMode_1 = require("../lib/systemMode");
const offlineCheck = async (request, reply) => {
    // Check database status on every request (auto-reconnect logic)
    await (0, systemMode_1.checkDatabase)();
    // Inject the system mode into the response headers so the frontend can detect it
    reply.header('X-System-Mode', systemMode_1.SYSTEM_MODE);
};
exports.offlineCheck = offlineCheck;
//# sourceMappingURL=offlineCheck.js.map