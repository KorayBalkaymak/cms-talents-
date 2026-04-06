-- Arbeitsumkreis für manuell angelegte externe Kandidaten (Recruiter „Kandidat hinzufügen“)

alter table public.external_candidates
  add column if not exists work_radius_km integer,
  add column if not exists work_area text;

comment on column public.external_candidates.work_radius_km is 'Arbeitsradius in km (+25 … +300), optional.';
comment on column public.external_candidates.work_area is 'Freitext z. B. Deutschlandweit, International, falls kein km-Radius.';
