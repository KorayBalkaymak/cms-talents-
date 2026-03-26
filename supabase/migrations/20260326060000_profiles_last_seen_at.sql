-- User-Heartbeat für „Inaktiv seit …“ im Recruiter-Dashboard

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

comment on column public.profiles.last_seen_at is 'Letzter Client-Heartbeat (für Dashboard-Inaktivität / Offline-Anzeige).';

