-- Migration: login tracking for the Admin Console
-- Run this ONCE in the SQL Editor of your existing Supabase project.
-- Powers the Users tab's "Device" and "Last seen" columns, and the small
-- "Recently: city, country -- city, country" travel hint under each user's
-- Last seen cell. A row is inserted client-side (src/App.jsx, trackLogin())
-- on every real sign-in -- best-effort only, so a blocked/offline network
-- request just means that one login shows up without a location, never a
-- broken login. "Last Login" itself needs no new column at all: Supabase
-- Auth already tracks auth.users.last_sign_in_at automatically, which
-- api/admin/users.js already returns as lastSignInAt.

create table if not exists login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  device_type text,   -- 'Mobile' | 'Tablet' | 'Desktop'
  os text,             -- 'iOS', 'Android', 'Windows', 'macOS', 'Linux', ...
  browser text,         -- 'Chrome', 'Safari', 'Firefox', 'Edge', 'Opera', ...
  city text,
  region text,
  country text,
  created_at timestamptz not null default now()
);

-- Fast "latest login per user" lookups (api/admin/users.js pulls every row
-- ordered newest-first and keeps the first one it sees per user_id).
create index if not exists login_events_user_id_created_at_idx
  on login_events (user_id, created_at desc);

alter table login_events enable row level security;

-- Users can only ever insert/read their OWN login history. The Admin
-- Console reads every user's login_events through api/admin/users.js,
-- which uses the service-role client (createAdminClient() in
-- api/admin/_auth.js) and so bypasses RLS entirely -- no admin-specific
-- policy is needed here.
create policy "users can insert their own login events" on login_events
  for insert with check (auth.uid() = user_id);
create policy "users can read their own login events" on login_events
  for select using (auth.uid() = user_id);
