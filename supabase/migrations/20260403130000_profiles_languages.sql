-- Freitext: Sprachen, die der Kandidat beherrscht (Mein Profil)
alter table public.profiles
  add column if not exists languages text;

comment on column public.profiles.languages is
  'Freitext: gesprochene/beherrschte Sprachen (optional).';
