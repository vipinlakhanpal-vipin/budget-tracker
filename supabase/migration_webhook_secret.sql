-- Adds a per-household secret token used to authenticate unattended
-- automation (SMS-forwarding apps like MacroDroid/Tasker, mail-forwarding
-- rules, Twilio inbound webhooks) that has no logged-in browser session to
-- carry a normal Supabase auth token. See api/webhook-secret.js (issues and
-- rotates this secret for the signed-in user's household) and
-- api/ingest-transaction.js (the automation endpoint that checks it).
-- Safe to run multiple times.

alter table households add column if not exists webhook_secret text unique;
