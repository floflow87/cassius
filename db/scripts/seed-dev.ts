import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

const { Pool } = pg;

const APP_ENV = process.env.APP_ENV || 'development';

if (APP_ENV === 'production') {
  console.error('ERREUR: Le seed ne peut pas etre applique en production');
  process.exit(1);
}

const dbUrl = process.env.SUPABASE_DB_URL_DEV;

if (!dbUrl) {
  console.error('ERREUR: SUPABASE_DB_URL_DEV non defini');
  process.exit(1);
}

const urlWithoutSsl = dbUrl.replace(/[?&]sslmode=[^&]*/g, '');

const pool = new Pool({
  connectionString: urlWithoutSsl,
  connectionTimeoutMillis: 60000,
  ssl: { rejectUnauthorized: false },
});

async function applySeed() {
  const seedPath = path.join(process.cwd(), 'db', 'seed.dev.sql');
  
  if (!fs.existsSync(seedPath)) {
    console.error('ERREUR: db/seed.dev.sql introuvable');
    process.exit(1);
  }

  const seed = fs.readFileSync(seedPath, 'utf-8');
  
  console.log('[DEV] Application des donnees de test...');
  
  try {
    const client = await pool.connect();
    const result = await client.query(seed);
    client.release();
    console.log('Seed applique avec succes');
  } catch (err) {
    console.error('Erreur:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applySeed();
