-- Adds a Payment Source (Cash / Credit Card / Debit Card) + optional bank
-- name to both one-off expenses and fixed/recurring expenses.
-- Safe to run multiple times (IF NOT EXISTS guards).

alter table expenses add column if not exists payment_source text;
alter table expenses add column if not exists payment_bank text;

alter table recurring_expenses add column if not exists payment_source text;
alter table recurring_expenses add column if not exists payment_bank text;
