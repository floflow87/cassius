/**
 * Schema sanity check - verifies critical tables exist on startup
 * Helps catch missing migrations on production
 */

import { db } from "./db";
import { sql } from "drizzle-orm";

const CRITICAL_TABLES = [
  'organisations',
  'users', 
  'patients',
  'operations',
  'implants',
  'surgery_implants',
  'radios',
  'visites',
  'protheses',
  'notes',
  'rendez_vous',
  'appointments',
  'documents',
  'flags',
  'saved_filters',
  'calendar_integrations',
  'appointment_external_links',
  'google_calendar_events',
  'sync_conflicts',
];

export interface SchemaCheckResult {
  ok: boolean;
  missingTables: string[];
  foundTables: string[];
  message: string;
}

export async function checkSchema(): Promise<SchemaCheckResult> {
  try {
    const result = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const existingTables = new Set(
      (result.rows as { table_name: string }[]).map(r => r.table_name)
    );
    
    const missingTables: string[] = [];
    const foundTables: string[] = [];
    
    for (const table of CRITICAL_TABLES) {
      if (existingTables.has(table)) {
        foundTables.push(table);
      } else {
        missingTables.push(table);
      }
    }
    
    const ok = missingTables.length === 0;
    const message = ok 
      ? `Schema OK: ${foundTables.length}/${CRITICAL_TABLES.length} critical tables present`
      : `Schema ERROR: Missing ${missingTables.length} critical tables: ${missingTables.join(', ')}`;
    
    return { ok, missingTables, foundTables, message };
  } catch (error) {
    return {
      ok: false,
      missingTables: [],
      foundTables: [],
      message: `Schema check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export async function logSchemaCheck(): Promise<boolean> {
  const result = await checkSchema();
  
  if (result.ok) {
    console.log(`[Schema] ✓ ${result.message}`);
  } else {
    console.error(`[Schema] ✗ ${result.message}`);
    if (result.missingTables.length > 0) {
      console.error(`[Schema] Missing tables: ${result.missingTables.join(', ')}`);
      console.error(`[Schema] Run migrations: SUPABASE_DATABASE_URL=<url> npx tsx script/migrate-supabase-prod.ts`);
    }
  }
  
  return result.ok;
}
