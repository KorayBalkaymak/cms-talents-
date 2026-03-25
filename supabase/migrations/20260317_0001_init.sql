-- CMS Talents Supabase schema
-- Direct React -> Supabase setup with Auth, profiles, documents and audit logs.

create extension if not exists pgcrypto;

create table if not exists public.recruiter_allowlist (
  email text primary key,
  role text not null check (role in ('recruiter', 'recruiter_admin')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.recruiter_allowlist (email, role, active)
values
  ('haagen@industries-cms.com', 'recruiter_admin', true),
  ('candau@industries-cms.com', 'recruiter', true),
  ('fuhrmann@industries-cms.com', 'recruiter', true)
on conflict (email) do update
set role = excluded.role,
    active = excluded.active;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null check (role in ('candidate', 'recruiter', 'recruiter_admin')),
  first_name text not null default '',
  last_name text not null default '',
  city text not null default '',
  country text not null default '',
  address text,
  zip_code text,
  phone_number text,
  industry text not null default '',
  experience_years integer not null default 0,
  availability text not null default '',
  birth_year text,
  about text,
  profile_image_url text,
  avatar_seed text not null default '',
  status text not null default 'in Prüfung' check (status in ('aktiv', 'gesperrt', 'in Prüfung')),
  is_published boolean not null default false,
  is_submitted boolean not null default false,
  cv_reviewed_at timestamptz,
  cv_reviewed_by text,
  skills jsonb not null default '[]'::jsonb,
  boosted_keywords jsonb not null default '[]'::jsonb,
  social_links jsonb not null default '[]'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.candidate_documents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cv_pdf jsonb,
  certificates jsonb not null default '[]'::jsonb,
  qualifications jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  performer_id text not null,
  target_id text not null,
  timestamp timestamptz not null default now()
);

create table if not exists public.candidate_inquiries (
  id uuid primary key default gen_random_uuid(),
  candidate_user_id uuid not null references auth.users(id) on delete cascade,
  contact_name text not null,
  contact_email text not null,
  contact_phone text not null,
  message text,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists candidate_documents_set_updated_at on public.candidate_documents;
create trigger candidate_documents_set_updated_at
before update on public.candidate_documents
for each row
execute function public.set_updated_at();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and deleted_at is null
  limit 1;
$$;

create or replace function public.is_recruiter_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('recruiter', 'recruiter_admin'), false);
$$;

create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (old.email is distinct from new.email or old.role is distinct from new.role)
     and not public.is_recruiter_or_admin() then
    raise exception 'Not allowed';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_protect_privileged_fields on public.profiles;
create trigger profiles_protect_privileged_fields
before update on public.profiles
for each row
execute function public.protect_profile_privileged_fields();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text;
begin
  select coalesce(
    (select role from public.recruiter_allowlist where lower(email) = lower(new.email) and active limit 1),
    nullif(new.raw_user_meta_data->>'role', ''),
    'candidate'
  )
  into assigned_role;

  insert into public.profiles (
    id,
    email,
    role,
    first_name,
    last_name,
    city,
    country,
    address,
    zip_code,
    phone_number,
    industry,
    experience_years,
    availability,
    birth_year,
    about,
    profile_image_url,
    avatar_seed,
    status,
    is_published,
    is_submitted,
    cv_reviewed_at,
    cv_reviewed_by,
    skills,
    boosted_keywords,
    social_links,
    deleted_at
  ) values (
    new.id,
    new.email,
    assigned_role,
    '',
    '',
    '',
    '',
    null,
    null,
    null,
    '',
    0,
    '',
    null,
    null,
    null,
    left(new.id::text, 8),
    'in Prüfung',
    false,
    false,
    null,
    null,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    null
  );

  insert into public.candidate_documents (
    user_id,
    cv_pdf,
    certificates,
    qualifications
  ) values (
    new.id,
    null,
    '[]'::jsonb,
    '[]'::jsonb
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.candidate_documents enable row level security;
alter table public.audit_log enable row level security;
alter table public.candidate_inquiries enable row level security;

drop policy if exists "Public can read published profiles" on public.profiles;
create policy "Public can read published profiles"
on public.profiles
for select
using (deleted_at is null and is_published = true and status = 'aktiv');

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "Recruiters can read profiles" on public.profiles;
create policy "Recruiters can read profiles"
on public.profiles
for select
using (public.is_recruiter_or_admin());

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Recruiters can update profiles" on public.profiles;
create policy "Recruiters can update profiles"
on public.profiles
for update
using (public.is_recruiter_or_admin())
with check (public.is_recruiter_or_admin());

drop policy if exists "Public can read published documents" on public.candidate_documents;
create policy "Public can read published documents"
on public.candidate_documents
for select
using (
  exists (
    select 1
    from public.profiles p
    where p.id = candidate_documents.user_id
      and p.deleted_at is null
      and p.is_published = true
      and p.status = 'aktiv'
  )
);

drop policy if exists "Users can read own documents" on public.candidate_documents;
create policy "Users can read own documents"
on public.candidate_documents
for select
using (auth.uid() = user_id);

drop policy if exists "Recruiters can read documents" on public.candidate_documents;
create policy "Recruiters can read documents"
on public.candidate_documents
for select
using (public.is_recruiter_or_admin());

drop policy if exists "Users can manage own documents" on public.candidate_documents;
create policy "Users can manage own documents"
on public.candidate_documents
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Recruiters can manage documents" on public.candidate_documents;
create policy "Recruiters can manage documents"
on public.candidate_documents
for all
using (public.is_recruiter_or_admin())
with check (public.is_recruiter_or_admin());

drop policy if exists "Recruiters can read audit log" on public.audit_log;
create policy "Recruiters can read audit log"
on public.audit_log
for select
using (public.is_recruiter_or_admin());

drop policy if exists "Recruiters can insert audit log" on public.audit_log;
create policy "Recruiters can insert audit log"
on public.audit_log
for insert
with check (public.is_recruiter_or_admin());

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

-- Recruiter „Bearbeitung melden“ (Team-Sichtbarkeit); siehe auch 20260320000000_recruiter_editing_claim.sql
alter table public.profiles
  add column if not exists recruiter_editing_user_id uuid references auth.users (id) on delete set null,
  add column if not exists recruiter_editing_label text,
  add column if not exists recruiter_editing_at timestamptz;
