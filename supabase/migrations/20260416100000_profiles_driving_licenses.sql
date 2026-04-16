alter table public.profiles
  add column if not exists driving_licenses jsonb not null default '[]'::jsonb;

comment on column public.profiles.driving_licenses is
  'Ausgewaehlte Fuehrerscheinklassen und Berechtigungen des Kandidaten.';
