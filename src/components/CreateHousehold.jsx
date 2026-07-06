import { useState } from 'react';
import { supabase } from '../supabaseClient';

const DEFAULT_CATEGORIES = [
  'Groceries', 'Rent/Mortgage', 'Utilities', 'Transportation', 'Dining Out',
  'Entertainment', 'Health', 'Shopping', 'Loan EMI', 'Credit Card EMI', 'Other',
  ];

export default function CreateHousehold({ session, onCreated }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

async function handleCreate(e) {
  e.preventDefault();
  if (!name.trim()) return;
  setBusy(true);
  setError('');

  const { data: household, error: hErr } = await supabase
  .from('households')
  .insert({ name: name.trim(), created_by: session.user.id })
  .select()
  .single();

  if (hErr) {
    setError(hErr.message);
    setBusy(false);
    return;
  }

  const { error: mErr } = await supabase.from('household_members').insert({
    household_id: household.id,
    user_id: session.user.id,
    email: session.user.email,
    role: 'owner',
    relation: 'Self',
  });

  if (mErr) {
    setError(mErr.message);
    setBusy(false);
    return;
  }

  await supabase.from('categories').insert(
    DEFAULT_CATEGORIES.map((n) => ({ name: n, household_id: household.id }))
    );
  await supabase.from('settings').insert({ household_id: household.id, total_monthly_budget: 0 });

  setBusy(false);
  onCreated();
}

async function handleSignOut() {
  await supabase.auth.signOut();
}

return (
  <div className="center-screen">
  <div className="login-card">
  <h1>Set up your household</h1>h1>
  <p className="sub">
  You're not part of a household yet. Create your own to start tracking your budget
  privately, or wait for an invite from someone who's added your email to theirs.
  </p>p>
  <form onSubmit={handleCreate}>
  <input
    type="text"
    placeholder="e.g. The Sharma Household"
    value={name}
    onChange={(e) => setName(e.target.value)}
    required
    />
  <button className="btn" type="submit" disabled={busy}>
    {busy ? 'Creating...' : 'Create my household'}
  </button>button>
  </form>form>
    {error && <div className="login-error">{error}</div>div>}
  <button className="btn secondary small" style={{ marginTop: 16 }} onClick={handleSignOut}>
  Sign out
  </button>button>
  </div>div>
  </div>div>
  );
}
</div>
