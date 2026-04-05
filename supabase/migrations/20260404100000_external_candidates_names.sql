-- Interne Erfassung Vor-/Nachname (Marktplatz zeigt weiter Codename über ApiClient.toMarketplaceCodename)
alter table public.external_candidates
  add column if not exists first_name text,
  add column if not exists last_name text;

comment on column public.external_candidates.first_name is 'Intern für Recruiter; nicht als Klartext auf dem Marktplatz.';
comment on column public.external_candidates.last_name is 'Intern für Recruiter; nicht als Klartext auf dem Marktplatz.';
