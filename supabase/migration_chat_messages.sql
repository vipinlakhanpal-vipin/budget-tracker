-- Migration: persist Chat BoT conversation history so it survives reloads
-- and can be picked back up later, instead of living only in memory for the
-- current browser tab. Per explicit choice: one continuous thread per
-- household (not per-person, not split into separate named sessions) --
-- everyone in the household reads and adds to the same running
-- conversation, same visibility model as the rest of the app's shared data.
-- Run this ONCE in the SQL Editor of your existing Supabase project.

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  -- Who actually sent it, for a 'user' row -- null for 'assistant' rows.
  -- Not shown in the chat bubbles themselves (kept as one flowing
  -- conversation, not attributed like the expense tables' "By" column),
  -- but kept on the row in case that's ever wanted later.
  created_by uuid references auth.users(id),
  created_by_email text,
  created_at timestamptz not null default now()
);
alter table chat_messages enable row level security;
create policy "member read chat_messages" on chat_messages
  for select using (household_id in (select household_id from household_members where user_id = auth.uid()));
create policy "member write chat_messages" on chat_messages
  for insert with check (household_id in (select household_id from household_members where user_id = auth.uid()));
-- Only needed for the "clear chat history" button in the Chat BoT header --
-- no update policy since a saved message is never edited, only ever
-- appended to or wiped entirely.
create policy "member delete chat_messages" on chat_messages
  for delete using (household_id in (select household_id from household_members where user_id = auth.uid()));

create index if not exists chat_messages_household_created_idx
  on chat_messages (household_id, created_at);
