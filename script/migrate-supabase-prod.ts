/**
 * Apply Supabase migrations to production database
 * Usage: SUPABASE_DATABASE_URL=<url> npx tsx script/migrate-supabase-prod.ts
 * 
 * This script reads and executes all SQL files in supabase/migrations/ in order.
 * Migrations are idempotent (use IF NOT EXISTS) so they can be run multiple times safely.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'supabase', 'migrations');

async function runMigrations() {
  const dbUrl = process.env.SUPABASE_DATABASE_URL;
  
  if (!dbUrl) {
    console.error('Error: SUPABASE_DATABASE_URL environment variable is required');
    console.error('Example: SUPABASE_DATABASE_URL="postgresql://..." npx tsx script/migrate-supabase-prod.ts');
    process.exit(1);
  }

  console.log('Connecting to Supabase production database...');
  
  const client = new pg.Client({ connectionString: dbUrl });
  
  try {
    await client.connect();
    console.log('Connected successfully!');

    // Get all migration files sorted by name
    const files = readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('No migration files found in supabase/migrations/');
      return;
    }

    console.log(`Found ${files.length} migration file(s):`);
    files.forEach(f => console.log(`  - ${f}`));
    console.log('');

    for (const file of files) {
      const filePath = join(MIGRATIONS_DIR, file);
      const sql = readFileSync(filePath, 'utf-8');
      
      console.log(`Applying: ${file}...`);
      await client.query(sql);
      console.log(`  ✓ Applied successfully`);
    }

    console.log('\n✅ All migrations applied successfully!');

    // Verify all critical tables exist
    console.log('\nVerifying all critical tables...');
    const criticalTables = [
      'organisations', 'users', 'patients', 'operations', 'implants', 
      'surgery_implants', 'radios', 'visites', 'protheses',
      'notes', 'rendez_vous', 'appointments', 'documents', 'flags', 
      'saved_filters', 'calendar_integrations', 'appointment_external_links'
    ];
    
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const existingTables = new Set(result.rows.map(r => r.table_name));
    const missingTables: string[] = [];
    const foundTables: string[] = [];
    
    for (const table of criticalTables) {
      if (existingTables.has(table)) {
        foundTables.push(table);
      } else {
        missingTables.push(table);
      }
    }
    
    console.log(`\nTables found (${foundTables.length}/${criticalTables.length}):`);
    foundTables.forEach(t => console.log(`  ✓ ${t}`));
    
    if (missingTables.length > 0) {
      console.log(`\n⚠️ Missing tables (${missingTables.length}):`);
      missingTables.forEach(t => console.log(`  ✗ ${t}`));
      console.log('\nWarning: Some critical tables are missing!');
    } else {
      console.log('\n✅ All critical tables are present!');
    }
    
    // Show all tables in database
    console.log(`\nAll tables in database (${existingTables.size}):`);
    Array.from(existingTables).sort().forEach(t => console.log(`  - ${t}`));

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
