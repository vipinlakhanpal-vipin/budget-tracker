-- Migration: support MULTIPLE attachments per row (was one attachment_url +
-- attachment_name column per row -- a single document per expense/income/
-- fixed-expense/savings entry). Run this ONCE in the SQL Editor of your
-- existing Supabase project, AFTER migration_attachments.sql.
--
-- Design: a single join table instead of a jsonb array column, so each
-- attachment keeps its own row (id, uploader, timestamp) and the existing
-- `attachments` STORAGE BUCKET + its RLS policies (from migration_attachments.sql,
-- keyed off the household_id folder prefix) are reused unchanged -- only the
-- database side needs a new table to track "this row now has N files"
-- instead of just one.

create table if not exists row_attachments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  table_name text not null check (table_name in ('expenses', 'recurring_expenses', 'incomes', 'savings_goals')),
  row_id uuid not null,
  storage_path text not null,
  file_name text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create index if not exists row_attachments_lookup_idx on row_attachments (table_name, row_id);
create index if not exists row_attachments_household_idx on row_attachments (household_id);

alter table row_attachments enable row level security;

-- Reuses the same my_household_ids() security-definer function every other
-- household-scoped table's policies already use (see migration_households.sql)
-- rather than querying household_members directly, to avoid the recursion
-- issue documented there.
drop policy if exists "member read row_attachments" on row_attachments;
drop policy if exists "member write row_attachments" on row_attachments;
drop policy if exists "member delete row_attachments" on row_attachments;

create policy "member read row_attachments" on row_attachments
  for select using (household_id in (select my_household_ids()));
create policy "member write row_attachments" on row_attachments
  for insert with check (household_id in (select my_household_ids()));
create policy "member delete row_attachments" on row_attachments
  for delete using (household_id in (select my_household_ids()));

-- Backfill: every row that already has a single attachment_url gets a
-- matching row_attachments entry, so nothing already uploaded is lost once
-- the app switches to reading from this table instead of the old columns.
-- Safe to re-run -- it only inserts rows that don't already have a matching
-- row_attachments entry for that exact storage_path.
insert into row_attachments (household_id, table_name, row_id, storage_path, file_name, created_at)
select e.household_id, 'expenses', e.id, e.attachment_url, coalesce(e.attachment_name, 'attachment'), e.created_at
from expenses e
where e.attachment_url is not null
  and not exists (
    select 1 from row_attachments ra
    where ra.table_name = 'expenses' and ra.row_id = e.id and ra.storage_path = e.attachment_url
  );

insert into row_attachments (household_id, table_name, row_id, storage_path, file_name, created_at)
select r.household_id, 'recurring_expenses', r.id, r.attachment_url, coalesce(r.attachment_name, 'attachment'), r.created_at
from recurring_expenses r
where r.attachment_url is not null
  and not exists (
    select 1 from row_attachments ra
    where ra.table_name = 'recurring_expenses' and ra.row_id = r.id and ra.storage_path = r.attachment_url
  );

insert into row_attachments (household_id, table_name, row_id, storage_path, file_name, created_at)
select i.household_id, 'incomes', i.id, i.attachment_url, coalesce(i.attachment_name, 'attachment'), i.created_at
from incomes i
where i.attachment_url is not null
  and not exists (
    select 1 from row_attachments ra
    where ra.table_name = 'incomes' and ra.row_id = i.id and ra.storage_path = i.attachment_url
  );

insert into row_attachments (household_id, table_name, row_id, storage_path, file_name, created_at)
select s.household_id, 'savings_goals', s.id, s.attachment_url, coalesce(s.attachment_name, 'attachment'), s.created_at
from savings_goals s
where s.attachment_url is not null
  and not exists (
    select 1 from row_attachments ra
    where ra.table_name = 'savings_goals' and ra.row_id = s.id and ra.storage_path = s.attachment_url
  );

-- NOTE: the old attachment_url/attachment_name columns on each of the 4
-- tables are intentionally left in place (not dropped) -- harmless once the
-- app stops reading/writing them, and keeping them avoids any risk to
-- historical data if something needs to be cross-checked later.
