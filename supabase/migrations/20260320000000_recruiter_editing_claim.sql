-- Recruiter: „Bearbeitung melden“ – für andere im Dashboard sichtbar (nach init)
alter table public.profiles
  add column if not exists recruiter_editing_user_id uuid references auth.users (id) on delete set null,
  add column if not exists recruiter_editing_label text,
  add column if not exists recruiter_editing_at timestamptz;

comment on column public.profiles.recruiter_editing_user_id is 'Recruiter (auth.users.id), der das Kandidatenprofil zur Bearbeitung gemeldet hat';
comment on column public.profiles.recruiter_editing_label is 'Anzeigename für das Team (z. B. Vorname oder E-Mail-Localpart)';
comment on column public.profiles.recruiter_editing_at is 'Zeitpunkt der Meldung; nach einigen Stunden im UI als veraltet behandelt';
