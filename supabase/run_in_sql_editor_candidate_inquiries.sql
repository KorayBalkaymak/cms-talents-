-- Führe dieses SQL im Supabase Dashboard -> SQL Editor aus,
-- wenn beim Interesse-Formular der Fehler
-- "Could not find the table 'public.candidate_inquiries' in the schema cache"
-- erscheint.

create table if not exists public.candidate_inquiries (
  id uuid primary key default gen_random_uuid(),
  candidate_user_id uuid not null references auth.users(id) on delete cascade,
  contact_name text not null,
  contact_email text not null,
  contact_phone text not null,
  message text,
  created_at timestamptz not null default now()
);

alter table public.candidate_inquiries enable row level security;

drop policy if exists "Public can insert inquiries" on public.candidate_inquiries;
create policy "Public can insert inquiries"
on public.candidate_inquiries
for insert
with check (true);

drop policy if exists "Recruiters can read inquiries" on public.candidate_inquiries;
create policy "Recruiters can read inquiries"
on public.candidate_inquiries
for select
using (public.is_recruiter_or_admin());
