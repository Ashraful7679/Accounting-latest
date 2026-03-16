"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYSTEM_MODE = void 0;
exports.checkDatabase = checkDatabase;
const database_1 = __importDefault(require("../config/database"));
exports.SYSTEM_MODE = "LIVE";
let lastCheck = 0;
const CHECK_INTERVAL = 10000; // 10 seconds
async function checkDatabase() {
    const now = Date.now();
    if (now - lastCheck < CHECK_INTERVAL)
        return exports.SYSTEM_MODE === "LIVE";
    lastCheck = now;
    const start = Date.now();
    try {
        // Force a small raw query with a 2-second timeout to verify actual DB connectivity
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Prisma connection timeout')), 2000));
        await Promise.race([
            database_1.default.$queryRaw `SELECT 1`,
            timeoutPromise
        ]);
        if (exports.SYSTEM_MODE === "OFFLINE") {
            console.log(`[${new Date().toISOString()}] --- DATABASE RECONNECTED: SWITCHING TO LIVE MODE (Check took ${Date.now() - start}ms) ---`);
        }
        exports.SYSTEM_MODE = "LIVE";
        return true;
    }
    catch (error) {
        if (exports.SYSTEM_MODE === "LIVE") {
            console.warn(`[${new Date().toISOString()}] --- DATABASE DISCONNECTED: SWITCHING TO OFFLINE DEMO MODE (Reason: ${error instanceof Error ? error.message : 'Unknown'}, Check took ${Date.now() - start}ms) ---`);
        }
        exports.SYSTEM_MODE = "OFFLINE";
        return false;
    }
}
//# sourceMappingURL=systemMode.js.map