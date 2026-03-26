-- Gehaltswunsch + Arbeitsumkreis

alter table public.profiles
  add column if not exists salary_wish_eur integer,
  add column if not exists work_radius_km integer,
  add column if not exists work_area text;

comment on column public.profiles.salary_wish_eur is 'Gehaltswunsch in EUR (optional).';
comment on column public.profiles.work_radius_km is 'Arbeitsradius in km (optional).';
comment on column public.profiles.work_area is 'Arbeitsumgebung/Region (optional).';

