import pg from "pg";

const { Pool } = pg;

async function addMedicalContextColumns() {
  const appEnv = process.env.APP_ENV || "development";
  const dbUrl = appEnv === "production" 
    ? process.env.SUPABASE_DB_URL_PROD 
    : process.env.SUPABASE_DB_URL_DEV;

  if (!dbUrl) {
    console.error(`Missing database URL for ${appEnv} environment`);
    process.exit(1);
  }

  console.log(`Adding medical context columns in ${appEnv}...`);

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();
    
    const columns = [
      { name: "allergies", type: "TEXT" },
      { name: "medicaments", type: "TEXT" },
    ];

    for (const col of columns) {
      const checkQuery = `
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'patients' AND column_name = $1
      `;
      const result = await client.query(checkQuery, [col.name]);

      if (result.rows.length === 0) {
        console.log(`Adding column ${col.name}...`);
        await client.query(`ALTER TABLE patients ADD COLUMN ${col.name} ${col.type}`);
        console.log(`Column ${col.name} added successfully`);
      } else {
        console.log(`Column ${col.name} already exists`);
      }
    }

    client.release();
    console.log("Migration complete!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

addMedicalContextColumns();
