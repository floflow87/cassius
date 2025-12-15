import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Use Supabase for both production and development
// DEV_DATABASE_URL = Supabase dev database
// SUPABASE_DATABASE_URL = Supabase production database
const isProduction = process.env.NODE_ENV === "production";
const databaseUrl = isProduction 
  ? process.env.SUPABASE_DATABASE_URL 
  : process.env.DEV_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    isProduction 
      ? "SUPABASE_DATABASE_URL must be set for production."
      : "DEV_DATABASE_URL must be set for development. Add your Supabase dev database connection string.",
  );
}

console.log(`Using ${isProduction ? 'production' : 'development'} Supabase database`);

// Configure pool with robust settings for Supabase PostgreSQL
export const pool = new Pool({ 
  connectionString: databaseUrl,
  connectionTimeoutMillis: 30000, // 30s timeout
  idleTimeoutMillis: 300000, // 5 minutes idle before releasing
  max: 10,
  keepAlive: true,
  keepAliveInitialDelayMillis: 0,
  ssl: {
    rejectUnauthorized: false, // Required for Supabase connections
  },
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
