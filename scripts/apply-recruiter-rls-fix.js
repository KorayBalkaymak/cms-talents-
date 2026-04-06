#!/usr/bin/env node
// Wendet supabase/migrations/20260403000000_recruiter_allowlist_rls.sql auf die Supabase-DB an.
//
// Empfohlen: POSTGRES_URL_NON_POOLING = direkte URI (Port 5432) aus dem Supabase-Dashboard
// (Settings → Database → Connection string → „Direct connection“ / URI).
// Die Transaction-Pooler-URL (Port 6543) unterstützt oft kein CREATE FUNCTION – dann schlägt dieses Skript fehl.
//
// Aufruf: node scripts/apply-recruiter-rls-fix.js
// Alternativ: Datei supabase/run_in_sql_editor_recruiter_allowlist_rls.sql im Supabase-SQL-Editor ausführen.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

function loadEnv() {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
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

const url =
  process.env.POSTGRES_URL_NON_POOLING?.trim() ||
  process.env.DATABASE_URL_DIRECT?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  process.env.POSTGRES_URL?.trim() ||
  '';

if (!url) {
  console.error('Fehler: Keine DB-URL. Bitte POSTGRES_URL_NON_POOLING (direkt, Port 5432) oder DATABASE_URL in .env setzen.');
  process.exit(1);
}

const sqlPath = path.join(rootDir, 'supabase', 'migrations', '20260403000000_recruiter_allowlist_rls.sql');
if (!fs.existsSync(sqlPath)) {
  console.error('Fehler: Migration nicht gefunden:', sqlPath);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf8');

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes('amazonaws.com') || url.includes('supabase') ? { rejectUnauthorized: false } : undefined,
});

function printSqlEditorHint() {
  const rel = 'supabase/run_in_sql_editor_recruiter_allowlist_rls.sql';
  console.error('');
  console.error('Manuell (immer möglich):');
  console.error(`  1) Supabase Dashboard → SQL → New query`);
  console.error(`  2) Inhalt von ${rel} einfügen und „Run“`);
  console.error('');
}

try {
  await client.connect();
  await client.query(sql);
  console.log('OK: Recruiter-RLS-Fix wurde auf der Datenbank angewendet.');
} catch (e) {
  const msg = e?.message || String(e);
  console.error('Fehler beim Ausführen der Migration:', msg);
  if (/Tenant or user not found|ENOTFOUND|does not support/i.test(msg)) {
    console.error('');
    console.error(
      'Tipp: Für DDL eine direkte Verbindung nutzen (Port 5432), z. B. POSTGRES_URL_NON_POOLING aus dem Dashboard unter „Direct connection“.'
    );
  }
  printSqlEditorHint();
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
