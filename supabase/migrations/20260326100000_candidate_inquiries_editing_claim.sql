-- Recruiter-Team-Sicht: Bearbeitungsstatus auf externen Interessenanfragen
alter table public.candidate_inquiries
  add column if not exists recruiter_editing_user_id uuid references auth.users(id) on delete set null,
  add column if not exists recruiter_editing_label text,
  add column if not exists recruiter_editing_at timestamptz;

drop policy if exists "Recruiters can update inquiries" on public.candidate_inquiries;
create policy "Recruiters can update inquiries"
on public.candidate_inquiries
for update
using (public.is_recruiter_or_admin())
with check (public.is_recruiter_or_admin());

