-- Kopie von migrations/20260403000000_recruiter_allowlist_rls.sql
-- Im Supabase-Dashboard: SQL → New query → einfügen → Run
-- (DDL über den Pooler/6543 schlägt oft fehl; der SQL-Editor nutzt immer eine direkte Session.)

-- Recruiter-Zugriff auf candidate_inquiries (und andere is_recruiter_or_admin()-Policies)
-- muss mit der E-Mail-Allowlist in services/ApiClient.ts (RECRUITER_ROLE_BY_EMAIL) übereinstimmen.
-- Wenn profiles.role noch "candidate" ist, schlägt RLS fehl → leere Liste (besonders sichtbar ohne localStorage-Fallback).

create or replace function public.is_recruiter_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('recruiter', 'recruiter_admin'), false)
    or lower(coalesce(auth.jwt()->>'email', '')) in (
      'haagen@industries-cms.com',
      'hagen@industries-cms.com',
      'candau@industries-cms.com',
      'fuhrmann@industries-cms.com'
    );
$$;

update public.profiles
set
  role = case lower(email)
    when 'haagen@industries-cms.com' then 'recruiter_admin'
    when 'hagen@industries-cms.com' then 'recruiter'
    when 'candau@industries-cms.com' then 'recruiter'
    when 'fuhrmann@industries-cms.com' then 'recruiter'
    else role
  end,
  updated_at = now()
where lower(email) in (
  'haagen@industries-cms.com',
  'hagen@industries-cms.com',
  'candau@industries-cms.com',
  'fuhrmann@industries-cms.com'
);
