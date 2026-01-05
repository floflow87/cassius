import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
import * as schema from "@shared/schema";
import { getDbUrl, isProd, isDev } from "./env";
import { logger } from "./logger";

const { Pool } = pkg;

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let poolInstance: pkg.Pool | null = null;

export function getDb() {
  if (dbInstance) {
    return dbInstance;
  }
  
  const dbUrl = getDbUrl();
  const envLabel = isProd() ? "production" : isDev() ? "development" : "test";
  
  logger.info(`[DB] Initializing database connection`, { environment: envLabel });
  
  poolInstance = new Pool({
    connectionString: dbUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
  
  poolInstance.on("error", (err) => {
    logger.error("[DB] Unexpected pool error", { error: err.message });
  });
  
  dbInstance = drizzle(poolInstance, { schema });
  
  return dbInstance;
}

export function getPool(): pkg.Pool {
  if (!poolInstance) {
    getDb();
  }
  return poolInstance!;
}

export async function testConnection(): Promise<boolean> {
  try {
    const pool = getPool();
    const start = Date.now();
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    const latency = Date.now() - start;
    logger.info(`[DB] Connection test successful`, { latencyMs: latency });
    return true;
  } catch (error) {
    logger.error("[DB] Connection test failed", { error: (error as Error).message });
    return false;
  }
}

export async function closeDb(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
    dbInstance = null;
    logger.info("[DB] Connection pool closed");
  }
}

export { schema };
export type Database = ReturnType<typeof getDb>;
