-- Kopie von migrations/20260414110000_recruiter_chat_delete_policy.sql
-- Im Supabase-Dashboard: SQL -> New query -> einfügen -> Run

drop policy if exists "Recruiter can delete chat messages" on public.recruiter_chat_messages;

create policy "Recruiter can delete chat messages"
on public.recruiter_chat_messages
for delete
to authenticated
using (public.is_recruiter_or_admin());
