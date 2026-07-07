import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const RELATIONS = ['Self', 'Spouse', 'Partner', 'Child', 'Parent', 'Sibling', 'Roommate', 'Other'];

export default function AdminConsole({ onClose, embedded = false }) {
  const [households, setHouseholds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [householdId, setHouseholdId] = useState('');
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [email, setEmail] = useState('');
  const [relation, setRelation] = useState('Other');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadHouseholds();
  }, []);

  async function authHeader() {
    const { data: { session } } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${session?.access_token}` };
  }

  async function loadHouseholds() {
    setLoading(true);
    const headers = await authHeader();
    const res = await fetch('/api/admin/households', { headers });
    const json = await res.json();
    if (res.ok) {
      setHouseholds(json.households || []);
    } else {
      setError(json.error || 'Could not load households');
    }
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setStatus('sending');
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
    const json = await res.json();
    if (!res.ok) {
      setStatus('');
      setError(json.error || 'Something went wrong');
      return;
    }
    setStatus('sent');
    setEmail('');
    setNewHouseholdName('');
    loadHouseholds();
  }

  const Wrap = embedded ? 'div' : 'div';
  const wrapClass = embedded ? '' : 'center-screen';
  const cardClass = embedded ? '' : 'login-card';

  return (
    <Wrap className={wrapClass}>
      <div className={cardClass} style={embedded ? { textAlign: 'left' } : { maxWidth: 480, textAlign: 'left' }}>
        <h1 style={{ textAlign: embedded ? 'left' : 'center', fontSize: embedded ? 18 : undefined }}>Admin console</h1>
        <p className="sub" style={{ textAlign: embedded ? 'left' : 'center' }}>
          Create a login and send the household invite in one step.
        </p>

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

        <button className="btn secondary small" style={{ marginTop: 16 }} onClick={onClose}>
          {embedded ? 'Close' : 'Back'}
        </button>
      </div>
    </Wrap>
  );
}
