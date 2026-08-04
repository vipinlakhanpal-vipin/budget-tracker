-- Category Groups -- user-defined groups for organizing categories
-- (e.g. "Etisalat" containing "Annie-Etisalat GSM", "Vipin-Etisalat GSM", "Home-Etisalat")
-- for better chart/report visibility (v2.81 feature).
-- Run this once in your Supabase project's SQL Editor (Project > SQL Editor > New query).
-- Until this runs, "+ Add group" in Settings > Groups & Category will fail with:
--   "Could not find the table 'public.category_groups' in the schema cache"

create extension if not exists "pgcrypto";

create table if not exists category_groups (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table categories add column if not exists group_id uuid references category_groups(id) on delete set null;

alter table category_groups enable row level security;

create policy "member read category_groups" on category_groups
  for select using (household_id in (select household_id from household_members where user_id = auth.uid()));
create policy "member write category_groups" on category_groups
  for insert with check (household_id in (select household_id from household_members where user_id = auth.uid()));
create policy "member update category_groups" on category_groups
  for update using (household_id in (select household_id from household_members where user_id = auth.uid()));
create policy "member delete category_groups" on category_groups
  for delete using (household_id in (select household_id from household_members where user_id = auth.uid()));
