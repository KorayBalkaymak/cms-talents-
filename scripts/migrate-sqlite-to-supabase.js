#!/usr/bin/env node
// =====================================================
// CMS Talents – Migration: SQLite (lokal) → Supabase (PostgreSQL)
// Voraussetzung: Supabase-Schema ist angelegt (supabase/schema.sql oder erster Deploy).
// Aufruf (aus Projektroot): node scripts/migrate-sqlite-to-supabase.js
// Env: DATABASE_URL oder POSTGRES_URL = Supabase Connection-Pooling-URI
// Optional: .env im Projektroot wird gelesen (einfacher Parser, keine dotenv-Abhängigkeit).
// =====================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const dbPath = join(rootDir, 'backend', 'cms_talents.db');

function loadEnv() {
  const envPath = join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) {
      const key = m[1];
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      process.env[key] = val;
    }
  }
}

loadEnv();

const POSTGRES_URL = (
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  process.env.PRISMA_DATABASE_URL ||
  ''
).trim();

if (!POSTGRES_URL) {
  console.error('Fehler: DATABASE_URL oder POSTGRES_URL muss gesetzt sein (oder in .env).');
  process.exit(1);
}

if (!fs.existsSync(dbPath)) {
  console.error('Fehler: SQLite-Datei nicht gefunden:', dbPath);
  process.exit(1);
}

const { default: initSqlJs } = await import('sql.js');
const { Pool } = await import('pg');

const SQL = await initSqlJs();
const fileBuffer = fs.readFileSync(dbPath);
const db = new SQL.Database(fileBuffer);

const pool = new Pool({
  connectionString: POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const tables = [
  'users',
  'candidate_profiles',
  'candidate_skills',
  'candidate_keywords',
  'candidate_social_links',
  'candidate_documents',
  'audit_log',
];

function sqliteRows(table) {
  try {
    const res = db.exec(`SELECT * FROM ${table}`);
    if (!res.length || !res[0].values.length) return { columns: [], rows: [] };
    const columns = res[0].columns;
    const rows = res[0].values.map((row) => {
      const obj = {};
      columns.forEach((col, i) => (obj[col] = row[i]));
      return obj;
    });
    return { columns, rows };
  } catch (e) {
    return { columns: [], rows: [] };
  }
}

function pgInsert(table, columns, rows) {
  if (rows.length === 0) return Promise.resolve(0);
  const cols = columns.join(', ');
  const placeholders = rows.map((_, i) => {
    const start = i * columns.length + 1;
    return '(' + columns.map((_, j) => `$${start + j}`).join(', ') + ')';
  }).join(', ');
  const values = rows.flatMap((row) => columns.map((c) => row[c]));
  const sql = `INSERT INTO ${table} (${cols}) VALUES ${placeholders} ON CONFLICT DO NOTHING`;
  return pool.query(sql, values).then((r) => r.rowCount ?? 0);
}

async function setSequence(table) {
  const safeTable = table.replace(/"/g, '""');
  try {
    await pool.query({ text: `SELECT setval(pg_get_serial_sequence($1, 'id'), (SELECT COALESCE(MAX(id), 1) FROM "${safeTable}"))`, values: [table] });
  } catch (_) {}
}

console.log('Migration gestartet: SQLite → Supabase');
console.log('SQLite:', dbPath);

for (const table of tables) {
  const { columns, rows } = sqliteRows(table);
  if (columns.length === 0) {
    console.log(`  ${table}: (Tabelle leer oder nicht vorhanden)`);
    continue;
  }
  try {
    const count = await pgInsert(table, columns, rows);
    if (table === 'candidate_skills' || table === 'candidate_keywords' || table === 'candidate_social_links' || table === 'candidate_documents') {
      await setSequence(table);
    }
    console.log(`  ${table}: ${rows.length} Zeilen gelesen, ${count} eingefügt`);
  } catch (e) {
    console.error(`  ${table}: Fehler`, e.message);
  }
}

await pool.end();
db.close();
console.log('Migration beendet.');
