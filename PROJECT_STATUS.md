# Hearth -- Expense Management System: Project Status & Handoff Notes

Last updated: 2026-08-11, app version v3.70.

This file exists so the project can be picked up again -- by you, or by a
fresh Claude session with no memory of this conversation -- without needing
the chat history. Point a new session at this file plus the GitHub repo and
it should have everything it needs.

**Recent changes (through v3.70):** AdminConsole Group Accounts table redesigned (member details only, Plan as its own column); Sign Out bug root-caused and fixed (desktop Profile trigger was sharing a ref with the hidden mobile bottom-nav Profile button, so its dropdown always measured a zero-size element and rendered off-screen -- desktop now uses its own dedicated ref); clear-chat confirm banner moved to render inline directly below the Aria chat input instead of as a document.body-portaled floating banner. A full desktop + code-level mobile QA pass found no console errors or broken flows. Known gaps before a Google Play submission: no payment processor wired up yet (the $39/year Premium plan is only a manual Free/Paid toggle in Admin Console -- Google Play requires Play Billing for any in-app digital subscription purchase), no service worker/offline support, and no /.well-known/assetlinks.json yet (added at TWA-wrapping time).


## Where everything actually lives (the real backups)

The chat session itself is NOT where this project is stored. Independent,
cloud-hosted accounts are the real source of truth, and all of them already
exist and work without any particular Claude session:

1. **GitHub** -- `vipinlakhanpal-vipin/budget-tracker`
   (https://github.com/vipinlakhanpal-vipin/budget-tracker). Every line of
   code, every migration, full commit history. This is the canonical copy
   of the app. Account email: vipinlakhanpal@gmail.com.
2. **Vercel** -- project `personal-budgeting/budget-tracker`
   (https://vercel.com/personal-budgeting/budget-tracker), hosts the live
   site at https://budget-tracker-tau-liart.vercel.app/ and auto-redeploys
   on every push to GitHub's `main` branch. Also holds the environment
   variables (secrets) the app needs at runtime -- see below. Account
   email: vipinlakhanpal@gmail.com (signed in via the GitHub connection).
3. **Supabase** -- the actual database (households, users, expenses,
   income, fixed expenses, savings, categories, category_alert_log) and
   auth. This is where the real household data lives, not in any file on
   this Mac. Project URL/keys are stored only in Vercel's environment
   variables (see below) -- log into supabase.com with whichever account
   created the project to reach the dashboard directly.
4. **Anthropic** -- the API key (stored in Vercel's env vars, not in code)
   that powers the AI features (chat assistant "Aria", receipt scanning,
   budget coach, auto-categorize, monthly digest).

**The single most important thing for continuity is that you personally
retain login access to these accounts** (GitHub, Vercel, Supabase,
Anthropic console). If this Mac, this Claude session, or this Cowork app
were to disappear entirely, the app and all its data would still be fully
intact and running -- you'd just need to be able to log into those accounts
to keep making changes to it. As of 2026-07-27, GitHub and Vercel are both
confirmed to already be under vipinlakhanpal@gmail.com -- nothing needs to
be "transferred" there.

This repo folder on your Mac (if you have one) is a convenience mirror of
the same code that's on GitHub -- useful for offline reference, but GitHub
is the safer, versioned copy, not any local folder.

## What a fresh Claude session needs, to pick this back up

- The GitHub repo URL above (clone it, or read it directly).
- This file.
- The live URL to test against: https://budget-tracker-tau-liart.vercel.app/
- The Vercel deployments URL, to verify a push actually built successfully:
  https://vercel.com/personal-budgeting/budget-tracker/deployments
- Login/owner access on the live app itself is vipinlakhanpal@gmail.com.

It does NOT need the old chat transcript -- the reasoning behind non-obvious
decisions has been written directly into code comments throughout (CSS and
JSX both), specifically so the code stays understandable on its own.

## How code changes actually get deployed (important, non-obvious)

There is no local git push credential set up in the sandbox this project has
been edited from -- `git push` fails with an auth error. The working method
that's been used for every commit instead: edit a local clone, then push each
changed file live via GitHub's own web "Upload files" page
(`https://github.com/vipinlakhanpal-vipin/budget-tracker/upload/main/<path>`),
which supports committing directly to `main` and triggers Vercel's
auto-deploy the same as a normal push would. A future session should either
set up real git push credentials (cleaner) or keep using this same upload-UI
approach.

## Environment variables (set in Vercel, not in the repo)

The repo's `.gitignore` deliberately excludes `.env`/`.env.local` -- secrets
live only in Vercel's dashboard (Project Settings -> Environment Variables:
https://vercel.com/personal-budgeting/budget-tracker/settings/environment-variables),
never in git. Variable NAMES currently configured there (values are in your
Vercel dashboard, Supabase dashboard, and Anthropic console -- not
reproduced here):

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  (service role key powers the admin console's user-management features)
- `ANTHROPIC_API_KEY` (powers all AI features)
- `GMAIL_USER`, `GMAIL_APP_PASSWORD` (invite emails, rent/bill reminders)

## Architecture in one paragraph

React 18 + Vite 5 single-page app, deployed on Vercel, with Vercel Serverless
Functions under `/api` for anything needing a secret (AI calls, admin user
management, receipt scanning, cron reminders/alerts). Supabase (Postgres +
Auth + Row Level Security) is the only database -- every table is scoped to
a household via RLS policies, and multiple people can share one household's
data. No native mobile/desktop wrapper yet (that's on the roadmap).

## Known trouble spots / lessons already learned (avoid re-discovering these)

- **Table cell vertical alignment**: table cells use `vertical-align: top`
  with uniform top padding (not `middle`/centered) -- deliberately changed
  after centering caused the Payment column (which stacks two selects) to
  sit higher than single-line columns.
- **Currency inputs** use `text-align: left` inside `.amount-field-wrap` so
  the currency symbol sits flush against the digits, unlike right-aligned
  read-only `<Amt>` displays.
- **`.field-pair` CSS** (used to sit two short related fields side by side,
  e.g. Date+Amount, Start/End date): must have its own base
  `display: flex; gap: 8px` rule OUTSIDE the mobile media query too --
  without it, the two fields silently stack vertically on desktop instead
  of sitting side by side. Also, any field placed inside a `.field-pair`
  needs its flex value driven by the `isMobile` JS flag specifically for
  mobile (`{ flex: '1 1 0', minWidth: 0 }`), because a field's own
  desktop-tuned inline `style` (e.g. `flex: '0 0 auto'`) otherwise beats
  the mobile CSS class rule and breaks the even 50/50 split -- this was the
  root cause of two separate rounds of "fields overlapping on mobile" bugs.
- **Native `<input type="date">`/`type="month">`** have their own
  browser-imposed minimum rendered width that plain CSS `width`/`flex`
  can't fully override -- don't assume a flex-basis alone will make one
  shrink as far as you want on a narrow screen.
- **Chat assistant context** (`api/chat-assistant.js` + `sendChatMessage` in
  `Dashboard.jsx`) must be manually kept in sync with every data domain --
  if you add a new data type to the app, check whether the chat context
  object needs it too.
- Claude Code / Claude-in-Chrome sandboxes typically can't get a true
  narrow mobile-viewport screenshot (browser resize tools may have a hard
  floor around 1560px wide in some environments, and installing a fresh
  headless browser doesn't help since it won't be logged into Supabase
  auth anyway) -- verifying real mobile layout fixes currently requires
  the user to check on an actual phone and report back specifics.

## Pending / roadmap items (not yet done, roughly by priority)

- Get a real narrow-viewport screenshot / user confirmation that the latest
  round of mobile data-entry-form fixes (v1.12, 2026-07-27) actually look
  right on a real phone -- Date/Amount, Start/End date, Due date/Payment
  Source pairing and the Fixed Expenses 2-row desktop layout were just
  fixed but not yet visually confirmed by the user.
- Full mobile-friendly pass across remaining screens beyond the 4 data-entry
  forms (Report, Settings, Help, Admin Console).
- Sticky header partial-visibility-on-scroll bug (intermittent).
- Splash/intro page flash of old design before the refined version loads.
- Tutorial video: script is written; screenshots, TTS narration, background
  music, and final assembly are not done.
- Local folder mirroring request (keeping a Mac-side copy in sync)-not
  addressed.
- Standing rule to keep Help & Report sections' in-app changelog/copy
  updated as features ship -- not automated, needs manual discipline.
- Read-only ERP integration API + in-app setup wizard -- not started.
- Simplified first-run flow for brand-new mobile users -- not designed yet.

## Version history

Every push bumps `src/version.js` (`APP_VERSION`) and `public/version.json`,
shown on the splash screen and the top-right corner badge. The current
version is v1.12. Git commit messages on `main` describe what each version
changed, in order -- that history is the most reliable "what happened when"
record, more so than this file.
