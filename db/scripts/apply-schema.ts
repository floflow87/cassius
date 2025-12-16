import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

const { Pool } = pg;

const APP_ENV = process.env.APP_ENV || 'development';
const isProduction = APP_ENV === 'production';

if (isProduction) {
  if (process.env.CONFIRM_PROD_SCHEMA_APPLY !== 'true') {
    console.error('ERREUR: Pour appliquer le schema en production, definir CONFIRM_PROD_SCHEMA_APPLY=true');
    process.exit(1);
  }
  console.log('ATTENTION: Application du schema sur PRODUCTION');
}

const dbUrl = isProduction 
  ? process.env.SUPABASE_DB_URL_PROD 
  : process.env.SUPABASE_DB_URL_DEV;

if (!dbUrl) {
  console.error(`ERREUR: ${isProduction ? 'SUPABASE_DB_URL_PROD' : 'SUPABASE_DB_URL_DEV'} non defini`);
  process.exit(1);
}

const urlWithoutSsl = dbUrl.replace(/[?&]sslmode=[^&]*/g, '');

const pool = new Pool({
  connectionString: urlWithoutSsl,
  connectionTimeoutMillis: 60000,
  ssl: { rejectUnauthorized: false },
});

async function applySchema() {
  const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
  
  if (!fs.existsSync(schemaPath)) {
    console.error('ERREUR: db/schema.sql introuvable');
    process.exit(1);
  }

  const schema = fs.readFileSync(schemaPath, 'utf-8');
  
  console.log(`[${APP_ENV.toUpperCase()}] Application du schema...`);
  
  try {
    const client = await pool.connect();
    await client.query(schema);
    client.release();
    console.log('Schema applique avec succes');
  } catch (err) {
    console.error('Erreur:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applySchema();
