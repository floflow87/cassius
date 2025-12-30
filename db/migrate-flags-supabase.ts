import pg from "pg";

const { Pool } = pg;

const APP_ENV = process.env.APP_ENV || "development";
const isProduction = APP_ENV === "production";

let databaseUrl: string;

if (isProduction) {
  if (!process.env.SUPABASE_DB_URL_PROD) {
    console.error("SUPABASE_DB_URL_PROD is required for production");
    process.exit(1);
  }
  databaseUrl = process.env.SUPABASE_DB_URL_PROD;
} else {
  if (!process.env.SUPABASE_DB_URL_DEV) {
    console.error("SUPABASE_DB_URL_DEV is required for development");
    process.exit(1);
  }
  databaseUrl = process.env.SUPABASE_DB_URL_DEV;
}

try {
  const url = new URL(databaseUrl);
  console.log(`[Migration] Environment: ${APP_ENV}`);
  console.log(`[Migration] Target DB Host: ${url.hostname}`);
  console.log(`[Migration] Target DB Name: ${url.pathname.replace(/^\//, '') || 'postgres'}`);
} catch {
  console.log(`[Migration] Environment: ${APP_ENV}`);
}

const urlWithoutSslMode = databaseUrl.replace(/[?&]sslmode=[^&]*/g, '');

const pool = new Pool({
  connectionString: urlWithoutSslMode,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log("\n[Migration] Checking existing tables...");
    
    const tablesResult = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log("[Migration] Existing tables:", tablesResult.rows.map(r => r.table_name).join(", "));
    
    const flagsCheck = await client.query(`SELECT to_regclass('public.flags') as exists;`);
    const flagsExists = flagsCheck.rows[0].exists !== null;
    
    if (flagsExists) {
      console.log("\n[Migration] Table 'flags' already exists!");
      return;
    }
    
    console.log("\n[Migration] Creating flags table and enums...");
    
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE flag_level AS ENUM ('CRITICAL', 'WARNING', 'INFO');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE flag_entity_type AS ENUM ('PATIENT', 'OPERATION', 'IMPLANT');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE flag_type AS ENUM (
          'ISQ_LOW',
          'ISQ_DECLINING', 
          'LOW_SUCCESS_RATE',
          'NO_RECENT_ISQ',
          'NO_POSTOP_FOLLOWUP',
          'NO_RECENT_APPOINTMENT',
          'IMPLANT_NO_OPERATION',
          'MISSING_DOCUMENT',
          'INCOMPLETE_DATA'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS flags (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        organisation_id VARCHAR(36) NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
        level flag_level NOT NULL,
        type flag_type NOT NULL,
        label VARCHAR(255) NOT NULL,
        description TEXT,
        entity_type flag_entity_type NOT NULL,
        entity_id VARCHAR(36) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        resolved_at TIMESTAMP WITH TIME ZONE,
        resolved_by VARCHAR(36) REFERENCES users(id) ON DELETE SET NULL
      );
    `);
    
    await client.query(`CREATE INDEX IF NOT EXISTS idx_flags_org ON flags(organisation_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_flags_entity ON flags(entity_type, entity_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_flags_unresolved ON flags(organisation_id) WHERE resolved_at IS NULL;`);
    
    console.log("[Migration] Flags table created successfully!");
    
    const verifyResult = await client.query(`SELECT to_regclass('public.flags') as exists;`);
    console.log("[Migration] Verification:", verifyResult.rows[0].exists ? "flags table exists" : "FAILED");
    
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error("[Migration] Error:", err);
  process.exit(1);
});
