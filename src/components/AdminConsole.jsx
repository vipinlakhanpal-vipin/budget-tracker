import { Fragment, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { PROJECT_DOC_PDF_BASE64 } from '../projectDocData';

const RELATIONS = ['Self', 'Spouse', 'Partner', 'Child', 'Parent', 'Sibling', 'Roommate', 'Other'];

const STATUS_LABEL = {
  active: 'Active',
  unverified: 'Signed up -- email not verified',
  orphaned: 'Signed up -- not in a group account',
  invited: 'Invited -- not signed up yet',
  unknown: 'Unknown',
};

const SUCCESSFUL_STATUSES = new Set(['active']);


// ---------------------------------------------------------------------
// Project tab -- admin-only master reference for the whole app: every
// account, file, folder, link, and workflow needed for a 100% picture of
// what's behind Hearth, without needing chat history. Visible only here
// (Admin Console is hard-gated to ADMIN_EMAIL in App.jsx) because the
// underlying doc includes internal/technical detail (env var names,
// account emails, deployment steps) not meant for every household
// member. Per explicit request, this tab attaches the doc as a PDF
// download rather than rendering the full text inline.
//
// STANDING RULE: regenerate src/projectDocData.js's base64 PDF (and bump
// PROJECT_DOC_META below) alongside Help panel / EManual.jsx whenever a
// version ships user-visible or structural changes.
const PROJECT_DOC_META = {
  updated: 'August 10, 2026',
  version: 'v3.60',
  filename: 'Hearth-Project-Documentation.pdf',
};

function downloadProjectDocPdf() {
  const byteChars = atob(PROJECT_DOC_PDF_BASE64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = PROJECT_DOC_META.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function ProjectTab() {
  return (
    <div style={{ maxWidth: 480 }}>
      <div className="muted-small" style={{ marginBottom: 16, fontSize: 12.5, lineHeight: 1.6 }}>
        Admin-only master reference for the whole app -- every account, file, folder, link, and deployment workflow needed for a full picture of what's behind Hearth. Kept in sync with the Help panel / E-Manual whenever a version ships user-visible changes.
      </div>
      <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px' }}>
        <div style={{
          width: 40, height: 48, borderRadius: 6, flexShrink: 0,
          background: 'color-mix(in srgb, var(--danger, #dc2626) 14%, var(--card))',
          border: '1px solid color-mix(in srgb, var(--danger, #dc2626) 35%, var(--border))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700, color: 'var(--danger, #dc2626)',
        }}>PDF</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{PROJECT_DOC_META.filename}</div>
          <div className="muted-small" style={{ fontSize: 12 }}>Last updated {PROJECT_DOC_META.updated} &middot; app {PROJECT_DOC_META.version}</div>
        </div>
        <button type="button" className="btn small" onClick={downloadProjectDocPdf}>Download</button>
      </div>
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

  // v3.61: so admins can tell which Group Account is theirs (and which is
  // anyone else's) before toggling its plan -- Group Accounts previously
  // only showed a name, no member emails.
  const membersByHousehold = useMemo(() => {
    const map = {};
    allUsers.forEach((u) => {
      (u.households || []).forEach((h) => {
        if (!h.householdId) return;
        if (!map[h.householdId]) map[h.householdId] = [];
        if (u.email && !map[h.householdId].some((m) => m.email === u.email)) {
          map[h.householdId].push({
            email: u.email,
            name: h.name || null,
            phone: h.phone || null,
            role: h.role || h.relation || null,
            location: h.location || u.lastSeenLocation || null,
            device: u.device || null,
            lastSeen: u.lastSeenLocation || null,
            joined: u.createdAt || null,
            lastLogin: u.lastSignInAt || null,
          });
        }
      });
    });
    return map;
  }, [allUsers]);

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

  // Free/paid plan tier (v3.60) -- manual/admin-granted only, no payment
  // processor wired up yet (see supabase/migration_plan_tier.sql). This is
  // currently the ONLY way a household's plan changes.
  const [planUpdatingId, setPlanUpdatingId] = useState('');
  async function setHouseholdPlan(householdId, plan) {
    setPlanUpdatingId(householdId);
    try {
      const headers = await authHeader();
      const res = await fetch('/api/admin/households', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setPlan', householdId, plan }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.household) {
        setHouseholds((prev) => prev.map((h) => (h.id === householdId ? { ...h, plan: json.household.plan } : h)));
      } else {
        setError(json.error || 'Could not update plan');
      }
    } catch (e) {
      setError(e.message || 'Could not update plan');
    } finally {
      setPlanUpdatingId('');
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
      ? `Permanently delete ${label}? This removes their login and group account membership from Supabase. This cannot be undone.`
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
          Create a login and send the group account invite in one step, or see everyone who's signed up (or tried to) across every group account.
        </p>

        <div className="input-tabs" style={{ margin: '12px 0 16px' }}>
          <button className={`btn small ${view === 'invite' ? '' : 'secondary'}`} onClick={() => setView('invite')} type="button">Invite</button>
          <button className={`btn small ${view === 'users' ? '' : 'secondary'}`} onClick={() => setView('users')} type="button">
            Users {allUsers.length ? `(${allUsers.length})` : ''}
          </button>
          <button className={`btn small ${view === 'project' ? '' : 'secondary'}`} onClick={() => setView('project')} type="button">
            Project
          </button>
          <button className={`btn small ${view === 'households' ? '' : 'secondary'}`} onClick={() => setView('households')} type="button">
            Group Accounts
          </button>
        </div>

        {view === 'invite' && (
          <>
            <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
              <div className="field" style={{ marginBottom: 10 }}>
                <label>Group Account</label>
                <select value={householdId} onChange={(e) => setHouseholdId(e.target.value)} disabled={loading}>
                  <option value="">+ Create a new group account</option>
                  {households.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>

              {!householdId && (
                <div className="field" style={{ marginBottom: 10 }}>
                  <label>New group account name</label>
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

        {view === 'households' && (
          <div>
            <div className="muted-small" style={{ marginBottom: 14, fontSize: 12.5, lineHeight: 1.6 }}>
              Free plan: Income, Regular Expenses, and Reports only. Paid unlocks Fixed Expenses, Savings, Investments, and Aria. No payment processor is wired up yet -- this toggle is the only way a group account's plan changes right now (see supabase/migration_plan_tier.sql).
            </div>
            {loading && <div className="muted-small">Loading group accounts...</div>}
            {!loading && households.length === 0 && <div className="empty">No group accounts yet.</div>}
            {/* v3.65: one consolidated table instead of a separate card +
                mini-table per group account -- the repeated card borders
                and re-printed column headers made the page read as messy
                once there were more than a couple of accounts. Now it's a
                single table with a bold group-header row (name + Free/Paid
                toggle) per account, member rows underneath, and every
                column only defined once at the top -- matching the same
                grouped-table pattern already used in the Users tab above. */}
            {!loading && households.length > 0 && (
              <div className="table-scroll">
                <table className="responsive-table admin-users-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Name</th><th>Email</th><th>Phone</th><th>Role</th>
                      <th>Location</th><th>Device</th><th>Last Seen</th>
                      <th>Joined</th><th>Last Login</th>
                    </tr>
                  </thead>
                  <tbody>
                    {households.map((h) => {
                      const members = membersByHousehold[h.id] || [];
                      return (
                        <Fragment key={h.id}>
                          <tr className="admin-household-group-header">
                            <td colSpan={9}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                <span>{h.name} &middot; {h.plan === 'paid' ? 'Paid' : 'Free'}</span>
                                <div className="input-tabs" style={{ margin: 0, flexShrink: 0 }}>
                                  <button
                                    type="button"
                                    className={`btn small ${h.plan !== 'paid' ? '' : 'secondary'}`}
                                    disabled={planUpdatingId === h.id}
                                    onClick={() => setHouseholdPlan(h.id, 'free')}
                                  >
                                    Free
                                  </button>
                                  <button
                                    type="button"
                                    className={`btn small ${h.plan === 'paid' ? '' : 'secondary'}`}
                                    disabled={planUpdatingId === h.id}
                                    onClick={() => setHouseholdPlan(h.id, 'paid')}
                                  >
                                    Paid
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                          {members.length === 0 && (
                            <tr><td colSpan={9} className="muted-small">No members yet</td></tr>
                          )}
                          {members.map((m) => (
                            <tr key={m.email}>
                              <td data-label="Name">{m.name || '--'}</td>
                              <td data-label="Email">{m.email}</td>
                              <td data-label="Phone">{m.phone || '--'}</td>
                              <td data-label="Role">{m.role || '--'}</td>
                              <td data-label="Location">{m.location || '--'}</td>
                              <td data-label="Device">{m.device || '--'}</td>
                              <td data-label="Last Seen">{m.lastSeen || '--'}</td>
                              <td data-label="Joined">{m.joined ? new Date(m.joined).toLocaleDateString() : '--'}</td>
                              <td data-label="Last Login">{m.lastLogin ? new Date(m.lastLogin).toLocaleDateString() : '--'}</td>
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
            <tr><th>Email</th><th>Status</th><th>Group Account(s)</th><th>Joined</th><th>Last Login</th><th>Device</th><th>Location</th><th>Last seen</th><th>Usage</th><th></th></tr>
          </thead>
          <tbody>
            {users.flatMap((u, idx) => {
              // v2.23: group rows by household so it's easy to see who's in
              // the same household at a glance -- callers pre-sort `users`
              // by household name (see successfulUsersSorted below), so a
              // group header only needs to appear when the name changes.
              const householdName = u.households[0]?.householdName || 'No group account';
              const prevHouseholdName = idx > 0
                ? (users[idx - 1].households[0]?.householdName || 'No group account')
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
                  <td data-label="Group Account(s)" className="muted-small">
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
