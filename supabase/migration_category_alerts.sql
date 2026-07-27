-- Migration: per-category budget threshold alert tracking, so the daily
-- cron (api/cron/rent-reminders.js, extended to also check category budgets)
-- can email a household once when a category crosses 35%/60%/100% of its
-- monthly budget, then keep emailing once a day (not spammier than that)
-- for as long as it stays over 100%, until the month rolls over.
-- Run this ONCE in the SQL Editor of your existing Supabase project.

create table if not exists category_alert_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  month text not null, -- 'YYYY-MM', same convention as monthly_budgets/income/savings
  -- 35 / 60 / 100 are sent once each per household+category+month. 999 is a
  -- separate "still over budget" marker whose last_sent_date is re-checked
  -- (and bumped) once a day for as long as the category stays over 100%.
  threshold int not null,
  last_sent_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (household_id, category_id, month, threshold)
);
alter table category_alert_log enable row level security;
-- Read-only for household members (mirrors other per-household tables);
-- all writes happen via the admin-key cron job, not client code.
create policy "member read category_alert_log" on category_alert_log
  for select using (household_id in (select household_id from household_members where user_id = auth.uid()));
