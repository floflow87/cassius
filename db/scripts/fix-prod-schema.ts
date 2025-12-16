/**
 * Fix Production Schema Script
 * 
 * Creates missing tables and adds organisation_id to existing users table
 * Usage: APP_ENV=production CONFIRM_PROD_SCHEMA_APPLY=true npx tsx db/scripts/fix-prod-schema.ts
 */

import pg from "pg";
import dns from "dns";

dns.setDefaultResultOrder('ipv4first');

const { Pool } = pg;

const APP_ENV = process.env.APP_ENV || "development";
const isProduction = APP_ENV === "production";

if (isProduction && process.env.CONFIRM_PROD_SCHEMA_APPLY !== 'true') {
  console.error('ERREUR: Pour appliquer en production, definir CONFIRM_PROD_SCHEMA_APPLY=true');
  process.exit(1);
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  CASSIUS PROD SCHEMA FIX - ${APP_ENV.toUpperCase()}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  const databaseUrl = isProduction 
    ? process.env.SUPABASE_DB_URL_PROD 
    : process.env.SUPABASE_DB_URL_DEV;
    
  if (!databaseUrl) {
    console.error(`❌ ${isProduction ? 'SUPABASE_DB_URL_PROD' : 'SUPABASE_DB_URL_DEV'} is not set`);
    process.exit(1);
  }

  const urlWithoutSslMode = databaseUrl.replace(/[?&]sslmode=[^&]*/g, '');
  const pool = new Pool({
    connectionString: urlWithoutSslMode,
    connectionTimeoutMillis: 30000,
    max: 2,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    // Step 1: Create enums if missing
    console.log("📦 Creating enums...");
    const enums = [
      "CREATE TYPE IF NOT EXISTS sexe AS ENUM ('HOMME', 'FEMME')",
      "CREATE TYPE IF NOT EXISTS type_intervention AS ENUM ('POSE_IMPLANT', 'GREFFE_OSSEUSE', 'SINUS_LIFT', 'EXTRACTION_IMPLANT_IMMEDIATE', 'REPRISE_IMPLANT', 'CHIRURGIE_GUIDEE')",
      "CREATE TYPE IF NOT EXISTS type_chirurgie_temps AS ENUM ('UN_TEMPS', 'DEUX_TEMPS')",
      "CREATE TYPE IF NOT EXISTS type_chirurgie_approche AS ENUM ('LAMBEAU', 'FLAPLESS')",
      "CREATE TYPE IF NOT EXISTS type_mise_en_charge AS ENUM ('IMMEDIATE', 'PRECOCE', 'DIFFEREE')",
      "CREATE TYPE IF NOT EXISTS position_implant AS ENUM ('CRESTAL', 'SOUS_CRESTAL', 'SUPRA_CRESTAL')",
      "CREATE TYPE IF NOT EXISTS type_os AS ENUM ('D1', 'D2', 'D3', 'D4')",
      "CREATE TYPE IF NOT EXISTS statut_implant AS ENUM ('EN_SUIVI', 'SUCCES', 'COMPLICATION', 'ECHEC')",
      "CREATE TYPE IF NOT EXISTS type_radio AS ENUM ('PANORAMIQUE', 'CBCT', 'RETROALVEOLAIRE')",
      "CREATE TYPE IF NOT EXISTS type_prothese AS ENUM ('VISSEE', 'SCELLEE')",
      "CREATE TYPE IF NOT EXISTS type_pilier AS ENUM ('DROIT', 'ANGULE', 'MULTI_UNIT')",
    ];

    for (const enumSql of enums) {
      try {
        // PostgreSQL doesn't have CREATE TYPE IF NOT EXISTS, use DO block
        const typeName = enumSql.match(/CREATE TYPE (?:IF NOT EXISTS )?(\w+)/)?.[1];
        const enumValues = enumSql.match(/ENUM \(([^)]+)\)/)?.[1];
        if (typeName && enumValues) {
          await client.query(`
            DO $$ BEGIN
              CREATE TYPE ${typeName} AS ENUM (${enumValues});
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
          `);
        }
      } catch (e: any) {
        // Ignore duplicate type errors
      }
    }
    console.log("   ✅ Enums ready\n");

    // Step 2: Create role enum
    console.log("📦 Creating role enum...");
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE role AS ENUM ('CHIRURGIEN', 'ASSISTANT', 'ADMIN');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log("   ✅ Role enum ready\n");

    // Step 3: Create organisations table
    console.log("📦 Creating organisations table...");
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
      
      CREATE TABLE IF NOT EXISTS organisations (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        nom TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log("   ✅ Organisations table created\n");

    // Step 4: Insert default organisation
    console.log("🏢 Inserting default organisation...");
    const orgCheck = await client.query(
      "SELECT id FROM organisations WHERE id = $1",
      ["default-org-001"]
    );
    if (orgCheck.rows.length === 0) {
      await client.query(
        "INSERT INTO organisations (id, nom) VALUES ($1, $2)",
        ["default-org-001", "Cabinet par defaut"]
      );
      console.log("   ✅ default-org-001 created\n");
    } else {
      console.log("   ℹ️  default-org-001 already exists\n");
    }

    // Step 5: Check if users table exists and has correct structure
    console.log("📋 Checking users table...");
    const usersCols = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
    `);
    const colNames = usersCols.rows.map((r: any) => r.column_name);
    
    // If the users table has Supabase Auth columns, we need to drop it and recreate
    if (colNames.includes('instance_id') || colNames.includes('encrypted_password')) {
      console.log("   ⚠️  Supabase Auth users table detected");
      console.log("   ⚠️  Dropping and recreating with Cassius schema...");
      
      await client.query(`DROP TABLE IF EXISTS users CASCADE`);
      await client.query(`
        CREATE TABLE users (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
          organisation_id VARCHAR REFERENCES organisations(id) ON DELETE CASCADE,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role role NOT NULL DEFAULT 'ASSISTANT',
          nom TEXT,
          prenom TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_users_organisation ON users(organisation_id);
      `);
      console.log("   ✅ Users table recreated with Cassius schema\n");
    } else if (!colNames.includes('organisation_id') && colNames.length > 0) {
      // Add missing column
      console.log("   Adding organisation_id column...");
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS organisation_id VARCHAR REFERENCES organisations(id)`);
      console.log("   ✅ organisation_id column added\n");
    } else if (colNames.length === 0) {
      // Create the table
      await client.query(`
        CREATE TABLE users (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
          organisation_id VARCHAR REFERENCES organisations(id) ON DELETE CASCADE,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role role NOT NULL DEFAULT 'ASSISTANT',
          nom TEXT,
          prenom TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_users_organisation ON users(organisation_id);
      `);
      console.log("   ✅ Users table created\n");
    } else {
      console.log("   ✅ Users table structure OK\n");
    }

    // Step 6: Create other tables
    console.log("📦 Creating remaining tables...");
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        organisation_id VARCHAR NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
        nom TEXT NOT NULL,
        prenom TEXT NOT NULL,
        date_naissance DATE NOT NULL,
        sexe sexe NOT NULL,
        telephone TEXT,
        email TEXT,
        contexte_medical TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_patients_organisation ON patients(organisation_id);
      CREATE INDEX IF NOT EXISTS idx_patients_nom ON patients(nom);
    `);
    console.log("   ✅ patients");

    await client.query(`
      CREATE TABLE IF NOT EXISTS operations (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        organisation_id VARCHAR NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
        patient_id VARCHAR NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        date_operation DATE NOT NULL,
        type_intervention type_intervention NOT NULL,
        type_chirurgie_temps type_chirurgie_temps,
        type_chirurgie_approche type_chirurgie_approche,
        greffe_osseuse BOOLEAN DEFAULT FALSE,
        type_greffe TEXT,
        greffe_quantite TEXT,
        greffe_localisation TEXT,
        type_mise_en_charge type_mise_en_charge,
        conditions_medicales_preop TEXT,
        notes_perop TEXT,
        observations_postop TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_operations_patient ON operations(patient_id);
      CREATE INDEX IF NOT EXISTS idx_operations_organisation ON operations(organisation_id);
    `);
    console.log("   ✅ operations");

    await client.query(`
      CREATE TABLE IF NOT EXISTS implants (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        organisation_id VARCHAR NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
        operation_id VARCHAR NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
        patient_id VARCHAR NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        marque TEXT NOT NULL,
        reference_fabricant TEXT,
        diametre REAL NOT NULL,
        longueur REAL NOT NULL,
        site_fdi TEXT NOT NULL,
        position_implant position_implant,
        type_os type_os,
        mise_en_charge_prevue type_mise_en_charge,
        isq_pose REAL,
        isq_2m REAL,
        isq_3m REAL,
        isq_6m REAL,
        statut statut_implant NOT NULL DEFAULT 'EN_SUIVI',
        date_pose DATE NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_implants_patient ON implants(patient_id);
      CREATE INDEX IF NOT EXISTS idx_implants_organisation ON implants(organisation_id);
      CREATE INDEX IF NOT EXISTS idx_implants_operation ON implants(operation_id);
    `);
    console.log("   ✅ implants");

    await client.query(`
      CREATE TABLE IF NOT EXISTS radios (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        organisation_id VARCHAR NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
        patient_id VARCHAR NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        operation_id VARCHAR REFERENCES operations(id) ON DELETE SET NULL,
        implant_id VARCHAR REFERENCES implants(id) ON DELETE SET NULL,
        type type_radio NOT NULL,
        url TEXT NOT NULL,
        date DATE NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_radios_patient ON radios(patient_id);
    `);
    console.log("   ✅ radios");

    await client.query(`
      CREATE TABLE IF NOT EXISTS visites (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        organisation_id VARCHAR NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
        implant_id VARCHAR NOT NULL REFERENCES implants(id) ON DELETE CASCADE,
        patient_id VARCHAR NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        isq REAL,
        notes TEXT,
        radio_id VARCHAR REFERENCES radios(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_visites_implant ON visites(implant_id);
    `);
    console.log("   ✅ visites");

    await client.query(`
      CREATE TABLE IF NOT EXISTS protheses (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        organisation_id VARCHAR NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
        implant_id VARCHAR NOT NULL REFERENCES implants(id) ON DELETE CASCADE,
        prothese_unitaire BOOLEAN NOT NULL DEFAULT TRUE,
        type_prothese type_prothese NOT NULL,
        type_pilier type_pilier,
        date_pose DATE,
        notes TEXT
      );
    `);
    console.log("   ✅ protheses\n");

    console.log("═══════════════════════════════════════════════════════════════");
    console.log("  SCHEMA FIX COMPLETE - Run smoke test to verify");
    console.log("═══════════════════════════════════════════════════════════════\n");

  } catch (err: any) {
    console.error(`❌ Error: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
