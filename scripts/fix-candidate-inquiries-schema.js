#!/usr/bin/env node
import fs from 'fs';
import { Client } from 'pg';

const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/^DATABASE_URL\s*=\s*(.+)$/m);
if (!match) {
  console.error('DATABASE_URL fehlt in .env');
  process.exit(1);
}

const connectionString = match[1].trim();

const sql = `
create table if not exists public.candidate_inquiries (
  id uuid primary key default gen_random_uuid(),
  candidate_user_id uuid not null references auth.users(id) on delete cascade,
  contact_name text not null,
  contact_email text not null,
  contact_phone text not null,
  message text,
  created_at timestamptz not null default now()
);

create or replace function public.is_recruiter_or_admin()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  has_profiles boolean;
  has_candidate_profiles boolean;
  ok boolean;
begin
  select to_regclass('public.profiles') is not null into has_profiles;
  select to_regclass('public.candidate_profiles') is not null into has_candidate_profiles;

  if has_profiles then
    select exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('recruiter', 'recruiter_admin')
        and p.deleted_at is null
    ) into ok;
    return coalesce(ok, false);
  elsif has_candidate_profiles then
    select exists (
      select 1
      from public.users u
      where u.id = auth.uid()::text
        and u.role in ('recruiter', 'recruiter_admin')
    ) into ok;
    return coalesce(ok, false);
  end if;

  return false;
end;
$$;

alter table public.candidate_inquiries enable row level security;

drop policy if exists "Public can insert inquiries" on public.candidate_inquiries;
create policy "Public can insert inquiries"
on public.candidate_inquiries
for insert
with check (true);

drop policy if exists "Recruiters can read inquiries" on public.candidate_inquiries;
create policy "Recruiters can read inquiries"
on public.candidate_inquiries
for select
using (public.is_recruiter_or_admin());

-- Supabase PostgREST schema cache aktualisieren
notify pgrst, 'reload schema';
`;

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  console.log('candidate_inquiries + policies erfolgreich eingerichtet.');
} catch (err) {
  console.error('Fehler beim Einrichten:', err?.message || err);
  process.exitCode = 1;
} finally {
  await client.end();
}
