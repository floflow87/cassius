import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Use Supabase in production, Replit DB in development
const isProduction = process.env.NODE_ENV === "production";
let databaseUrl = isProduction 
  ? process.env.SUPABASE_DATABASE_URL 
  : process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    isProduction 
      ? "SUPABASE_DATABASE_URL must be set for production."
      : "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use Neon's connection pooler for better connection handling
// This is recommended by Replit for their PostgreSQL databases
if (!isProduction && databaseUrl.includes('.us-east-2')) {
  databaseUrl = databaseUrl.replace('.us-east-2', '-pooler.us-east-2');
  console.log('Using Neon connection pooler');
}

// Configure pool with robust settings for Replit PostgreSQL
export const pool = new Pool({ 
  connectionString: databaseUrl,
  connectionTimeoutMillis: 60000, // 60s to allow for DB wake-up
  idleTimeoutMillis: 300000, // 5 minutes idle before releasing
  max: 10,
  keepAlive: true,
  keepAliveInitialDelayMillis: 0,
});

// Handle pool errors to prevent crashes
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
});

// Warm up the connection pool on startup
async function warmUpPool() {
  const maxRetries = 3;
  const baseDelay = 2000;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log('Database connection established successfully');
      return;
    } catch (err) {
      console.warn(`Database connection attempt ${attempt}/${maxRetries} failed:`, err instanceof Error ? err.message : err);
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  console.error('Failed to establish initial database connection after all retries');
}

// Start warm-up (non-blocking)
warmUpPool().catch(console.error);

export const db = drizzle(pool, { schema });
