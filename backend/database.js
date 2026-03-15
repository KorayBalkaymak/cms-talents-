// =====================================================
// CMS TALENTS - DATABASE LAYER
// - Lokal: SQLite via sql.js (Datei cms_talents.db)
// - Vercel/Prod: Optional Postgres (persistenter Storage)
// =====================================================

import dns from 'node:dns';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, 'cms_talents.db');

const POSTGRES_URL = String(
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  process.env.PRISMA_DATABASE_URL ||
  ''
).trim();

const IS_VERCEL = !!process.env.VERCEL;
const USE_POSTGRES = !!POSTGRES_URL;

let db = null;          // sql.js Database
let SQL = null;         // sql.js module
let pool = null;        // pg Pool
let dbMode = 'sqlite';  // 'sqlite' | 'postgres'

function normalizeSqlForPostgres(sql) {
  let s = String(sql);

  // SQLite -> Postgres: datetime('now') / datetime(\"now\")
  s = s.replace(/datetime\((['\"])now\1\)/gi, 'CURRENT_TIMESTAMP');

  // SQLite: INSERT OR IGNORE -> Postgres: ON CONFLICT DO NOTHING
  const m = s.match(/^\s*INSERT\s+OR\s+IGNORE\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([\s\S]+)\)\s*;?\s*$/i);
  if (m) {
    const table = m[1];
    const cols = m[2].split(',').map(c => c.trim());
    const values = m[3].trim();
    s = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${values}) ON CONFLICT (${cols.join(', ')}) DO NOTHING`;
  }

  // SQLite placeholders '?' -> Postgres '$1..$n'
  let i = 0;
  s = s.replace(/\?/g, () => `$${++i}`);

  return s;
}

async function initPostgres() {
  // In Serverless Umgebungen kommt es häufig zu IPv6-Timeouts – Prisma DB ist i.d.R. via IPv4 erreichbar.
  try { dns.setDefaultResultOrder('ipv4first'); } catch { /* ignore */ }

  const { Pool } = await import('pg');
  if (!pool) {
    pool = new Pool({
      connectionString: POSTGRES_URL,
      ssl: { rejectUnauthorized: false },
      // Serverless: schnell failen statt ewig hängen
      max: 2,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 30_000,
      keepAlive: true
    });
  }
  dbMode = 'postgres';

  // Verbindung früh prüfen (sonst wirkt es im Frontend wie "Timeout")
  try {
    await pool.query('SELECT 1');
  } catch (e) {
    const msg = e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e);
    const code = e && typeof e === 'object' && 'code' in e ? String(e.code) : '';
    throw new Error(`Postgres connection failed${code ? ` (${code})` : ''}: ${msg}`);
  }

  // Schema (Postgres)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('candidate', 'recruiter', 'recruiter_admin')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      email_verified INTEGER DEFAULT 1,
      verification_token TEXT,
      verification_token_expires_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS candidate_profiles (
      user_id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      industry TEXT NOT NULL DEFAULT '',
      experience_years INTEGER NOT NULL DEFAULT 0,
      availability TEXT NOT NULL DEFAULT '',
      birth_year TEXT,
      about TEXT,
      profile_image_url TEXT,
      avatar_seed TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'in Prüfung' CHECK(status IN ('aktiv', 'gesperrt', 'in Prüfung')),
      is_published INTEGER NOT NULL DEFAULT 0,
      submitted_to_recruiter INTEGER NOT NULL DEFAULT 0,
      cv_reviewed_at TIMESTAMPTZ,
      cv_reviewed_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      address TEXT,
      zip_code TEXT,
      phone_number TEXT
    );

    CREATE TABLE IF NOT EXISTS candidate_skills (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      skill TEXT NOT NULL,
      UNIQUE(user_id, skill)
    );

    CREATE TABLE IF NOT EXISTS candidate_keywords (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      UNIQUE(user_id, keyword)
    );

    CREATE TABLE IF NOT EXISTS candidate_social_links (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      label TEXT NOT NULL,
      url TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS candidate_documents (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      doc_type TEXT NOT NULL CHECK(doc_type IN ('cv', 'certificate', 'qualification')),
      file_name TEXT NOT NULL,
      file_data TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      performer_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_profiles_published ON candidate_profiles(is_published, status)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_skills_user ON candidate_skills(user_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_documents_user ON candidate_documents(user_id)');
  await pool.query('ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS submitted_to_recruiter INTEGER NOT NULL DEFAULT 0');
  await pool.query('ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS cv_reviewed_at TIMESTAMPTZ');
  await pool.query('ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS cv_reviewed_by TEXT');

  // Alte Accounts (vor Einführung der Spalte) als verifiziert markieren
  // Wichtig: neue Registrierungen mit email_verified=0 dürfen NICHT überschrieben werden.
  await pool.query(`UPDATE users SET email_verified = 1 WHERE email_verified IS NULL`);
}

async function initSqlite() {
  const { default: initSqlJs } = await import('sql.js');
  SQL = await initSqlJs();

  if (IS_VERCEL) {
    // Vercel ohne Postgres: kein Dateisystem – nur In-Memory (nicht persistent!)
    db = new SQL.Database();
    console.log('[DB] Vercel: In-Memory-Datenbank erstellt');
  } else {
    try {
      if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
        console.log('[DB] Loaded existing database');
      } else {
        db = new SQL.Database();
        console.log('[DB] Created new database');
      }
    } catch (e) {
      console.error('[DB] Error loading database, creating new:', e);
      db = new SQL.Database();
    }
  }

  dbMode = 'sqlite';

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('candidate', 'recruiter', 'recruiter_admin')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS candidate_profiles (
      user_id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      industry TEXT NOT NULL DEFAULT '',
      experience_years INTEGER NOT NULL DEFAULT 0,
      availability TEXT NOT NULL DEFAULT '',
      birth_year TEXT,
      about TEXT,
      profile_image_url TEXT,
      avatar_seed TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'in Prüfung' CHECK(status IN ('aktiv', 'gesperrt', 'in Prüfung')),
      is_published INTEGER NOT NULL DEFAULT 0,
      submitted_to_recruiter INTEGER NOT NULL DEFAULT 0,
      cv_reviewed_at TEXT,
      cv_reviewed_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS candidate_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      skill TEXT NOT NULL,
      UNIQUE(user_id, skill)
    );

    CREATE TABLE IF NOT EXISTS candidate_keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      UNIQUE(user_id, keyword)
    );

    CREATE TABLE IF NOT EXISTS candidate_social_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      label TEXT NOT NULL,
      url TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS candidate_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      doc_type TEXT NOT NULL CHECK(doc_type IN ('cv', 'certificate', 'qualification')),
      file_name TEXT NOT NULL,
      file_data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      performer_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  try {
    db.run('CREATE INDEX IF NOT EXISTS idx_profiles_published ON candidate_profiles(is_published, status)');
  try { db.run('ALTER TABLE candidate_profiles ADD COLUMN submitted_to_recruiter INTEGER NOT NULL DEFAULT 0'); } catch { }
  try { db.run('ALTER TABLE candidate_profiles ADD COLUMN cv_reviewed_at TEXT'); } catch { }
  try { db.run('ALTER TABLE candidate_profiles ADD COLUMN cv_reviewed_by TEXT'); } catch { }
    db.run('CREATE INDEX IF NOT EXISTS idx_skills_user ON candidate_skills(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_documents_user ON candidate_documents(user_id)');
  } catch { /* ignore */ }

  // Migrations
  try { db.run('ALTER TABLE candidate_profiles ADD COLUMN address TEXT'); } catch { }
  try { db.run('ALTER TABLE candidate_profiles ADD COLUMN zip_code TEXT'); } catch { }
  try { db.run('ALTER TABLE candidate_profiles ADD COLUMN phone_number TEXT'); } catch { }

  try { db.run('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 1'); } catch { }
  try { db.run('ALTER TABLE users ADD COLUMN verification_token TEXT'); } catch { }
  try { db.run('ALTER TABLE users ADD COLUMN verification_token_expires_at TEXT'); } catch { }
  try {
    // Nur alte Accounts markieren, nicht neue (email_verified=0)
    db.run('UPDATE users SET email_verified = 1 WHERE email_verified IS NULL');
  } catch { }
}

async function initDatabase() {
  // Auf Vercel MUSS die DB persistent sein – sonst verschwinden Accounts bei Cold Starts/Reload.
  if (IS_VERCEL && !USE_POSTGRES) {
    throw new Error('POSTGRES_URL/DATABASE_URL fehlt. Bitte Vercel Postgres (oder externe Postgres) verbinden und als Environment Variable setzen.');
  }
  if (USE_POSTGRES) {
    await initPostgres();
  } else {
    await initSqlite();
  }

  await seedDemoAccounts();
  await saveDatabase();
  console.log(`[DB] Database initialized successfully (${dbMode})`);
  return db;
}

async function saveDatabase() {
  if (dbMode === 'sqlite' && db && !IS_VERCEL) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

async function seedDemoAccounts() {
  const demoAccounts = [
    { email: 'recruiter@cms.de', password: 'recruiter123', role: 'recruiter' },
    { email: 'admin@cms.de', password: 'admin123', role: 'recruiter_admin' }
  ];

  for (const account of demoAccounts) {
    const existing = await queryOne('SELECT id FROM users WHERE email = ?', [account.email]);
    if (!existing) {
      const hash = bcrypt.hashSync(account.password, 10);
      const id = uuid();
      await run('INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)', [id, account.email, hash, account.role]);
      console.log(`[DB] Created demo account: ${account.email}`);
    }
  }
}

async function query(sql, params = []) {
  try {
    if (dbMode === 'postgres') {
      const q = normalizeSqlForPostgres(sql);
      const res = await pool.query(q, params);
      return res.rows ?? [];
    }

    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  } catch (e) {
    console.error('[DB] Query error:', e, sql);
    return [];
  }
}

async function queryOne(sql, params = []) {
  const results = await query(sql, params);
  return results.length > 0 ? results[0] : null;
}

async function run(sql, params = []) {
  try {
    if (dbMode === 'postgres') {
      const q = normalizeSqlForPostgres(sql);
      await pool.query(q, params);
      return true;
    }

    db.run(sql, params);
    await saveDatabase();
    return true;
  } catch (e) {
    console.error('[DB] Run error:', e, sql);
    return false;
  }
}

export { initDatabase, db, query, queryOne, run, saveDatabase };
