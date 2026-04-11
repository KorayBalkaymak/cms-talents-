-- Team-Chat: Realtime (INSERT-Events), idempotent
do $migration$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'recruiter_chat_messages'
  ) then
    alter publication supabase_realtime add table public.recruiter_chat_messages;
  end if;
end;
$migration$;
