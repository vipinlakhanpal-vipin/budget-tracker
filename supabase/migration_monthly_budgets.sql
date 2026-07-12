-- Migration: per-month total budget, so the household's overall monthly
-- budget can vary month to month (exactly like Income and Savings already
-- do) instead of being one flat number that applies to every month forever.
-- Run this ONCE in the SQL Editor of your existing Supabase project.

-- One row per household per calendar month. "month" is stored as 'YYYY-MM'
-- text (same convention as Income/Savings' month drafts elsewhere in the
-- app), and the unique constraint means saving a new value for a month that
-- already has one is an upsert (update), not a duplicate row.
create table if not exists monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  month text not null,
  total_budget numeric not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (household_id, month)
);
alter table monthly_budgets enable row level security;
create policy "member read monthly_budgets" on monthly_budgets
  for select using (household_id in (select household_id from household_members where user_id = auth.uid()));
create policy "member write monthly_budgets" on monthly_budgets
  for insert with check (household_id in (select household_id from household_members where user_id = auth.uid()));
create policy "member update monthly_budgets" on monthly_budgets
  for update using (household_id in (select household_id from household_members where user_id = auth.uid()));
create policy "member delete monthly_budgets" on monthly_budgets
  for delete using (household_id in (select household_id from household_members where user_id = auth.uid()));

-- One-time backfill: carry the old flat total_monthly_budget (from
-- "settings") forward as the current month's value, so existing households
-- don't suddenly see a blank/zero budget after this migration runs.
insert into monthly_budgets (household_id, month, total_budget)
select household_id, to_char(now(), 'YYYY-MM'), total_monthly_budget
from settings
where total_monthly_budget is not null and total_monthly_budget > 0
on conflict (household_id, month) do nothing;
