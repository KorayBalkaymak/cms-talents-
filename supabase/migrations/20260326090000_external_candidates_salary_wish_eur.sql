-- Wunschgehalt (EUR) für externe Kandidaten
alter table public.external_candidates
  add column if not exists salary_wish_eur integer;

comment on column public.external_candidates.salary_wish_eur is
  'Gehaltswunsch in EUR (optional).';

