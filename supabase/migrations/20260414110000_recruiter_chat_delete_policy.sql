-- Recruiter/Admin dürfen Team-Chat-Nachrichten löschen

drop policy if exists "Recruiter can delete chat messages" on public.recruiter_chat_messages;

create policy "Recruiter can delete chat messages"
on public.recruiter_chat_messages
for delete
to authenticated
using (public.is_recruiter_or_admin());
