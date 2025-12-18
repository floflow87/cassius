import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import dns from "dns";

dns.setDefaultResultOrder('ipv4first');

const { Pool } = pg;

const APP_ENV = process.env.APP_ENV || "development";
const isProduction = APP_ENV === "production";

const DB_SSL = process.env.DB_SSL !== "false";
const DB_POOL_MAX = parseInt(process.env.DB_POOL_MAX || "5", 10);
const DB_CONN_TIMEOUT_MS = parseInt(process.env.DB_CONN_TIMEOUT_MS || "60000", 10);

let databaseUrl: string;

if (isProduction) {
  if (!process.env.SUPABASE_DB_URL_PROD) {
    throw new Error("SUPABASE_DB_URL_PROD is required in production");
  }
  databaseUrl = process.env.SUPABASE_DB_URL_PROD;
} else {
  if (!process.env.SUPABASE_DB_URL_DEV) {
    console.error("SUPABASE_DB_URL_DEV must be set for development.");
    process.exit(1);
  }
  databaseUrl = process.env.SUPABASE_DB_URL_DEV;
}

const urlWithoutSslMode = databaseUrl.replace(/[?&]sslmode=[^&]*/g, '');

const maskedUrl = databaseUrl.replace(/:[^:@]+@/, ':***@');
console.log(`[DB] Environment: ${APP_ENV}`);
console.log(`[DB] Connecting to: ${maskedUrl.split('?')[0].split('@')[1] || 'configured host'}`);

export const pool = new Pool({
  connectionString: urlWithoutSslMode,
  connectionTimeoutMillis: DB_CONN_TIMEOUT_MS,
  idleTimeoutMillis: 300000,
  max: DB_POOL_MAX,
  keepAlive: true,
  keepAliveInitialDelayMillis: 0,
  ssl: DB_SSL ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('[DB] Pool error on idle client:', err.message);
});

export async function testConnection(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return { 
      ok: false, 
      latencyMs: Date.now() - start, 
      error: err instanceof Error ? err.message : String(err) 
    };
  }
}

async function initializeDatabase() {
  console.log('[DB] Testing connection...');
  
  const result = await testConnection();
  
  if (result.ok) {
    console.log(`[DB] Connected successfully (latency: ${result.latencyMs}ms)`);
  } else {
    console.error(`[DB] Connection failed: ${result.error}`);
    console.error('[DB] Exiting due to database connection failure.');
    process.exit(1);
  }
}

initializeDatabase();

export const db = drizzle(pool, { schema });

export function getDbEnv() {
  return APP_ENV;
}

export function getDbConnectionInfo(): { dbHost: string; dbName: string } {
  try {
    const url = new URL(databaseUrl);
    return {
      dbHost: url.hostname,
      dbName: url.pathname.replace(/^\//, '') || 'postgres',
    };
  } catch {
    return {
      dbHost: 'unknown',
      dbName: 'unknown',
    };
  }
}
