alter table public.profiles enable row level security;

drop policy if exists "Public can read published profiles" on public.profiles;
create policy "Public can read published profiles"
on public.profiles
for select
using (deleted_at is null and is_published = true and status = 'aktiv');

do $$
begin
  if to_regclass('public.external_candidates') is not null then
    alter table public.external_candidates enable row level security;

    drop policy if exists "Public can read published external candidates" on public.external_candidates;
    create policy "Public can read published external candidates"
    on public.external_candidates
    for select
    using (is_published = true);
  end if;
end $$;
