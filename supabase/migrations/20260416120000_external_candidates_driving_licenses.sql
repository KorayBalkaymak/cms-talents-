alter table public.external_candidates
  add column if not exists driving_licenses jsonb not null default '[]'::jsonb;

comment on column public.external_candidates.driving_licenses is
  'Ausgewaehlte Fuehrerscheinklassen und Berechtigungen fuer vom Recruiter hinzugefuegte Kandidaten.';
