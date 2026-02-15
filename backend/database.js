// =====================================================
// CMS TALENTS - SQLITE DATABASE SETUP (using sql.js)
// =====================================================

import initSqlJs from 'sql.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, 'cms_talents.db');

let db = null;
let SQL = null;

// Initialize database
async function initDatabase() {
  SQL = await initSqlJs();

  // Try to load existing database
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

  // Create tables
  db.run(`
    -- Users table (authentication)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('candidate', 'recruiter', 'recruiter_admin')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Candidate profiles table
    CREATE TABLE IF NOT EXISTS candidate_profiles (
      user_id TEXT PRIMARY KEY,
      
      -- REQUIRED FIELDS (NOT NULL with defaults)
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      industry TEXT NOT NULL DEFAULT '',
      experience_years INTEGER NOT NULL DEFAULT 0,
      availability TEXT NOT NULL DEFAULT '',
      
      -- OPTIONAL FIELDS
      birth_year TEXT,
      about TEXT,
      profile_image_url TEXT,
      
      -- SYSTEM FIELDS
      avatar_seed TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'in Prüfung' CHECK(status IN ('aktiv', 'gesperrt', 'in Prüfung')),
      is_published INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Skills
    CREATE TABLE IF NOT EXISTS candidate_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      skill TEXT NOT NULL,
      UNIQUE(user_id, skill)
    );

    -- Boosted keywords
    CREATE TABLE IF NOT EXISTS candidate_keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      UNIQUE(user_id, keyword)
    );

    -- Social links
    CREATE TABLE IF NOT EXISTS candidate_social_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      label TEXT NOT NULL,
      url TEXT NOT NULL
    );

    -- Documents
    CREATE TABLE IF NOT EXISTS candidate_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      doc_type TEXT NOT NULL CHECK(doc_type IN ('cv', 'certificate', 'qualification')),
      file_name TEXT NOT NULL,
      file_data TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Audit log
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      performer_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Create indexes
  try {
    db.run('CREATE INDEX IF NOT EXISTS idx_profiles_published ON candidate_profiles(is_published, status)');
    db.run('CREATE INDEX IF NOT EXISTS idx_skills_user ON candidate_skills(user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_documents_user ON candidate_documents(user_id)');
  } catch (e) {
    // Indexes might already exist
  }

  // Optionale Profilfelder (Migration: Spalten hinzufügen falls nicht vorhanden)
  try {
    db.run('ALTER TABLE candidate_profiles ADD COLUMN address TEXT');
  } catch (e) { /* Spalte existiert bereits */ }
  try {
    db.run('ALTER TABLE candidate_profiles ADD COLUMN zip_code TEXT');
  } catch (e) { /* Spalte existiert bereits */ }
  try {
    db.run('ALTER TABLE candidate_profiles ADD COLUMN phone_number TEXT');
  } catch (e) { /* Spalte existiert bereits */ }

  // E-Mail-Verifizierung (Migration)
  try {
    db.run('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 1');
  } catch (e) { /* Spalte existiert bereits */ }
  try {
    db.run('ALTER TABLE users ADD COLUMN verification_token TEXT');
  } catch (e) { /* Spalte existiert bereits */ }
  try {
    db.run('ALTER TABLE users ADD COLUMN verification_token_expires_at TEXT');
  } catch (e) { /* Spalte existiert bereits */ }
  // Alle bestehenden Nutzer als verifiziert setzen (Migration: alte Accounts vor E-Mail-Verifizierung)
  try {
    db.run('UPDATE users SET email_verified = 1, verification_token = NULL, verification_token_expires_at = NULL WHERE email_verified IS NULL OR email_verified != 1');
  } catch (e) { /* ignore */ }

  // Seed demo accounts
  seedDemoAccounts();

  // Save to disk
  saveDatabase();

  console.log('[DB] Database initialized successfully');
  return db;
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

function seedDemoAccounts() {
  const demoAccounts = [
    { email: 'recruiter@cms.de', password: 'recruiter123', role: 'recruiter' },
    { email: 'admin@cms.de', password: 'admin123', role: 'recruiter_admin' }
  ];

  for (const account of demoAccounts) {
    const existing = db.exec(`SELECT id FROM users WHERE email = '${account.email}'`);
    if (existing.length === 0 || existing[0].values.length === 0) {
      const hash = bcrypt.hashSync(account.password, 10);
      const id = uuid();
      db.run(`INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)`,
        [id, account.email, hash, account.role]);
      console.log(`[DB] Created demo account: ${account.email}`);
    }
  }
  saveDatabase();
}

// Helper function to run queries and get results
function query(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (e) {
    console.error('[DB] Query error:', e, sql);
    return [];
  }
}

function queryOne(sql, params = []) {
  const results = query(sql, params);
  return results.length > 0 ? results[0] : null;
}

function run(sql, params = []) {
  try {
    db.run(sql, params);
    saveDatabase();
    return true;
  } catch (e) {
    console.error('[DB] Run error:', e, sql);
    return false;
  }
}

export { initDatabase, db, query, queryOne, run, saveDatabase };
