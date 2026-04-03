-- Gesprochene Sprachen (Freitext) für manuell angelegte externe Kandidaten
alter table public.external_candidates
  add column if not exists languages text;

comment on column public.external_candidates.languages is
  'Freitext: welche Sprachen der Kandidat spricht (z. B. Deutsch, Englisch).';
