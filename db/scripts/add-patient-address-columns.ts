import { Pool } from "pg";

const env = process.env.APP_ENV || "development";
const dbUrl = env === "production" 
  ? process.env.SUPABASE_DB_URL_PROD 
  : process.env.SUPABASE_DB_URL_DEV;

if (!dbUrl) {
  console.error(`Missing database URL for ${env} environment`);
  process.exit(1);
}

console.log(`[MIGRATION] Adding patient address columns | env=${env}`);

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

async function migrate() {
  const client = await pool.connect();
  try {
    const columns = [
      { name: "adresse", type: "TEXT" },
      { name: "code_postal", type: "TEXT" },
      { name: "ville", type: "TEXT" },
      { name: "pays", type: "TEXT" },
    ];

    for (const col of columns) {
      const checkQuery = `
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'patients' AND column_name = $1
      `;
      const result = await client.query(checkQuery, [col.name]);
      
      if (result.rows.length === 0) {
        console.log(`[MIGRATION] Adding column: ${col.name}`);
        await client.query(`ALTER TABLE patients ADD COLUMN ${col.name} ${col.type}`);
        console.log(`[MIGRATION] Column ${col.name} added successfully`);
      } else {
        console.log(`[MIGRATION] Column ${col.name} already exists, skipping`);
      }
    }

    console.log("[MIGRATION] Complete!");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("[MIGRATION] Error:", err);
  process.exit(1);
});
