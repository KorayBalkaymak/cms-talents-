-- Recruiter Dashboard: Verfügbarkeitskalender + Team-Chat

create table if not exists public.recruiter_availability_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 200),
  scheduled_for timestamptz not null,
  note text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_by_label text not null default 'Recruiter',
  created_at timestamptz not null default now()
);

create index if not exists recruiter_availability_events_scheduled_for_idx
  on public.recruiter_availability_events (scheduled_for asc);

create table if not exists public.recruiter_chat_messages (
  id uuid primary key default gen_random_uuid(),
  message text not null check (char_length(trim(message)) between 1 and 4000),
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_label text not null default 'Recruiter',
  created_at timestamptz not null default now()
);

create index if not exists recruiter_chat_messages_created_at_idx
  on public.recruiter_chat_messages (created_at desc);

alter table public.recruiter_availability_events enable row level security;
alter table public.recruiter_chat_messages enable row level security;

drop policy if exists "Recruiter can read availability events" on public.recruiter_availability_events;
create policy "Recruiter can read availability events"
  on public.recruiter_availability_events
  for select
  to authenticated
  using (public.is_recruiter_or_admin());

drop policy if exists "Recruiter can insert availability events" on public.recruiter_availability_events;
create policy "Recruiter can insert availability events"
  on public.recruiter_availability_events
  for insert
  to authenticated
  with check (public.is_recruiter_or_admin());

drop policy if exists "Recruiter can delete availability events" on public.recruiter_availability_events;
create policy "Recruiter can delete availability events"
  on public.recruiter_availability_events
  for delete
  to authenticated
  using (public.is_recruiter_or_admin());

drop policy if exists "Recruiter can read chat messages" on public.recruiter_chat_messages;
create policy "Recruiter can read chat messages"
  on public.recruiter_chat_messages
  for select
  to authenticated
  using (public.is_recruiter_or_admin());

drop policy if exists "Recruiter can insert chat messages" on public.recruiter_chat_messages;
create policy "Recruiter can insert chat messages"
  on public.recruiter_chat_messages
  for insert
  to authenticated
  with check (public.is_recruiter_or_admin());
