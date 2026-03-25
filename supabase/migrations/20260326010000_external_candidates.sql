create table if not exists public.external_candidates (
  id uuid primary key default gen_random_uuid(),
  candidate_number text,
  city text not null default '',
  country text not null default '',
  industry text not null default '',
  experience_years integer not null default 0,
  availability text not null default '',
  about text,
  skills jsonb not null default '[]'::jsonb,
  boosted_keywords jsonb not null default '[]'::jsonb,
  cv_pdf jsonb,
  certificates jsonb not null default '[]'::jsonb,
  qualifications jsonb not null default '[]'::jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.external_candidates enable row level security;

drop policy if exists "Public can read published external candidates" on public.external_candidates;
create policy "Public can read published external candidates"
on public.external_candidates
for select
using (is_published = true);

drop policy if exists "Recruiters can read external candidates" on public.external_candidates;
create policy "Recruiters can read external candidates"
on public.external_candidates
for select
using (public.is_recruiter_or_admin());

drop policy if exists "Recruiters can insert external candidates" on public.external_candidates;
create policy "Recruiters can insert external candidates"
on public.external_candidates
for insert
with check (public.is_recruiter_or_admin());

drop policy if exists "Recruiters can update external candidates" on public.external_candidates;
create policy "Recruiters can update external candidates"
on public.external_candidates
for update
using (public.is_recruiter_or_admin())
with check (public.is_recruiter_or_admin());

drop trigger if exists external_candidates_set_updated_at on public.external_candidates;
create trigger external_candidates_set_updated_at
before update on public.external_candidates
for each row
execute function public.set_updated_at();
