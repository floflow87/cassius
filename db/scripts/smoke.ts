/**
 * DB Smoke Test Script
 * 
 * Vérifie la connexion et l'état des tables critiques sur la base sélectionnée.
 * Usage: APP_ENV=production npx tsx db/scripts/smoke.ts
 *        APP_ENV=development npx tsx db/scripts/smoke.ts
 */

import pg from "pg";
import dns from "dns";

dns.setDefaultResultOrder('ipv4first');

const { Pool } = pg;

const APP_ENV = process.env.APP_ENV || "development";
const isProduction = APP_ENV === "production";

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  CASSIUS DB SMOKE TEST - ${APP_ENV.toUpperCase()}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Select appropriate DB URL
  let databaseUrl: string | undefined;
  if (isProduction) {
    databaseUrl = process.env.SUPABASE_DB_URL_PROD;
    if (!databaseUrl) {
      console.error("❌ SUPABASE_DB_URL_PROD is not set");
      process.exit(1);
    }
  } else {
    databaseUrl = process.env.SUPABASE_DB_URL_DEV;
    if (!databaseUrl) {
      console.error("❌ SUPABASE_DB_URL_DEV is not set");
      process.exit(1);
    }
  }

  // Parse and display host (never show password)
  let dbHost = "unknown";
  let dbName = "unknown";
  try {
    const url = new URL(databaseUrl);
    dbHost = url.hostname;
    dbName = url.pathname.replace(/^\//, '') || "postgres";
  } catch (e) {
    console.error("❌ Invalid database URL format");
    process.exit(1);
  }

  console.log(`📍 Environment: ${APP_ENV}`);
  console.log(`📍 Host: ${dbHost}`);
  console.log(`📍 Database: ${dbName}\n`);

  // Create pool
  const urlWithoutSslMode = databaseUrl.replace(/[?&]sslmode=[^&]*/g, '');
  const pool = new Pool({
    connectionString: urlWithoutSslMode,
    connectionTimeoutMillis: 30000,
    max: 2,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // Test 1: Basic connection
    console.log("🔌 Testing connection...");
    const start = Date.now();
    const client = await pool.connect();
    const latency = Date.now() - start;
    console.log(`   ✅ Connected (latency: ${latency}ms)\n`);

    // Test 2: Server time
    console.log("⏰ Server time:");
    const timeResult = await client.query("SELECT NOW() as server_time, version() as pg_version");
    console.log(`   Server Time: ${timeResult.rows[0].server_time}`);
    console.log(`   PostgreSQL: ${timeResult.rows[0].pg_version.split(',')[0]}\n`);

    // Test 3: Table counts
    console.log("📊 Table counts:");
    const tables = [
      { name: "organisations", critical: true },
      { name: "users", critical: true },
      { name: "patients", critical: false },
      { name: "operations", critical: false },
      { name: "implants", critical: false },
      { name: "radios", critical: false },
      { name: "visites", critical: false },
      { name: "protheses", critical: false },
    ];

    const results: { table: string; count: number | string; status: string }[] = [];

    for (const table of tables) {
      try {
        const countResult = await client.query(`SELECT COUNT(*) as count FROM ${table.name}`);
        const count = parseInt(countResult.rows[0].count, 10);
        results.push({ 
          table: table.name, 
          count, 
          status: "✅" 
        });
      } catch (err: any) {
        if (err.code === "42P01") {
          // Table does not exist
          results.push({ 
            table: table.name, 
            count: "N/A", 
            status: table.critical ? "❌ MISSING" : "⚠️ MISSING" 
          });
        } else {
          results.push({ 
            table: table.name, 
            count: "ERROR", 
            status: `❌ ${err.code || err.message}` 
          });
        }
      }
    }

    // Display results
    const maxTableLen = Math.max(...results.map(r => r.table.length));
    for (const r of results) {
      const paddedName = r.table.padEnd(maxTableLen);
      const paddedCount = String(r.count).padStart(6);
      console.log(`   ${r.status} ${paddedName} : ${paddedCount}`);
    }

    // Check for critical missing tables
    const missingCritical = results.filter(r => r.status.includes("MISSING") && tables.find(t => t.name === r.table)?.critical);
    if (missingCritical.length > 0) {
      console.log("\n⚠️  CRITICAL: Missing tables detected!");
      console.log("   Run the following to apply schema:");
      console.log(`   APP_ENV=${APP_ENV} CONFIRM_PROD_SCHEMA_APPLY=true npx tsx db/scripts/apply-schema.ts`);
    }

    // Test 4: Check default organisation exists
    console.log("\n🏢 Default organisation check:");
    try {
      const orgResult = await client.query(
        "SELECT id, nom FROM organisations WHERE id = $1",
        ["default-org-001"]
      );
      if (orgResult.rows.length > 0) {
        console.log(`   ✅ default-org-001 exists: "${orgResult.rows[0].nom}"`);
      } else {
        console.log("   ❌ default-org-001 NOT FOUND");
        console.log("   This will cause registration to fail!");
        console.log("   Insert with: INSERT INTO organisations (id, nom) VALUES ('default-org-001', 'Cabinet par défaut');");
      }
    } catch (err: any) {
      console.log(`   ❌ Error checking organisation: ${err.message}`);
    }

    client.release();
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  SMOKE TEST COMPLETE");
    console.log("═══════════════════════════════════════════════════════════════\n");

  } catch (err: any) {
    console.error(`❌ Connection failed: ${err.message}`);
    if (err.code === "ENOTFOUND") {
      console.error("   DNS resolution failed - check hostname");
    } else if (err.code === "ECONNREFUSED") {
      console.error("   Connection refused - check port and firewall");
    } else if (err.code === "28P01") {
      console.error("   Authentication failed - check password");
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
