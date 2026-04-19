-- Fix fuer Dashboard: Recruiter sieht nur 2 statt alle Kandidaten/Nutzer.
-- Ursache: RLS erkennt den eingeloggten Account nicht sicher als Recruiter/Admin.
-- Im Supabase Dashboard ausfuehren: SQL Editor -> New query -> kompletten Inhalt einfuegen -> Run.

insert into public.recruiter_allowlist (email, role, active)
values
  ('haagen@industries-cms.com', 'recruiter_admin', true),
  ('hagen@industries-cms.com', 'recruiter', true),
  ('candau@industries-cms.com', 'recruiter', true),
  ('fuhrmann@industries-cms.com', 'recruiter', true)
on conflict (email) do update
set
  role = excluded.role,
  active = true;

update public.profiles
set
  role = case lower(email)
    when 'haagen@industries-cms.com' then 'recruiter_admin'
    when 'hagen@industries-cms.com' then 'recruiter'
    when 'candau@industries-cms.com' then 'recruiter'
    when 'fuhrmann@industries-cms.com' then 'recruiter'
    else role
  end,
  deleted_at = null,
  updated_at = now()
where lower(email) in (
  'haagen@industries-cms.com',
  'hagen@industries-cms.com',
  'candau@industries-cms.com',
  'fuhrmann@industries-cms.com'
);

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.role
      from public.profiles p
      where p.id = auth.uid()
        and p.deleted_at is null
      limit 1
    ),
    (
      select ra.role
      from public.recruiter_allowlist ra
      where lower(ra.email) = lower(coalesce(auth.jwt()->>'email', ''))
        and ra.active = true
      limit 1
    )
  );
$$;

create or replace function public.is_recruiter_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('recruiter', 'recruiter_admin'), false)
    or exists (
      select 1
      from public.recruiter_allowlist ra
      where lower(ra.email) = lower(coalesce(auth.jwt()->>'email', ''))
        and ra.active = true
        and ra.role in ('recruiter', 'recruiter_admin')
    );
$$;

grant execute on function public.current_user_role() to anon, authenticated;
grant execute on function public.is_recruiter_or_admin() to anon, authenticated;

alter table public.profiles enable row level security;

drop policy if exists "Recruiters can read profiles" on public.profiles;
create policy "Recruiters can read profiles"
on public.profiles
for select
using (public.is_recruiter_or_admin());

drop policy if exists "Recruiters can update profiles" on public.profiles;
create policy "Recruiters can update profiles"
on public.profiles
for update
using (public.is_recruiter_or_admin())
with check (public.is_recruiter_or_admin());

alter table public.candidate_documents enable row level security;

drop policy if exists "Recruiters can read documents" on public.candidate_documents;
create policy "Recruiters can read documents"
on public.candidate_documents
for select
using (public.is_recruiter_or_admin());

drop policy if exists "Recruiters can manage documents" on public.candidate_documents;
create policy "Recruiters can manage documents"
on public.candidate_documents
for all
using (public.is_recruiter_or_admin())
with check (public.is_recruiter_or_admin());

do $$
begin
  if to_regclass('public.external_candidates') is not null then
    alter table public.external_candidates enable row level security;

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

    drop policy if exists "Recruiters can delete external candidates" on public.external_candidates;
    create policy "Recruiters can delete external candidates"
    on public.external_candidates
    for delete
    using (public.is_recruiter_or_admin());
  end if;
end $$;

create table if not exists public.candidate_inquiries (
  id uuid primary key default gen_random_uuid(),
  candidate_user_id uuid,
  contact_name text not null,
  contact_email text not null,
  contact_phone text not null,
  message text,
  customer_attachments jsonb not null default '[]'::jsonb,
  recruiter_editing_user_id uuid,
  recruiter_editing_label text,
  recruiter_editing_at timestamptz,
  created_at timestamptz not null default now()
);

do $$
begin
  if to_regclass('public.candidate_inquiries') is not null then
    alter table public.candidate_inquiries enable row level security;

    alter table public.candidate_inquiries
      alter column candidate_user_id drop not null;

    alter table public.candidate_inquiries
      add column if not exists customer_attachments jsonb not null default '[]'::jsonb,
      add column if not exists recruiter_editing_user_id uuid,
      add column if not exists recruiter_editing_label text,
      add column if not exists recruiter_editing_at timestamptz;

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

    drop policy if exists "Recruiters can update inquiries" on public.candidate_inquiries;
    create policy "Recruiters can update inquiries"
    on public.candidate_inquiries
    for update
    using (public.is_recruiter_or_admin())
    with check (public.is_recruiter_or_admin());

    drop policy if exists "Recruiters can delete inquiries" on public.candidate_inquiries;
    create policy "Recruiters can delete inquiries"
    on public.candidate_inquiries
    for delete
    using (public.is_recruiter_or_admin());
  end if;
end $$;

-- Kontrolle nach dem Run:
-- is_recruiter_or_admin muss true sein.
select public.is_recruiter_or_admin() as is_recruiter_or_admin;

-- Diese Zahl muss alle nicht geloeschten Profile zeigen, nicht nur 2.
select count(*) as profiles_visible_for_this_recruiter
from public.profiles
where deleted_at is null;

-- Diese Zahl muss die manuell hinzugefuegten Recruiter-Kandidaten zeigen.
select count(*) as external_candidates_visible_for_this_recruiter
from public.external_candidates;

-- Diese Zahl muss die externen Interessen zeigen.
select count(*) as candidate_inquiries_visible_for_this_recruiter
from public.candidate_inquiries;
