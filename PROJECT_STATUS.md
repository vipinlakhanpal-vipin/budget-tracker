# Hearth -- Household Budget Tracker: Project Status & Handoff Notes

Last updated: 2026-07-10, app version v37.

This file exists so the project can be picked up again -- by you, or by a
fresh Claude session with no memory of this conversation -- without needing
the chat history. Point a new session at this file plus the GitHub repo and
it should have everything it needs.

## Where everything actually lives (the real backups)

The chat session itself is NOT where this project is stored. Four
independent, cloud-hosted accounts are the real source of truth, and all
four already exist and work without this Claude session:

1. **GitHub** -- `vipinlakhanpal-vipin/budget-tracker`. Every line of code,
   every migration, full history (100+ commits). This is the canonical copy
   of the app.
2. **Vercel** -- hosts the live site at
   `https://budget-tracker-tau-liart.vercel.app/` and auto-redeploys on
   every push to GitHub's `main` branch. Also holds the environment
   variables (secrets) the app needs at runtime -- see below.
3. **Supabase** -- the actual database (households, users, expenses, income,
   fixed expenses, savings, categories) and auth. This is where the real
   household data lives, not in any file on this Mac.
4. **Anthropic** -- the API key (stored in Vercel's env vars, not in code)
   that powers the AI features (chat assistant, receipt scanning, budget
   coach, auto-categorize, monthly digest).

**The single most important thing for continuity is that you personally
retain login access to these four accounts** (GitHub, Vercel, Supabase,
Anthropic console). If this Mac, this Claude session, or this Cowork app
were to disappear entirely, the app and all its data would still be fully
intact and running -- you'd just need to be able to log into those accounts
to keep making changes to it.

This repo folder on your Mac (the one this file is in) is a convenience
mirror of the same code that's on GitHub -- useful for offline reference,
but GitHub is the safer, versioned copy, not this folder.

## What a fresh Claude session needs, to pick this back up

- The GitHub repo URL above (clone it, or read it directly).
- This file.
- To know the live URL to test against:
  `https://budget-tracker-tau-liart.vercel.app/`.
- Login/owner access is `vipinlakhanpal@gmail.com` on the live app itself.

It does NOT need the old chat transcript -- the reasoning behind non-obvious
decisions has been written directly into code comments throughout (CSS and
JSX both), specifically so the code stays understandable on its own.

## Environment variables (set in Vercel, not in the repo)

The repo's `.gitignore` deliberately excludes `.env`/`.env.local` -- secrets
live only in Vercel's dashboard (Project Settings -> Environment Variables),
never in git. If this project ever needs to be redeployed from scratch,
these are the variable NAMES that must be re-entered there (values are in
your Vercel dashboard, Supabase dashboard, and Anthropic console -- not
reproduced here):

- Supabase URL + anon key + service role key (service role key powers the
  admin console's user-management features)
- `ANTHROPIC_API_KEY` (powers all 5 AI features)
- Gmail SMTP credentials (used for invite emails and rent/bill reminders)

## Architecture in one paragraph

React 18 + Vite 5 single-page app, deployed on Vercel, with Vercel Serverless
Functions under `/api` for anything needing a secret (AI calls, admin user
management, PDF-adjacent helpers). Supabase (Postgres + Auth + Row Level
Security) is the only database -- every table is scoped to a household via
RLS policies, and multiple people can share one household's data. No native
mobile/desktop wrapper yet (that's on the roadmap, see below).

## Known trouble spots / lessons already learned (avoid re-discovering these)

- **Table cell vertical alignment**: table cells use `vertical-align: top`
  with a uniform top padding (not `middle`/centered) -- this was deliberately
  changed after centering caused the Payment column (which stacks two
  selects to keep row heights uniform) to visually sit higher than
  single-line columns. Don't switch this back to `middle` without re-testing
  the Payment column specifically.
- **Currency inputs** use `text-align: left` (not right) inside
  `.amount-field-wrap` specifically so the currency symbol sits flush
  against the digits ("$4500" style) -- this is intentionally different
  from the right-aligned convention used for read-only `<Amt>` displays.
- **Fixed Expenses table** uses fixed-pixel column widths (not percentages)
  because it ran out of percentage points to reallocate; it has a
  `.table-scroll` horizontal-scroll wrapper for narrow screens, and the
  trailing delete-icon column is `position: sticky` so it can't scroll out
  of view.
- **Chat assistant context** (`api/chat-assistant.js` + `sendChatMessage` in
  `Dashboard.jsx`) must be manually kept in sync with every data domain --
  code review alone has twice missed real gaps (income sources, then
  payment source/bank on transactions) that only live testing caught. If
  you add a new data type to the app, check whether the chat context object
  needs it too.
- **Claude-in-Chrome's drag-simulation tool** doesn't fire a real
  `pointerup` on the dragged element, so testing the draggable chat bubble
  via that tool alone will look broken even when the real app code is fine
  -- verify with manually dispatched PointerEvents instead if this comes up
  again.

## Pending / roadmap items (not yet done)

- Ensure the chart improvements (Pareto/Treemap/etc.) also look good on
  mobile screens specifically.
- Phase 1 of the mobile-first redesign is in progress; Phases 2-6 not
  started: privacy policy page, Capacitor Android wrap, Capacitor iOS wrap
  (needs a Mac with Xcode), app store listings/submission, desktop
  installers (Electron/Tauri).
- Small note icon + document attachment option on the Add-expense form
  (blocked on an earlier clarifying question that was never resolved).

## Version history

Every push bumps `src/version.js` (`APP_VERSION`, shown on the splash
screen and the top-right corner badge). The current version is `v37`. Git
commit messages on `main` describe what each version changed, in order.
