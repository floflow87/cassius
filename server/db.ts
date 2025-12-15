import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Use Supabase in production, Replit DB in development
const isProduction = process.env.NODE_ENV === "production";
const databaseUrl = isProduction 
  ? process.env.SUPABASE_DATABASE_URL 
  : process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    isProduction 
      ? "SUPABASE_DATABASE_URL must be set for production."
      : "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: databaseUrl,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10,
});
export const db = drizzle(pool, { schema });
