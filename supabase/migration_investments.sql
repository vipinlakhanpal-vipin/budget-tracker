-- Migration: private Investments tab (Fixed Deposits + Mutual Fund / SIP)
-- Run this ONCE in your Supabase project's SQL Editor (Project > SQL Editor > New query).
-- This table is intentionally NOT shared with the rest of the household --
-- the row-level security policies below only ever let the row's own
-- creator read/write it, regardless of household_id. That's what keeps
-- the Investments tab private to whoever added each entry (in practice,
-- just Vipin -- the app's UI only shows this tab to his account, and this
-- migration makes that private-by-default even if the UI check were ever
-- bypassed).

create table if not exists investments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_by_email text,
  investment_type text not null check (investment_type in ('Fixed Deposit', 'Mutual Fund')),
  name text not null,
  institution text,
  principal_amount numeric not null default 0,
  current_value numeric,
  interest_rate numeric,
  sip_amount numeric,
  start_date date,
  maturity_date date,
  status text not null default 'Active',
  created_at timestamptz not null default now()
);

alter table investments enable row level security;

create policy "owner read investments" on investments
  for select using (created_by = auth.uid());
create policy "owner write investments" on investments
  for insert with check (created_by = auth.uid());
create policy "owner update investments" on investments
  for update using (created_by = auth.uid());
create policy "owner delete investments" on investments
  for delete using (created_by = auth.uid());
