alter table public.external_candidates
  add column if not exists profession text;

comment on column public.external_candidates.profession is
  'Beruf / Jobtitel; sichtbar im Marktplatz wie bei regulären Profilen.';
