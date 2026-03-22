# CMS Talents - Supabase Edition

CMS Talents runs as a Vite/React frontend that connects directly to Supabase for Auth, profile data, documents and audit logs.

## Stack

- React
- Vite
- TypeScript
- Supabase Auth + Postgres

## Local Setup

1. Install dependencies
   ```bash
   npm install
   ```

2. Create a local `.env` file from the example
   ```bash
   cp .env.example .env
   ```

3. Run the app
   ```bash
   npm run dev
   ```

   Frontend:
   `http://localhost:5174`

## Required Environment Variables

Use these on both local development and Vercel:

```env
VITE_SUPABASE_URL=https://stzhqhianafrgtxqmqyo.supabase.co
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_...
```

Do not put the service role key into the frontend. It must stay server-side only.

## Supabase Migration

Run this SQL file in the Supabase SQL editor before the first deploy:

- `supabase/migrations/20260317_0001_init.sql`

### Fehler: `recruiter_editing_at` / Schema-Cache

Wenn beim Klick auf **„Bearbeitung melden“** im Recruiter-Dashboard eine Meldung wie
`Could not find the 'recruiter_editing_at' column of 'profiles'` erscheint, fehlen die
Spalten in deiner Datenbank noch.

**Lösung:** Im Supabase-Dashboard **SQL Editor** öffnen und die Datei ausführen:

- **`supabase/run_in_sql_editor_recruiter_editing.sql`**

(Alternativ: `supabase/migrations/20260320000000_recruiter_editing_claim.sql` – gleicher Inhalt.)

Danach die App neu laden. Falls der Fehler kurz bleibt: unter **Project Settings → API**
gibt es ggf. eine Schema-Neuladung; normalerweise erkennt Supabase die neuen Spalten
innerhalb weniger Sekunden.

It creates:

- `profiles`
- `candidate_documents`
- `audit_log`
- `recruiter_allowlist`
- the auth trigger that auto-creates the profile/document rows
- the RLS policies used by the app

## Recruiter Access

The app expects these recruiter emails:

- `haagen@industries-cms.com`
- `candau@industries-cms.com`
- `fuhrmann@industries-cms.com`

The migration seeds them into `recruiter_allowlist`.

Create matching users once in Supabase Auth:

- `haagen@industries-cms.com` -> `recruiter_admin`
- `candau@industries-cms.com` -> `recruiter`
- `fuhrmann@industries-cms.com` -> `recruiter`

After that, the auth trigger assigns the correct role automatically.

## Vercel Deployment

1. Import the repository into Vercel.
2. Add the two `VITE_SUPABASE_*` environment variables.
3. Set them for both `Production` and `Preview`.
4. Deploy.

Because the app uses hash routing for the UI and `/verify-email` for the Supabase callback, no custom backend or API routes are required.

## Auth Flow

- Candidates register via Supabase Auth.
- If email confirmation is enabled in Supabase, the confirmation link sends them to `/verify-email`.
- Recruiters sign in with their Supabase Auth account.
- Public talent browsing only shows published candidates.
