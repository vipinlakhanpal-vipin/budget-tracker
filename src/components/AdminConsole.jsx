import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const RELATIONS = ['Self', 'Spouse', 'Partner', 'Child', 'Parent', 'Sibling', 'Roommate', 'Other'];

const STATUS_LABEL = {
  active: 'Active',
  unverified: 'Signed up -- email not verified',
  orphaned: 'Signed up -- not in a household',
  invited: 'Invited -- not signed up yet',
  unknown: 'Unknown',
};

const SUCCESSFUL_STATUSES = new Set(['active']);


// ---------------------------------------------------------------------
// Project tab -- admin-only master reference for the whole app: every
// account, file, folder, link, and workflow needed for a 100% picture of
// what's behind Hearth, without needing chat history. Visible only here
// (Admin Console is hard-gated to ADMIN_EMAIL in App.jsx) because it
// includes internal/technical detail (env var names, account emails,
// deployment steps) not meant for every household member.
//
// STANDING RULE: update this alongside Help panel / EManual.jsx whenever
// a version ships user-visible or structural changes -- see PROJECT_DOC
// "updated"/"version" fields below and keep them current.
const PROJECT_DOC = {
  updated: 'August 10, 2026',
  version: 'v3.52',
  sections: [
    {
      title: '1. Project Overview',
      blocks: [
        { type: 'p', text: 'Hearth is a shared household budget tracker. Members of a household log income, fixed bills, one-off expenses, savings goals, and private investments together, with charts, PDF reports, and optional AI features (auto-categorization, receipt scanning, a chat assistant called "Aria," and a budget coach) layered on top.' },
        { type: 'table', headers: ['Item', 'Value'], rows: [
          ['Live app', 'https://budget-tracker-tau-liart.vercel.app/'],
          ['Owner account (all services)', 'vipinlakhanpal@gmail.com'],
          ['Current version', 'v3.52'],
          ['Stack', 'React 18 + Vite 5 (frontend), Supabase (Postgres + Auth + RLS), Vercel Serverless Functions (backend), hosted on Vercel'],
        ] },
      ],
    },
    {
      title: '2. Where Everything Actually Lives (accounts & links)',
      blocks: [
        { type: 'p', text: "These four cloud accounts are the real source of truth. The app and all data survive independently of any chat session, this Mac, or any particular tool -- as long as you retain login access to these:" },
        { type: 'ul', items: [
          'GitHub -- canonical copy of every line of code and full commit history. Repo: https://github.com/vipinlakhanpal-vipin/budget-tracker',
          'Vercel -- hosts the live site, auto-redeploys on every push to main, holds all runtime secrets. Project: https://vercel.com/personal-budgeting/budget-tracker',
          "Supabase -- the actual database: households, users, expenses, income, fixed expenses, savings, investments, categories, chat history, login events. (Project URL/keys live in Vercel's env vars.)",
          "Anthropic Console -- issues the API key powering all AI features (Aria chat, receipt scanning, budget coach, auto-categorize, monthly digest). Key stored only in Vercel's env vars.",
        ] },
        { type: 'p', text: 'If this Mac, this Claude session, or Cowork disappeared entirely, the live app and all household data would keep running untouched -- access to these four accounts is what actually matters for continuity.' },
      ],
    },
    {
      title: '3. How Deployment Works (important, non-obvious)',
      blocks: [
        { type: 'p', text: 'There is no local git push credential set up -- pushing from a terminal fails with an auth error. Every code change instead ships through GitHub\'s own web "Upload files" page:' },
        { type: 'code', text: 'https://github.com/vipinlakhanpal-vipin/budget-tracker/upload/main/<folder>' },
        { type: 'p', text: 'You navigate to the folder being changed, drag in the modified file(s), write a commit message, and click "Commit changes" -- this commits straight to main and triggers Vercel\'s auto-deploy exactly like a normal git push would.' },
        { type: 'p', text: 'Every release bumps two files together (they must always match exactly, or the in-app "update available" badge gets stuck):' },
        { type: 'ul', items: [
          'src/version.js -> APP_VERSION constant',
          'public/version.json -> {"version": "..."}',
        ] },
      ],
    },
    {
      title: '4. Environment Variables (set in Vercel only, never in the repo)',
      blocks: [
        { type: 'p', text: '.gitignore deliberately excludes .env/.env.local. Variable names configured in Vercel (values live in Vercel/Supabase/Anthropic dashboards, not reproduced here):' },
        { type: 'ul', items: [
          "VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY -- service role key powers the Admin Console's user-management features",
          'ANTHROPIC_API_KEY -- powers all AI features',
          'GMAIL_USER, GMAIL_APP_PASSWORD -- invite emails, rent/bill reminders, Support emails',
        ] },
      ],
    },
    {
      title: '5. Full Repository Structure',
      blocks: [
        { type: 'code', text:
`budget-tracker/
|- index.html                     Vite entry HTML
|- package.json                   Frontend dependencies + scripts
|- vite.config.js                 Vite build config
|- vercel.json                    Vercel cron schedule + cache headers
|- PROJECT_STATUS.md              Legacy handoff notes (superseded by this tab)
|
|- src/                           React application source
|  |- main.jsx                    App bootstrap / React root
|  |- App.jsx                     Top-level router: auth state, login tracking
|  |- supabaseClient.js           Supabase client init
|  |- passwordRules.js            Password validation rules
|  |- version.js                  APP_VERSION source of truth (see section 3)
|  |- index.css                   All app styling (~205KB, single stylesheet)
|  \- components/
|     |- Dashboard.jsx            Main app screen (~556KB) -- all tabs, desktop
|     |                            rail, charts, AI insights, Aria, Support, etc.
|     |- EManual.jsx              Full-screen manual/reader (own content array)
|     |- Login.jsx                Sign in / sign up
|     |- CreateHousehold.jsx      New-household creation flow
|     |- AdminConsole.jsx         Household/user admin screen (this file)
|     |- Splash.jsx               Loading/intro screen
|     \- ResetPassword.jsx        Password reset flow
|
|- api/                           Vercel Serverless Functions (12 total -- hard cap)
|  |- _mailer.js                  Shared Gmail SMTP helper (not counted)
|  |- invite-member.js            Invites + self-service account deletion
|  |- send-suggestion.js          "Support" form submission -> email
|  |- send-report.js              Emails a generated PDF report
|  |- monthly-digest.js           Scheduled monthly summary email
|  |- budget-coach.js             AI budget coaching suggestions
|  |- categorize-expense.js       AI auto-categorization
|  |- chat-assistant.js           Aria chat backend (Claude API)
|  |- scan-receipt.js             AI receipt OCR/parsing
|  |- cron/rent-reminders.js      Daily cron: rent + budget threshold alerts
|  \- admin/                      users.js, households.js, invite.js, _auth.js
|
|- public/                        Static assets served as-is
|  |- manifest.json               PWA manifest
|  |- version.json                Must match src/version.js
|  |- privacy.html                Privacy Policy (standalone page)
|  |- terms.html                  Terms of Service (standalone page, v3.46)
|  \- icon-*.png, favicon.png, *.svg
|
|- supabase/                      DB schema, run manually in SQL Editor
|  |- schema.sql                  Base schema
|  \- migration_*.sql             10 incremental migrations (see section 6)
|
|- desktop/                       Thin Electron shell (loads the live Vercel URL)
|  |- main.js
|  \- package.json
|
\- .github/workflows/build-desktop.yml   Builds macOS .dmg on demand` },
      ],
    },
    {
      title: '6. Database (Supabase) -- Schema & Migrations',
      blocks: [
        { type: 'p', text: "Every table is scoped to a household via Row Level Security policies; multiple people share one household's data (except Investments, which is explicitly private per-user). Run once, in this order, in Supabase's SQL Editor:" },
        { type: 'table', headers: ['File', 'Adds'], rows: [
          ['schema.sql', 'Base tables: categories, expenses, settings, recurring_expenses'],
          ['migration_households.sql', 'Multi-household (multi-tenant) support'],
          ['migration_payment_source.sql', 'Payment Source (Cash/Credit/Debit) + bank name'],
          ['migration_login_tracking.sql', 'login_events table -- Admin Console Device/Last-seen'],
          ['migration_multi_attachments.sql', 'Multiple file attachments per row'],
          ['migration_category_alerts.sql', 'Per-category budget threshold alert tracking'],
          ['migration_monthly_budgets.sql', 'Per-month total budget'],
          ['migration_investments.sql', 'Private Investments tab (FDs + Mutual Fund/SIP)'],
          ['migration_chat_messages.sql', 'Persists Aria chat history per household'],
          ['migration_category_groups.sql', 'User-defined Category Groups'],
          ['migration_private_transactions.sql', 'Opt-in "Private" flag on individual entries'],
        ] },
      ],
    },
    {
      title: '7. Serverless Functions Cap (Vercel Hobby plan)',
      blocks: [
        { type: 'p', text: "Vercel's free tier hard-caps a project at 12 serverless functions. Files prefixed with _ (_mailer.js, _auth.js) are shared helpers, not counted. The 12 counted functions are exactly: admin/households.js, admin/invite.js, admin/users.js, budget-coach.js, categorize-expense.js, chat-assistant.js, cron/rent-reminders.js, invite-member.js, monthly-digest.js, scan-receipt.js, send-report.js, send-suggestion.js. This is exactly at the limit -- any new backend feature must either fold into an existing file (action-dispatch pattern, as done for account deletion inside invite-member.js) or a function must be retired first." },
      ],
    },
    {
      title: "8. Feature Areas (what's in the app today)",
      blocks: [
        { type: 'ul', items: [
          'Core tracking: Income, Fixed Expenses, Regular (one-off) Expenses, Savings goals, private Investments (FDs/SIPs) -- each with Add/View/Charts',
          'Reports: PDF report generation & email',
          'AI features: Aria chat assistant, budget coach suggestions, receipt scanning/OCR, auto-categorization, monthly digest -- all informational only, per the Terms of Service',
          'Admin Console: household/user management, powered by the Supabase service-role key',
          'Settings: Currency, Category Groups & Budgeting, Account (Terms/Privacy links, self-service account deletion), theme picker, alerts',
          'Support (renamed from "Suggestion," v3.46): footer/Settings form with topic tags, emails the team',
          'Legal: terms.html and privacy.html, standalone pages linked from the footer and Settings',
          'Desktop layout (v3.48-v3.51): left-rail Add/View/Charts frame switcher unique to desktop/wide screens; mobile layout untouched',
          'Help panel & E-Manual: in-app help and a separate full-screen manual -- see the standing-sync rule in section 9',
          'Desktop shell: optional native-feeling macOS wrapper (Electron) that loads the live web app',
        ] },
      ],
    },
    {
      title: '9. Known Trouble Spots & Standing Rules (avoid re-learning these)',
      blocks: [
        { type: 'ul', items: [
          'Help panel / E-Manual / this Project tab sync is a standing rule: whenever a version ships user-visible changes, Dashboard.jsx\'s HELP_LAST_UPDATED_VERSION + "What\'s New" topic, EManual.jsx\'s MANUAL_TOPICS, and this PROJECT_DOC should all be updated together -- these are independently-maintained content copies, not a live import.',
          "CSS Grid gotcha: an explicitly-positioned grid item can get pushed to a new row if an earlier, auto-placed sibling still occupies that grid cell -- even if visually empty. Fix is display:'none' on the empty sibling.",
          ".field flex-column defaults to align-items:stretch -- buttons inside stretch full-width unless given alignSelf:'flex-start'.",
          'Table cells use vertical-align:top with uniform top padding, not centered -- centering broke multi-line Payment columns.',
          '.field-pair needs its base display:flex;gap:8px outside the mobile media query too, or fields silently stack vertically on desktop.',
          'Native <input type="date"/"month"> has a browser-imposed minimum width CSS can\'t fully override.',
          "Aria's chat context (api/chat-assistant.js + sendChatMessage) must be manually updated whenever a new data domain is added -- it does not pick up new data types automatically.",
          "Real narrow-viewport mobile screenshots aren't reliably available in sandboxed browser tools -- mobile layout changes need a real phone check.",
        ] },
      ],
    },
    {
      title: '10. Version History Highlights (recent)',
      blocks: [
        { type: 'p', text: "Full history is in GitHub's commit log (969+ commits) -- this is a condensed recent trail:" },
        { type: 'table', headers: ['Version', 'Key change'], rows: [
          ['v3.46', 'Support form (renamed from Suggestion) + topic tags, Terms of Service page, self-service account deletion'],
          ['v3.47', 'Fixed delete-account button layout; colorful per-tile dashboard backgrounds'],
          ['v3.48-v3.50', 'Desktop left-rail Add/View/Charts frame switcher (major layout addition, mobile untouched)'],
          ['v3.51', 'Pill-style top navigation tabs'],
          ['v3.52', 'Help panel version marker + content resynced; E-Manual "What\'s New"/Settings resynced; this Project tab added'],
        ] },
      ],
    },
    {
      title: '11. Currently Open Items',
      blocks: [
        { type: 'ul', items: [
          'A stray duplicate folder exists in the repo: src/components,/Dashboard.jsx (trailing comma in the folder name) -- a leftover ~533KB copy from a past upload mistake. Confirmed harmless to the live build, but is repo clutter. Pending go-ahead to delete.',
          'No other outstanding technical items as of this writing; the earlier App Store/Play Store readiness punch list (native wrapper decisions, service worker, bundle-size code-splitting) was scoped out but not resumed.',
        ] },
      ],
    },
    {
      title: '12. If You Need to Hand This Off',
      blocks: [
        { type: 'p', text: 'Everything a fresh person or fresh Claude session needs to pick this up cold:' },
        { type: 'ul', items: [
          'This tab (or the exported doc/PDF -- ask to export it any time).',
          'The GitHub repo (clone or read directly): https://github.com/vipinlakhanpal-vipin/budget-tracker',
          'The live URL to test against: https://budget-tracker-tau-liart.vercel.app/',
          'Login access to the four accounts in section 2 -- all under vipinlakhanpal@gmail.com.',
        ] },
        { type: 'p', text: 'No chat transcript is required -- reasoning behind non-obvious decisions is written directly into code comments throughout Dashboard.jsx, index.css, version.js, and the migration files, specifically so the code stays understandable on its own.' },
      ],
    },
  ],
};

function ProjectDocBlock({ block }) {
  if (block.type === 'p') {
    return <p className="muted-small" style={{ fontSize: 13, lineHeight: 1.6, margin: '0 0 10px' }}>{block.text}</p>;
  }
  if (block.type === 'ul') {
    return (
      <ul style={{ margin: '0 0 12px', paddingLeft: 18 }}>
        {block.items.map((it, i) => (
          <li key={i} style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 6 }}>{it}</li>
        ))}
      </ul>
    );
  }
  if (block.type === 'code') {
    return (
      <pre style={{
        background: 'color-mix(in srgb, var(--text) 5%, var(--card))',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '10px 12px',
        fontSize: 11.5,
        lineHeight: 1.5,
        overflowX: 'auto',
        margin: '0 0 12px',
        whiteSpace: 'pre',
      }}>{block.text}</pre>
    );
  }
  if (block.type === 'table') {
    return (
      <div style={{ overflowX: 'auto', margin: '0 0 14px' }}>
        <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr>
              {block.headers.map((h, i) => (
                <th key={i} style={{ textAlign: 'left', padding: '6px 8px', background: 'color-mix(in srgb, var(--accent) 12%, var(--card))', borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return null;
}

function ProjectTab() {
  return (
    <div style={{ maxWidth: 780 }}>
      <div className="muted-small" style={{ marginBottom: 16, fontSize: 12.5 }}>
        Admin-only master reference for the whole app -- accounts, files, links, deployment workflow. Last updated {PROJECT_DOC.updated}, app {PROJECT_DOC.version}. Kept in sync with Help panel / E-Manual whenever a version ships user-visible changes.
      </div>
      {PROJECT_DOC.sections.map((section, si) => (
        <div key={si} style={{ marginBottom: 22 }}>
          <h3 style={{ fontSize: 15, margin: '0 0 8px', color: 'var(--accent)' }}>{section.title}</h3>
          {section.blocks.map((block, bi) => (
            <ProjectDocBlock key={bi} block={block} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function AdminConsole({ onClose, embedded = false }) {
  const [households, setHouseholds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [householdId, setHouseholdId] = useState('');
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [email, setEmail] = useState('');
  const [relation, setRelation] = useState('Other');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const [view, setView] = useState('invite');
  const [allUsers, setAllUsers] = useState([]);
  const [allUsersLoading, setAllUsersLoading] = useState(true);
  const [allUsersError, setAllUsersError] = useState('');
  const [deletingEmail, setDeletingEmail] = useState('');
  const [insightLoadingEmail, setInsightLoadingEmail] = useState('');
  const [resettingEmail, setResettingEmail] = useState('');

  useEffect(() => {
    loadHouseholds();
    loadAllUsers();
  }, []);

  async function authHeader() {
    const { data: { session } } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${session?.access_token}` };
  }

  async function loadHouseholds() {
    setLoading(true);
    try {
      const headers = await authHeader();
      const res = await fetch('/api/admin/households', { headers });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setHouseholds(json.households || []);
      } else {
        setError(json.error || 'Could not load households');
      }
    } catch (e) {
      setError(e.message || 'Could not load households');
    } finally {
      setLoading(false);
    }
  }

  async function loadAllUsers() {
    setAllUsersLoading(true);
    setAllUsersError('');
    try {
      const headers = await authHeader();
      const res = await fetch('/api/admin/users', { headers });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setAllUsers(json.users || []);
      } else {
        setAllUsersError(json.error || 'Could not load users');
      }
    } catch (e) {
      setAllUsersError(e.message || 'Could not load users');
    } finally {
      setAllUsersLoading(false);
    }
  }

  async function handleDeleteUser(u) {
    const label = u.email;
    const confirmMsg = u.userId
      ? `Permanently delete ${label}? This removes their login and household membership from Supabase. This cannot be undone.`
      : `Cancel the pending invite for ${label}?`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingEmail(u.email);
    try {
      const headers = { 'Content-Type': 'application/json', ...(await authHeader()) };
      const body = u.userId
        ? { userId: u.userId, email: u.email }
        : { inviteId: u.invites[0]?.inviteId, email: u.email };
      const res = await fetch('/api/admin/users', { method: 'POST', headers, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert('Could not delete: ' + (json.error || 'unknown error'));
        return;
      }
      await loadAllUsers();
    } catch (e) {
      alert('Could not delete: ' + (e.message || 'unknown error'));
    } finally {
      setDeletingEmail('');
    }
  }

  async function handleGetInsights(u) {
    if (!u.userId) return;
    setInsightLoadingEmail(u.email);
    try {
      const headers = { 'Content-Type': 'application/json', ...(await authHeader()) };
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'insights', userId: u.userId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert('Could not get insights: ' + (json.error || 'unknown error'));
        return;
      }
      if (json.aiEnabled === false) {
        alert('AI insights are not configured yet.');
        return;
      }
      alert(json.insight || 'No insight available for this user yet.');
    } catch (e) {
      alert('Could not get insights: ' + (e.message || 'unknown error'));
    } finally {
      setInsightLoadingEmail('');
    }
  }

  async function handleResetPassword(u) {
    if (!u.userId) return;
    const typed = window.prompt(
      `Enter a new password for ${u.email} (at least 8 characters), or leave this blank to auto-generate one:`
    );
    if (typed === null) return;
    const trimmed = typed.trim();
    if (trimmed && trimmed.length < 8) {
      alert('Password must be at least 8 characters. Leave it blank to auto-generate one instead.');
      return;
    }
    if (!window.confirm(`Reset the password for ${u.email}? Their current password will stop working immediately.`)) return;
    setResettingEmail(u.email);
    try {
      const headers = { 'Content-Type': 'application/json', ...(await authHeader()) };
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'resetPassword', userId: u.userId, newPassword: trimmed || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert('Could not reset password: ' + (json.error || 'unknown error'));
        return;
      }
      alert(`Password reset for ${u.email}.\n\nNew password: ${json.password}\n\nShare this with them directly -- it won't be shown again.`);
    } catch (e) {
      alert('Could not reset password: ' + (e.message || 'unknown error'));
    } finally {
      setResettingEmail('');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setStatus('sending');
    try {
      const headers = { 'Content-Type': 'application/json', ...(await authHeader()) };
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: email.trim(),
          relation,
          householdId: householdId || undefined,
          newHouseholdName: householdId ? undefined : newHouseholdName.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('');
        setError(json.error || 'Something went wrong');
        return;
      }
      setStatus('sent');
      setEmail('');
      setNewHouseholdName('');
      loadHouseholds();
      loadAllUsers();
    } catch (e) {
      setStatus('');
      setError(e.message || 'Something went wrong');
    }
  }

  const Wrap = embedded ? 'div' : 'div';
  const wrapClass = embedded ? '' : 'center-screen';
  const cardClass = embedded ? '' : 'login-card';

  const successfulUsers = allUsers.filter((u) => SUCCESSFUL_STATUSES.has(u.status));
  const unsuccessfulUsers = allUsers.filter((u) => !SUCCESSFUL_STATUSES.has(u.status))

  // v2.23: group the Users tab by household -- sort so everyone in the
  // same household is adjacent, then UserGroup inserts a header row each
  // time the household name changes.
  const successfulUsersSorted = [...successfulUsers].sort((a, b) => {
    const ah = a.households[0]?.householdName || 'zzz No household'
    const bh = b.households[0]?.householdName || 'zzz No household'
    return ah.localeCompare(bh) || a.email.localeCompare(b.email)
  });

  return (
    <Wrap className={wrapClass}>
      <div className={cardClass} style={embedded ? { textAlign: 'left' } : { maxWidth: 480, textAlign: 'left' }}>
        <h1 style={{ textAlign: embedded ? 'left' : 'center', fontSize: embedded ? 18 : undefined }}>Admin console</h1>
        <p className="sub" style={{ textAlign: embedded ? 'left' : 'center' }}>
          Create a login and send the household invite in one step, or see everyone who's signed up (or tried to) across every household.
        </p>

        <div className="input-tabs" style={{ margin: '12px 0 16px' }}>
          <button className={`btn small ${view === 'invite' ? '' : 'secondary'}`} onClick={() => setView('invite')} type="button">Invite</button>
          <button className={`btn small ${view === 'users' ? '' : 'secondary'}`} onClick={() => setView('users')} type="button">
            Users {allUsers.length ? `(${allUsers.length})` : ''}
          </button>
          <button className={`btn small ${view === 'project' ? '' : 'secondary'}`} onClick={() => setView('project')} type="button">
            Project
          </button>
        </div>

        {view === 'invite' && (
          <>
            <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
              <div className="field" style={{ marginBottom: 10 }}>
                <label>Household</label>
                <select value={householdId} onChange={(e) => setHouseholdId(e.target.value)} disabled={loading}>
                  <option value="">+ Create a new household</option>
                  {households.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>

              {!householdId && (
                <div className="field" style={{ marginBottom: 10 }}>
                  <label>New household name</label>
                  <input
                    type="text"
                    value={newHouseholdName}
                    onChange={(e) => setNewHouseholdName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="field" style={{ marginBottom: 10 }}>
                <label>Email to invite</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>

              <div className="field" style={{ marginBottom: 14 }}>
                <label>Relation</label>
                <select value={relation} onChange={(e) => setRelation(e.target.value)}>
                  {RELATIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <button className="btn" type="submit" disabled={status === 'sending'}>
                {status === 'sending' ? 'Creating...' : 'Create login & send invite'}
              </button>
            </form>

            {status === 'sent' && <div className="login-sent">Login created and invite sent.</div>}
            {error && <div className="login-error">{error}</div>}
          </>
        )}

        {view === 'users' && (
          <div>
            {allUsersLoading && <div className="muted-small">Loading users...</div>}
            {allUsersError && (
              <div className="login-error">
                {allUsersError}{' '}
                <button type="button" className="btn secondary small" style={{ marginLeft: 8 }} onClick={loadAllUsers}>
                  Retry
                </button>
              </div>
            )}
            {!allUsersLoading && !allUsersError && (
              <>
                <div className="muted-small" style={{ marginBottom: 10, fontWeight: 600 }}>
                  {successfulUsers.length} successful signup{successfulUsers.length === 1 ? '' : 's'} -- {unsuccessfulUsers.length} unsuccessful / pending
                </div>

                <UserGroup title="Successful signups" users={successfulUsersSorted} onDelete={handleDeleteUser} deletingEmail={deletingEmail} onInsights={handleGetInsights} insightLoadingEmail={insightLoadingEmail} onResetPassword={handleResetPassword} resettingEmail={resettingEmail} />
                <UserGroup title="Unsuccessful / pending" users={unsuccessfulUsers} onDelete={handleDeleteUser} deletingEmail={deletingEmail} />
              </>
            )}
          </div>
        )}

        {view === 'project' && (
          <div>
            <ProjectTab />
          </div>
        )}

        <button className="btn secondary small" style={{ marginTop: 16 }} onClick={onClose}>
          {embedded ? 'Close' : 'Back'}
        </button>
      </div>
    </Wrap>
  );
}

function UserGroup({ title, users, onDelete, deletingEmail, onInsights, insightLoadingEmail, onResetPassword, resettingEmail }) {
  if (!users.length) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="muted-small" style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{title}</div>
      <div className="table-scroll">
        <table className="responsive-table admin-users-table">
          <thead>
            <tr><th>Email</th><th>Status</th><th>Household(s)</th><th>Joined</th><th>Last Login</th><th>Device</th><th>Location</th><th>Last seen</th><th>Usage</th><th></th></tr>
          </thead>
          <tbody>
            {users.flatMap((u, idx) => {
              // v2.23: group rows by household so it's easy to see who's in
              // the same household at a glance -- callers pre-sort `users`
              // by household name (see successfulUsersSorted below), so a
              // group header only needs to appear when the name changes.
              const householdName = u.households[0]?.householdName || 'No household';
              const prevHouseholdName = idx > 0
                ? (users[idx - 1].households[0]?.householdName || 'No household')
                : null;
              const rows = [];
              if (householdName !== prevHouseholdName) {
                rows.push(
                  <tr key={`group-${householdName}-${idx}`} className="admin-household-group-header">
                    <td colSpan={10}>
                      {householdName}{u.households.length > 1 ? ` (+${u.households.length - 1} more)` : ''}
                    </td>
                  </tr>
                );
              }
              rows.push(
                <tr key={u.email}>
                  <td data-label="Email">{u.email}</td>
                  <td data-label="Status">{STATUS_LABEL[u.status] || u.status}</td>
                  <td data-label="Household(s)" className="muted-small">
                    {u.households.length
                      ? u.households.map((h) => h.householdName).join(', ')
                      : (u.invites[0]?.householdName || '--')}
                  </td>
                  <td data-label="Joined" className="muted-small">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '--'}
                  </td>
                  <td data-label="Last Login" className="muted-small">
                    {u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleDateString() : '--'}
                  </td>
                  <td data-label="Device" className="muted-small">
                    {u.device || '--'}
                  </td>
                  <td data-label="Location" className="muted-small">
                    {u.households.map((h) => h.location).find(Boolean) || '--'}
                  </td>
                  <td data-label="Last seen" className="muted-small">
                    {u.lastSeenLocation || '--'}
                  </td>
                  <td data-label="Usage" className="muted-small">
                    {u.usagePercent === null || u.usagePercent === undefined ? '--' : `${u.usagePercent}%`}
                  </td>
                  <td>
                    <div className="admin-actions-cell">
                      {onInsights && (
                        <button
                          type="button"
                          className="btn secondary small admin-action-btn"
                          onClick={() => onInsights(u)}
                        >
                          {insightLoadingEmail === u.email ? 'Thinking...' : 'AI Insights'}
                        </button>
                      )}
                      {onResetPassword && (
                        <button
                          type="button"
                          className="btn secondary small admin-action-btn"
                          onClick={() => onResetPassword(u)}
                          disabled={!u.userId || resettingEmail === u.email}
                        >
                          {resettingEmail === u.email ? 'Resetting...' : 'Reset Password'}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn secondary small admin-action-btn"
                        onClick={() => onDelete(u)}
                        disabled={deletingEmail === u.email}
                      >
                        {deletingEmail === u.email ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
              return rows;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
