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
  const unsuccessfulUsers = allUsers.filter((u) => !SUCCESSFUL_STATUSES.has(u.status));

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

                <UserGroup title="Successful signups" users={successfulUsers} onDelete={handleDeleteUser} deletingEmail={deletingEmail} onInsights={handleGetInsights} insightLoadingEmail={insightLoadingEmail} />
                <UserGroup title="Unsuccessful / pending" users={unsuccessfulUsers} onDelete={handleDeleteUser} deletingEmail={deletingEmail} />
              </>
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

function UserGroup({ title, users, onDelete, deletingEmail, onInsights, insightLoadingEmail }) {
  if (!users.length) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="muted-small" style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{title}</div>
      <div className="table-scroll">
        <table className="responsive-table">
          <thead>
            <tr><th>Email</th><th>Status</th><th>Household(s)</th><th>Joined</th><th>Location</th><th>Usage</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
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
                <td data-label="Location" className="muted-small">
                  {u.households.map((h) => h.location).find(Boolean) || '--'}
                </td>
                <td data-label="Usage" className="muted-small">
                  {u.usagePercent === null || u.usagePercent === undefined ? '--' : `${u.usagePercent}%`}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {onInsights && (
                      <button
                        type="button"
                        className="btn secondary small"
                        onClick={() => onInsights(u)}
                        disabled={!u.userId || insightLoadingEmail === u.email}
                      >
                        {insightLoadingEmail === u.email ? 'Thinking...' : 'AI Insights'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn secondary small"
                      onClick={() => onDelete(u)}
                      disabled={deletingEmail === u.email}
                    >
                      {deletingEmail === u.email ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
