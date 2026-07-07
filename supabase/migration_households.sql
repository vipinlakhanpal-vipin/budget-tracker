-- Migration: multi-household (multi-tenant) support
-- Run this ONCE in the SQL Editor of your existing Supabase project.
-- Safe to run on a project that already has data from the original schema.sql --
-- it migrates existing categories/expenses/recurring_expenses/settings into a
-- default household rather than deleting anything.

create extension if not exists "pgcrypto";

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'member',
  relation text not null default 'Self',
  joined_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create table if not exists household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  email text not null,
  relation text not null default 'Other',
  invited_by uuid references auth.users(id),
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- Income sources (e.g. each member's salary), tracked the same way as
-- recurring expenses so combined household income can be shown alongside
-- combined expenses for any given month.
create table if not exists incomes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  member_email text,
  amount numeric not null check (amount > 0),
  start_date date not null,
  end_date date,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table incomes enable row level security;
create policy "member read incomes" on incomes
  for select using (household_id in (select household_id from household_members where user_id = auth.uid()));
create policy "member write incomes" on incomes
  for insert with check (household_id in (select household_id from household_members where user_id = auth.uid()));
create policy "member update incomes" on incomes
  for update using (household_id in (select household_id from household_members where user_id = auth.uid()));
create policy "member delete incomes" on incomes
  for delete using (household_id in (select household_id from household_members where user_id = auth.uid()));

-- Create one default household to hold any pre-existing data, owned by
-- whichever user account is oldest.
insert into households (id, name, created_by)
select gen_random_uuid(), 'My Household', (select id from auth.users order by created_at limit 1)
where not exists (select 1 from households);

alter table categories add column if not exists household_id uuid references households(id);
alter table expenses add column if not exists household_id uuid references households(id);
alter table recurring_expenses add column if not exists household_id uuid references households(id);
alter table settings add column if not exists household_id uuid references households(id);

update categories set household_id = (select id from households order by created_at limit 1) where household_id is null;
update expenses set household_id = (select id from households order by created_at limit 1) where household_id is null;
update recurring_expenses set household_id = (select id from households order by created_at limit 1) where household_id is null;
update settings set household_id = (select id from households order by created_at limit 1) where household_id is null;

alter table categories alter column household_id set not null;
alter table expenses alter column household_id set not null;
alter table recurring_expenses alter column household_id set not null;
alter table settings alter column household_id set not null;

-- Category names now only need to be unique within a household
alter table categories drop constraint if exists categories_name_key;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'categories_household_name_key'
  ) then
    alter table categories add constraint categories_household_name_key unique (household_id, name);
  end if;
end $$;

-- Settings becomes one row per household instead of a single global row
alter table settings drop constraint if exists single_row;
alter table settings drop constraint if exists settings_pkey;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'settings_household_pkey'
  ) then
    alter table settings add constraint settings_household_pkey primary key (household_id);
  end if;
end $$;
alter table settings drop column if exists id;

-- Make every existing signed-up user a member of the default household so
-- nobody loses access to data they could already see.
insert into household_members (household_id, user_id, email, role, relation)
select
  (select id from households order by created_at limit 1),
  u.id,
  u.email,
  case when u.id = (select created_by from households order by created_at limit 1) then 'owner' else 'member' end,
  case when u.id = (select created_by from households order by created_at limit 1) then 'Self' else 'Other' end
from auth.users u
on conflict (household_id, user_id) do nothing;

alter table households enable row level security;
alter table household_members enable row level security;
alter table household_invites enable row level security;

-- Replace the old "any authenticated user" policies with household-scoped ones
drop policy if exists "authenticated read categories" on categories;
drop policy if exists "authenticated write categories" on categories;
drop policy if exists "authenticated update categories" on categories;
drop policy if exists "authenticated delete categories" on categories;
drop policy if exists "authenticated read expenses" on expenses;
drop policy if exists "authenticated write expenses" on expenses;
drop policy if exists "authenticated update expenses" on expenses;
drop policy if exists "authenticated delete expenses" on expenses;
drop policy if exists "authenticated read settings" on settings;
drop policy if exists "authenticated update settings" on settings;
drop policy if exists "authenticated read recurring_expenses" on recurring_expenses;
drop policy if exists "authenticated write recurring_expenses" on recurring_expenses;
drop policy if exists "authenticated update recurring_expenses" on recurring_expenses;
drop policy if exists "authenticated delete recurring_expenses" on recurring_expenses;

create policy "member read categories" on categories
  for select using (household_id in (select household_id from household_members where user_id = auth.uid()));
create policy "member write categories" on categories
  for insert with check (household_id in (select household_id from household_members where user_id = auth.uid()));
create policy "member update categories" on categories
  for update using (household_id in (select household_id from household_members where user_id = auth.uid()));
create policy "member delete categories" on categories
  for delete using (household_id in (select household_id from household_members where user_id = auth.uid()));

create policy "member read expenses" on expenses
  for select using (household_id in (select household_id from household_members where user_id = auth.uid()));
create policy "member write expenses" on expenses
  for insert with check (household_id in (select household_id from household_members where user_id = auth.uid()));
create policy "member update expenses" on expenses
  for update using (household_id in (select household_id from household_members where user_id = auth.uid()));
create policy "member delete expenses" on expenses
  for delete using (household_id in (select household_id from household_members where user_id = auth.uid()));

create policy "member read settings" on settings
  for select using (household_id in (select household_id from household_members where user_id = auth.uid()));
create policy "member insert settings" on settings
  for insert with check (household_id in (select household_id from household_members where user_id = auth.uid()));
create policy "member update settings" on settings
  for update using (household_id in (select household_id from household_members where user_id = auth.uid()));

create policy "member read recurring_expenses" on recurring_expenses
  for select using (household_id in (select household_id from household_members where user_id = auth.uid()));
create policy "member write recurring_expenses" on recurring_expenses
  for insert with check (household_id in (select household_id from household_members where user_id = auth.uid()));
create policy "member update recurring_expenses" on recurring_expenses
  for update using (household_id in (select household_id from household_members where user_id = auth.uid()));
create policy "member delete recurring_expenses" on recurring_expenses
  for delete using (household_id in (select household_id from household_members where user_id = auth.uid()));

create policy "members can read their households" on households
  for select using (id in (select household_id from household_members where user_id = auth.uid()));
create policy "authenticated users can create a household" on households
  for insert with check (created_by = auth.uid());

-- NOTE: a policy on household_members must NOT query household_members
-- directly in its USING clause -- Postgres re-applies the same policy to
-- that inner query, causing "infinite recursion detected in policy for
-- relation household_members". These SECURITY DEFINER functions bypass RLS
-- internally so the lookup doesn't recurse.
create or replace function my_household_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select household_id from household_members where user_id = auth.uid()
$$;

create or replace function my_owner_household_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select household_id from household_members where user_id = auth.uid() and role = 'owner'
$$;

create policy "members can read their household roster" on household_members
  for select using (household_id in (select my_household_ids()));
create policy "owners can update member relation" on household_members
  for update using (household_id in (select my_owner_household_ids()));
create policy "join own new household or accept an invite" on household_members
  for insert with check (
    user_id = auth.uid()
    and (
      exists (select 1 from households h where h.id = household_id and h.created_by = auth.uid())
      or exists (
        select 1 from household_invites hi
        where hi.household_id = household_members.household_id
          and lower(hi.email) = lower(auth.jwt() ->> 'email')
          and hi.status = 'pending'
      )
    )
  );

create policy "see invites for your household or addressed to you" on household_invites
  for select using (
    household_id in (select household_id from household_members where user_id = auth.uid())
    or lower(email) = lower(auth.jwt() ->> 'email')
  );
create policy "owners can create invites" on household_invites
  for insert with check (
    household_id in (select household_id from household_members where user_id = auth.uid() and role = 'owner')
  );
create policy "invited user can accept their invite" on household_invites
  for update using (lower(email) = lower(auth.jwt() ->> 'email'));
create policy "owners can cancel invites" on household_invites
  for delete using (
    household_id in (select household_id from household_members where user_id = auth.uid() and role = 'owner')
  );

-- Per-household display currency (e.g. AED, USD, INR). Defaults to AED.
alter table settings add column if not exists currency text not null default 'AED';

-- Recurring expense repeat cadence: monthly, alternate (every 2 months),
-- quarterly, half_yearly, or yearly. Defaults to monthly for existing rows.
alter table recurring_expenses add column if not exists frequency text not null default 'monthly';
