-- =============================================================================
-- EINMALIG in Supabase ausführen: Dashboard „Bearbeitung melden“
-- Dashboard → SQL Editor → New query → diesen Inhalt einfügen → RUN
--
-- Behebt: "Could not find the 'recruiter_editing_at' column of 'profiles'"
-- =============================================================================

alter table public.profiles
  add column if not exists recruiter_editing_user_id uuid references auth.users (id) on delete set null,
  add column if not exists recruiter_editing_label text,
  add column if not exists recruiter_editing_at timestamptz;

-- Falls die Zeile mit REFERENCES fehlschlägt, stattdessen nur UUID ohne FK:
-- alter table public.profiles add column if not exists recruiter_editing_user_id uuid;
-- alter table public.profiles add column if not exists recruiter_editing_label text;
-- alter table public.profiles add column if not exists recruiter_editing_at timestamptz;

comment on column public.profiles.recruiter_editing_user_id is 'Recruiter, der das Profil zur Bearbeitung gemeldet hat';
comment on column public.profiles.recruiter_editing_label is 'Anzeigename für das Team';
comment on column public.profiles.recruiter_editing_at is 'Zeitpunkt der Meldung';
