-- Migration: free/paid plan tier per household
-- Run this ONCE in your Supabase project's SQL Editor (Project > SQL Editor > New query).
-- Safe to run multiple times.
--
-- Adds a `plan` column to households, defaulting every existing household to
-- 'free' so nothing changes for anyone until an admin explicitly upgrades a
-- household from the Admin Console's Households tab. No payment processor is
-- wired up yet -- this is a manual, admin-granted flag (flip it after
-- arranging payment outside the app: bank transfer, invoice, Play/App Store
-- billing once that's built, etc.), by explicit choice to ship the
-- free/paid split before committing to a specific billing integration.
--
-- Free plan: Income and Regular Expenses only.
-- Paid plan: adds Fixed Expenses, Savings, and Investments.
-- (Reports, Settings, Help, Aria, Admin Console are unaffected either way.)

alter table households add column if not exists plan text not null default 'free';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'households_plan_check'
  ) then
    alter table households add constraint households_plan_check check (plan in ('free', 'paid'));
  end if;
end $$;
