import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Login from './components/Login.jsx';
import CreateHousehold from './components/CreateHousehold.jsx';
import Dashboard from './components/Dashboard.jsx';

export default function App() {
const [session, setSession] = useState(null);
const [loading, setLoading] = useState(true);
const [household, setHousehold] = useState(null);
const [householdChecked, setHouseholdChecked] = useState(false);

useEffect(() => {
supabase.auth.getSession().then(({ data: { session } }) => {
setSession(session);
setLoading(false);
});

const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
setSession(session);
});

return () => listener.subscription.unsubscribe();
}, []);

useEffect(() => {
if (session) {
resolveHousehold();
} else {
setHousehold(null);
setHouseholdChecked(false);
}
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [session]);

async function resolveHousehold() {
setHouseholdChecked(false);
const email = session.user.email;

// Auto-join any household you've been invited to under this email.
const { data: invites } = await supabase
.from('household_invites')
.select('*')
.ilike('email', email)
.eq('status', 'pending');

for (const invite of invites || []) {
await supabase.from('household_members').insert({
household_id: invite.household_id,
user_id: session.user.id,
email,
role: 'member',
relation: invite.relation || 'Other',
});
await supabase.from('household_invites').update({ status: 'accepted' }).eq('id', invite.id);
}

const { data: memberships } = await supabase
.from('household_members')
.select('household_id, role, households(name)')
.eq('user_id', session.user.id);

if (memberships && memberships.length > 0) {
const m = memberships[0];
setHousehold({ id: m.household_id, role: m.role, name: m.households?.name });
} else {
setHousehold(null);
}
setHouseholdChecked(true);
}

if (loading || (session && !householdChecked)) {
return <div className="center-screen">Loading...</div>;
}

if (!session) return <Login />;
if (!household) return <CreateHousehold session={session} onCreated={resolveHousehold} />;
return <Dashboard session={session} household={household} onHouseholdChange={resolveHousehold} />;
}
