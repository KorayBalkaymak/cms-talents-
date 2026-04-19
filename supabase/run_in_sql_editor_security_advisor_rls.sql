-- Fix fuer Supabase Security Advisor:
-- "RLS Disabled in Public" auf alten Legacy-Tabellen.
--
-- Im Supabase Dashboard ausfuehren:
-- SQL Editor -> New query -> kompletten Inhalt einfuegen -> Run.
--
-- Hinweis:
-- Die aktuelle CMS-Talents-App nutzt primär public.profiles, public.candidate_documents,
-- public.candidate_inquiries, public.external_candidates und public.audit_log.
-- Die Tabellen unten stammen aus einem aelteren/normalisierten Schema. RLS wird hier
-- aktiviert, damit sie nicht offen ueber PostgREST lesbar/schreibbar sind.

do $$
begin
  if to_regclass('public.users') is not null then
    alter table public.users enable row level security;

    -- public.users enthaelt im Legacy-Schema password_hash und bleibt deshalb
    -- bewusst ohne Client-Policy. Service-role/Admin im SQL Editor bleibt nutzbar.
    drop policy if exists "Users can read own legacy user" on public.users;
    drop policy if exists "Recruiters can read legacy users" on public.users;
  end if;
end $$;

do $$
begin
  if to_regclass('public.candidate_profiles') is not null then
    alter table public.candidate_profiles enable row level security;

    drop policy if exists "Public can read published legacy candidate profiles" on public.candidate_profiles;
    create policy "Public can read published legacy candidate profiles"
    on public.candidate_profiles
    for select
    using (is_published = 1 and status = 'aktiv');

    drop policy if exists "Recruiters can manage legacy candidate profiles" on public.candidate_profiles;
    create policy "Recruiters can manage legacy candidate profiles"
    on public.candidate_profiles
    for all
    using (public.is_recruiter_or_admin())
    with check (public.is_recruiter_or_admin());
  end if;
end $$;

do $$
begin
  if to_regclass('public.candidate_skills') is not null then
    alter table public.candidate_skills enable row level security;

    drop policy if exists "Public can read published legacy candidate skills" on public.candidate_skills;
    create policy "Public can read published legacy candidate skills"
    on public.candidate_skills
    for select
    using (
      exists (
        select 1
        from public.candidate_profiles p
        where p.user_id = candidate_skills.user_id
          and p.is_published = 1
          and p.status = 'aktiv'
      )
    );

    drop policy if exists "Recruiters can manage legacy candidate skills" on public.candidate_skills;
    create policy "Recruiters can manage legacy candidate skills"
    on public.candidate_skills
    for all
    using (public.is_recruiter_or_admin())
    with check (public.is_recruiter_or_admin());
  end if;
end $$;

do $$
begin
  if to_regclass('public.candidate_keywords') is not null then
    alter table public.candidate_keywords enable row level security;

    drop policy if exists "Public can read published legacy candidate keywords" on public.candidate_keywords;
    create policy "Public can read published legacy candidate keywords"
    on public.candidate_keywords
    for select
    using (
      exists (
        select 1
        from public.candidate_profiles p
        where p.user_id = candidate_keywords.user_id
          and p.is_published = 1
          and p.status = 'aktiv'
      )
    );

    drop policy if exists "Recruiters can manage legacy candidate keywords" on public.candidate_keywords;
    create policy "Recruiters can manage legacy candidate keywords"
    on public.candidate_keywords
    for all
    using (public.is_recruiter_or_admin())
    with check (public.is_recruiter_or_admin());
  end if;
end $$;

do $$
begin
  if to_regclass('public.candidate_social_links') is not null then
    alter table public.candidate_social_links enable row level security;

    drop policy if exists "Public can read published legacy candidate social links" on public.candidate_social_links;
    create policy "Public can read published legacy candidate social links"
    on public.candidate_social_links
    for select
    using (
      exists (
        select 1
        from public.candidate_profiles p
        where p.user_id = candidate_social_links.user_id
          and p.is_published = 1
          and p.status = 'aktiv'
      )
    );

    drop policy if exists "Recruiters can manage legacy candidate social links" on public.candidate_social_links;
    create policy "Recruiters can manage legacy candidate social links"
    on public.candidate_social_links
    for all
    using (public.is_recruiter_or_admin())
    with check (public.is_recruiter_or_admin());
  end if;
end $$;

do $$
begin
  if to_regclass('public.recruiter_allowlist') is not null then
    alter table public.recruiter_allowlist enable row level security;

    -- Recruiter/Admin duerfen Allowlist sehen und pflegen.
    -- public.is_recruiter_or_admin() nutzt diese Tabelle per SECURITY DEFINER weiterhin stabil.
    drop policy if exists "Recruiters can read recruiter allowlist" on public.recruiter_allowlist;
    create policy "Recruiters can read recruiter allowlist"
    on public.recruiter_allowlist
    for select
    using (public.is_recruiter_or_admin());

    drop policy if exists "Recruiter admins can manage recruiter allowlist" on public.recruiter_allowlist;
    create policy "Recruiter admins can manage recruiter allowlist"
    on public.recruiter_allowlist
    for all
    using (public.current_user_role() = 'recruiter_admin')
    with check (public.current_user_role() = 'recruiter_admin');
  end if;
end $$;

-- Kontrolle: Diese Tabellen sollten danach relrowsecurity = true haben.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'users',
    'candidate_profiles',
    'candidate_skills',
    'candidate_keywords',
    'candidate_social_links',
    'recruiter_allowlist'
  )
order by c.relname;
