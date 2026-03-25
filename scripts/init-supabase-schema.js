#!/usr/bin/env node
// Führt supabase/schema.sql gegen die in .env konfigurierte Supabase-DB aus.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

function loadEnv() {
  const envPath = join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) {
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      process.env[m[1]] = val;
    }
  }
}
loadEnv();

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || '';
if (!DATABASE_URL) {
  console.error('DATABASE_URL oder POSTGRES_URL in .env fehlt.');
  process.exit(1);
}

const schemaPath = join(rootDir, 'supabase', 'schema.sql');
const sql = fs.readFileSync(schemaPath, 'utf8');

const { Pool } = await import('pg');
const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

try {
  await pool.query(sql);
  console.log('Schema in Supabase angelegt.');
} catch (e) {
  console.error('Fehler:', e.message);
  process.exit(1);
} finally {
  await pool.end();
}
