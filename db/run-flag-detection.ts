import pg from "pg";

const { Pool } = pg;

const APP_ENV = process.env.APP_ENV || "development";

let databaseUrl: string;
if (!process.env.SUPABASE_DB_URL_DEV) {
  console.error("SUPABASE_DB_URL_DEV is required");
  process.exit(1);
}
databaseUrl = process.env.SUPABASE_DB_URL_DEV;

try {
  const url = new URL(databaseUrl);
  console.log(`[FlagDetection] Environment: ${APP_ENV}`);
  console.log(`[FlagDetection] Target DB: ${url.hostname}`);
} catch {
  console.log(`[FlagDetection] Environment: ${APP_ENV}`);
}

const urlWithoutSslMode = databaseUrl.replace(/[?&]sslmode=[^&]*/g, '');

const pool = new Pool({
  connectionString: urlWithoutSslMode,
  ssl: { rejectUnauthorized: false },
});

const ISQ_LOW_THRESHOLD = 55;
const ISQ_DECLINE_THRESHOLD = 10;

async function runDetection() {
  const client = await pool.connect();
  
  try {
    console.log("\n[FlagDetection] Getting organisations...");
    
    const orgsResult = await client.query(`SELECT id FROM organisations`);
    const orgIds = orgsResult.rows.map(r => r.id);
    
    console.log(`[FlagDetection] Found ${orgIds.length} organisations`);
    
    for (const orgId of orgIds) {
      console.log(`\n[FlagDetection] Processing org: ${orgId}`);
      
      let created = 0;
      let existing = 0;
      
      // Detect ISQ_LOW flags
      const lowIsqResult = await client.query(`
        SELECT si.id, si.isq_pose, si.isq_2m, si.isq_3m, si.isq_6m, p.nom, p.prenom, p.id as patient_id
        FROM surgery_implants si
        JOIN operations o ON si.surgery_id = o.id
        JOIN patients p ON o.patient_id = p.id
        WHERE si.organisation_id = $1
        AND (
          si.isq_pose < $2 OR si.isq_2m < $2 OR si.isq_3m < $2 OR si.isq_6m < $2
        )
      `, [orgId, ISQ_LOW_THRESHOLD]);
      
      console.log(`[FlagDetection] Found ${lowIsqResult.rows.length} implants with low ISQ`);
      
      for (const row of lowIsqResult.rows) {
        const values = [row.isq_pose, row.isq_2m, row.isq_3m, row.isq_6m].filter(v => v !== null);
        const minIsq = Math.min(...values);
        
        // Check if flag already exists
        const existingFlag = await client.query(`
          SELECT id FROM flags 
          WHERE organisation_id = $1 
          AND entity_type = 'IMPLANT' 
          AND entity_id = $2 
          AND type = 'ISQ_LOW'
          AND resolved_at IS NULL
        `, [orgId, row.id]);
        
        if (existingFlag.rows.length === 0) {
          await client.query(`
            INSERT INTO flags (id, organisation_id, level, type, label, description, entity_type, entity_id, created_at)
            VALUES (gen_random_uuid()::text, $1, 'CRITICAL', 'ISQ_LOW', $2, $3, 'IMPLANT', $4, NOW())
          `, [
            orgId,
            `ISQ faible: ${minIsq}`,
            `Patient ${row.prenom} ${row.nom} - ISQ inferieur a ${ISQ_LOW_THRESHOLD}`,
            row.id
          ]);
          created++;
          console.log(`[FlagDetection] Created ISQ_LOW flag for implant ${row.id}`);
        } else {
          existing++;
        }
      }
      
      // Detect ISQ_DECLINING flags
      const decliningResult = await client.query(`
        SELECT si.id, si.isq_pose, si.isq_2m, si.isq_3m, si.isq_6m, p.nom, p.prenom, p.id as patient_id
        FROM surgery_implants si
        JOIN operations o ON si.surgery_id = o.id
        JOIN patients p ON o.patient_id = p.id
        WHERE si.organisation_id = $1
        AND si.isq_pose IS NOT NULL
        AND (
          (si.isq_2m IS NOT NULL AND si.isq_pose - si.isq_2m >= $2) OR
          (si.isq_3m IS NOT NULL AND COALESCE(si.isq_2m, si.isq_pose) - si.isq_3m >= $2) OR
          (si.isq_6m IS NOT NULL AND COALESCE(si.isq_3m, si.isq_2m, si.isq_pose) - si.isq_6m >= $2)
        )
      `, [orgId, ISQ_DECLINE_THRESHOLD]);
      
      console.log(`[FlagDetection] Found ${decliningResult.rows.length} implants with declining ISQ`);
      
      for (const row of decliningResult.rows) {
        const existingFlag = await client.query(`
          SELECT id FROM flags 
          WHERE organisation_id = $1 
          AND entity_type = 'IMPLANT' 
          AND entity_id = $2 
          AND type = 'ISQ_DECLINING'
          AND resolved_at IS NULL
        `, [orgId, row.id]);
        
        if (existingFlag.rows.length === 0) {
          await client.query(`
            INSERT INTO flags (id, organisation_id, level, type, label, description, entity_type, entity_id, created_at)
            VALUES (gen_random_uuid()::text, $1, 'CRITICAL', 'ISQ_DECLINING', $2, $3, 'IMPLANT', $4, NOW())
          `, [
            orgId,
            `ISQ en declin`,
            `Patient ${row.prenom} ${row.nom} - Chute d'ISQ superieure a ${ISQ_DECLINE_THRESHOLD} points`,
            row.id
          ]);
          created++;
          console.log(`[FlagDetection] Created ISQ_DECLINING flag for implant ${row.id}`);
        } else {
          existing++;
        }
      }
      
      console.log(`[FlagDetection] Org ${orgId}: created=${created}, existing=${existing}`);
    }
    
    // Show final flags count
    const finalCount = await client.query(`SELECT COUNT(*) as count FROM flags WHERE resolved_at IS NULL`);
    console.log(`\n[FlagDetection] Total active flags: ${finalCount.rows[0].count}`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

runDetection().catch(err => {
  console.error("[FlagDetection] Error:", err);
  process.exit(1);
});
