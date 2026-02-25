import prisma from '../config/database';

export let SYSTEM_MODE: "LIVE" | "OFFLINE" = "LIVE";

let lastCheck = 0;
const CHECK_INTERVAL = 10000; // 10 seconds

export async function checkDatabase() {
  const now = Date.now();
  if (now - lastCheck < CHECK_INTERVAL) return SYSTEM_MODE === "LIVE";
  
  lastCheck = now;
  const start = Date.now();
  try {
    // Force a small raw query with a 2-second timeout to verify actual DB connectivity
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Prisma connection timeout')), 2000)
    );
    
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      timeoutPromise
    ]);
    
    if (SYSTEM_MODE === "OFFLINE") {
      console.log(`[${new Date().toISOString()}] --- DATABASE RECONNECTED: SWITCHING TO LIVE MODE (Check took ${Date.now() - start}ms) ---`);
    }
    
    SYSTEM_MODE = "LIVE";
    return true;
  } catch (error) {
    if (SYSTEM_MODE === "LIVE") {
      console.warn(`[${new Date().toISOString()}] --- DATABASE DISCONNECTED: SWITCHING TO OFFLINE DEMO MODE (Reason: ${error instanceof Error ? error.message : 'Unknown'}, Check took ${Date.now() - start}ms) ---`);
    }
    SYSTEM_MODE = "OFFLINE";
    return false;
  }
}
