-- Allgemeine Marktplatz-Anfragen (ohne Bezug zu einem konkreten Profil)
alter table public.candidate_inquiries
  alter column candidate_user_id drop not null;

comment on column public.candidate_inquiries.candidate_user_id is
  'Optional: Bezug zum Kandidatenprofil. NULL = allgemeine Suchanfrage vom Marktplatz.';
