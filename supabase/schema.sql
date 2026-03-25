-- =====================================================
-- CMS Talents – Supabase/PostgreSQL Schema
-- Optional: Im Supabase Dashboard unter SQL Editor ausführen.
-- Sonst legt die App das Schema beim ersten Request an (CREATE TABLE IF NOT EXISTS).
-- =====================================================

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

-- Indizes
CREATE INDEX IF NOT EXISTS idx_profiles_published ON candidate_profiles(is_published, status);
CREATE INDEX IF NOT EXISTS idx_skills_user ON candidate_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user ON candidate_documents(user_id);

-- Optionale Spalten (idempotent)
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS submitted_to_recruiter INTEGER NOT NULL DEFAULT 0;
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS cv_reviewed_at TIMESTAMPTZ;
ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS cv_reviewed_by TEXT;

-- Bestehende Accounts als verifiziert markieren
UPDATE users SET email_verified = 1 WHERE email_verified IS NULL;
