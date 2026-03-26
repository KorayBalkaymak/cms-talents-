-- Recruiter/Admin dürfen externe Interessen-Anfragen löschen

drop policy if exists "Recruiters can delete inquiries" on public.candidate_inquiries;

create policy "Recruiters can delete inquiries"
on public.candidate_inquiries
for delete
using (public.is_recruiter_or_admin());

