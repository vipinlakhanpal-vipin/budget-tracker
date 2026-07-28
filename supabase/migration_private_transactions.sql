-- Migration: opt-in private transactions
-- Run this ONCE in your Supabase project's SQL Editor (Project > SQL Editor > New query).
-- Safe to run on a project that already has data -- every new column
-- defaults to false, so nothing changes for anyone until a member
-- explicitly opts in from Settings and starts checking "Private" on new
-- entries. The app's own insert code already only sends is_private once a
-- member has opted in, so it's safe to run this migration and deploy the
-- matching app update in either order.

alter table household_members add column if not exists privacy_enabled boolean not null default false;

alter table expenses add column if not exists is_private boolean not null default false;
alter table recurring_expenses add column if not exists is_private boolean not null default false;
alter table incomes add column if not exists is_private boolean not null default false;
alter table savings_goals add column if not exists is_private boolean not null default false;

drop policy if exists "member read expenses" on expenses;
create policy "member read expenses" on expenses
  for select using (
    household_id in (select household_id from household_members where user_id = auth.uid())
    and (is_private = false or created_by = auth.uid())
  );

drop policy if exists "member read recurring_expenses" on recurring_expenses;
create policy "member read recurring_expenses" on recurring_expenses
  for select using (
    household_id in (select household_id from household_members where user_id = auth.uid())
    and (is_private = false or created_by = auth.uid())
  );

drop policy if exists "member read incomes" on incomes;
create policy "member read incomes" on incomes
  for select using (
    household_id in (select household_id from household_members where user_id = auth.uid())
    and (is_private = false or created_by = auth.uid())
  );

drop policy if exists "member read savings_goals" on savings_goals;
create policy "member read savings_goals" on savings_goals
  for select using (
    household_id in (select household_id from household_members where user_id = auth.uid())
    and (is_private = false or created_by = auth.uid())
  );
