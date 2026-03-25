alter table public.profiles
  add column if not exists candidate_number text;

update public.profiles
set candidate_number = 'KT-' || upper(substr(replace(id::text, '-', ''), 1, 8))
where candidate_number is null or btrim(candidate_number) = '';

create unique index if not exists profiles_candidate_number_unique_idx
  on public.profiles (candidate_number)
  where candidate_number is not null;
