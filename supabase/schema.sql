-- Monthly Budget Tracker -- Supabase schema
-- Run this once in your Supabase project's SQL Editor (Project > SQL Editor > New query).
-- Shared household model: all invited users see and edit the same data.

create extension if not exists "pgcrypto";

-- Categories (e.g. Groceries, Rent, Utilities) with an optional per-category monthly budget
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  monthly_budget numeric not null default 0,
  created_at timestamptz not null default now()
  );

-- Expenses logged by any household member
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  category_id uuid references categories(id) on delete set null,
  description text,
  amount numeric not null check (amount > 0),
  created_by uuid references auth.users(id),
  created_by_email text,
  created_at timestamptz not null default now()
  );

-- Single-row table holding the overall monthly budget
create table if not exists settings (
  id int primary key default 1,
  total_monthly_budget numeric not null default 0,
  constraint single_row check (id = 1)
  );
insert into settings (id, total_monthly_budget) values (1, 0)
on conflict (id) do nothing;

-- Fixed monthly commitments: loans, EMIs, credit card installments.
create table if not exists recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references categories(id) on delete set null,
  amount numeric not null check (amount > 0),
  start_date date not null,
  end_date date,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
  );

-- Seed a few starter categories (safe to edit/delete later from the app)
insert into categories (name) values
('Groceries'), ('Rent/Mortgage'), ('Utilities'), ('Transportation'),
('Dining Out'), ('Entertainment'), ('Health'), ('Shopping'),
('Loan EMI'), ('Credit Card EMI'), ('Other')
on conflict (name) do nothing;

-- Row Level Security: only signed-in (invited) users can read/write anything.
alter table categories enable row level security;
alter table expenses enable row level security;
alter table settings enable row level security;
alter table recurring_expenses enable row level security;

create policy "authenticated read categories" on categories
for select using (auth.role() = 'authenticated');
create policy "authenticated write categories" on categories
for insert with check (auth.role() = 'authenticated');
create policy "authenticated update categories" on categories
for update using (auth.role() = 'authenticated');
create policy "authenticated delete categories" on categories
for delete using (auth.role() = 'authenticated');

create policy "authenticated read expenses" on expenses
for select using (auth.role() = 'authenticated');
create policy "authenticated write expenses" on expenses
for insert with check (auth.role() = 'authenticated');
create policy "authenticated update expenses" on expenses
for update using (auth.role() = 'authenticated');
create policy "authenticated delete expenses" on expenses
for delete using (auth.role() = 'authenticated');

create policy "authenticated read settings" on settings
for select using (auth.role() = 'authenticated');
create policy "authenticated update settings" on settings
for update using (auth.role() = 'authenticated');

create policy "authenticated read recurring_expenses" on recurring_expenses
for select using (auth.role() = 'authenticated');
create policy "authenticated write recurring_expenses" on recurring_expenses
for insert with check (auth.role() = 'authenticated');
create policy "authenticated update recurring_expenses" on recurring_expenses
for update using (auth.role() = 'authenticated');
create policy "authenticated delete recurring_expenses" on recurring_expenses
for delete using (auth.role() = 'authenticated');
