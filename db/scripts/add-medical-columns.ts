import pg from 'pg';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

const { Pool } = pg;

const dbUrl = process.env.SUPABASE_DB_URL_DEV;

if (!dbUrl) {
  console.error('SUPABASE_DB_URL_DEV not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: dbUrl.replace(/[?&]sslmode=[^&]*/g, ''),
  connectionTimeoutMillis: 60000,
  ssl: { rejectUnauthorized: false },
});

async function addColumns() {
  const client = await pool.connect();
  try {
    console.log('Adding columns to patients table on Supabase dev...');
    await client.query('ALTER TABLE patients ADD COLUMN IF NOT EXISTS allergies TEXT');
    await client.query('ALTER TABLE patients ADD COLUMN IF NOT EXISTS traitement TEXT');
    await client.query('ALTER TABLE patients ADD COLUMN IF NOT EXISTS conditions TEXT');
    console.log('Columns added successfully!');
    
    const result = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'patients' ORDER BY ordinal_position");
    console.log('Columns in patients table:', result.rows.map(r => r.column_name).join(', '));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

addColumns();
