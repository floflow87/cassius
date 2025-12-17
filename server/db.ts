import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import dns from "dns";

dns.setDefaultResultOrder('ipv4first');

const { Pool } = pg;

const APP_ENV = process.env.APP_ENV || "development";

const DB_SSL = process.env.DB_SSL !== "false";
const DB_POOL_MAX = parseInt(process.env.DB_POOL_MAX || "5", 10);
const DB_CONN_TIMEOUT_MS = parseInt(process.env.DB_CONN_TIMEOUT_MS || "60000", 10);

// Use generic DATABASE_URL - value differs per environment (Replit DEV vs Render PROD)
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("[DB] ERROR: DATABASE_URL environment variable is required");
  console.error("[DB] Set DATABASE_URL to your Supabase connection string (pooler, port 6543)");
  process.exit(1);
}

const urlWithoutSslMode = databaseUrl.replace(/[?&]sslmode=[^&]*/g, '');

// Extract host for logging (non-sensitive)
let dbHost = "unknown";
try {
  const url = new URL(databaseUrl);
  dbHost = url.hostname;
} catch {
  dbHost = "invalid-url";
}

console.log(`[DB] Environment: ${APP_ENV}`);
console.log(`[DB] Connected to: ${dbHost}`);

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
    const url = new URL(databaseUrl!);
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
