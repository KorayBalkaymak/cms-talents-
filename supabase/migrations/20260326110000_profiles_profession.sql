-- Beruf/Jobtitel im Kandidatenprofil
alter table public.profiles
  add column if not exists profession text;

comment on column public.profiles.profession is
  'Freitext-Beruf/Jobtitel im Mein-Profil (optional).';

