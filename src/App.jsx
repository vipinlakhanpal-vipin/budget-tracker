import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Login from './components/Login.jsx';
import CreateHousehold from './components/CreateHousehold.jsx';
import Dashboard from './components/Dashboard.jsx';
import AdminConsole from './components/AdminConsole.jsx';
import Splash from './components/Splash.jsx';

const ADMIN_EMAIL = 'vipinlakhanpal@gmail.com';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [household, setHousehold] = useState(null);
  const [householdChecked, setHouseholdChecked] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  // Shown on every app start (fresh load or opening the installed PWA) for
  // a couple of seconds as a branded first impression, then removed. It's
  // purely cosmetic and doesn't block anything underneath -- auth/session
  // resolution keeps running in the background while it's up.
  const [showSplash, setShowSplash] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 4000);
    return () => clearTimeout(t);
  }, []);

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

  // IMPORTANT: this only re-resolves the household when the signed-in USER
  // actually changes (sign in, sign out, switching accounts) -- not on every
  // `session` object Supabase hands us. Supabase silently refreshes the
  // access token in the background every ~50-55 minutes (and often
  // immediately whenever you switch back to the browser tab), firing
  // onAuthStateChange with a brand new `session` object each time even
  // though it's still the same logged-in user. That used to re-run this
  // effect, which calls resolveHousehold() -> setHouseholdChecked(false) ->
  // renders the full-page "Loading..." screen in place of the Dashboard,
  // unmounting it and wiping out anything not yet saved (e.g. a half-typed
  // expense) -- this is what looked like "the page refreshes and my data
  // disappears". Keying this effect on the user's id instead of the whole
  // session object means a token refresh updates `session` in the background
  // (so API calls still use the fresh token) without ever unmounting the
  // Dashboard.
  useEffect(() => {
    if (session) {
      resolveHousehold();
    } else {
      setHousehold(null);
      setHouseholdChecked(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  async function resolveHousehold() {
    setHouseholdChecked(false);
    const email = session.user.email;

    // Auto-join any household you've been invited to under this email.
    const { data: invites } = await supabase
      .from('household_invites')
      .select('*')
      .ilike('email', email)
      .eq('status', 'pending');

    // Multiple pending invite rows can exist for the same household (e.g. a
    // retried invite). De-duplicate by household so we don't attempt to
    // insert the same membership twice.
    const seenHouseholds = new Set();
    for (const invite of invites || []) {
      if (!seenHouseholds.has(invite.household_id)) {
        seenHouseholds.add(invite.household_id);
        await supabase.from('household_members').upsert(
          {
            household_id: invite.household_id,
            user_id: session.user.id,
            email,
            role: 'member',
            relation: invite.relation || 'Other',
            name: session.user.user_metadata?.full_name || null,
            phone: session.user.user_metadata?.phone || null,
            location: session.user.user_metadata?.location || null,
          },
          { onConflict: 'household_id,user_id', ignoreDuplicates: true }
        );
      }
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

  let mainContent;

  if (loading || (session && !householdChecked)) {
    mainContent = <div className="center-screen">Loading...</div>;
  } else if (!session) {
    mainContent = <Login />;
  } else {
    const isAdmin = session.user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    if (isAdmin && showAdmin) {
      mainContent = <AdminConsole onClose={() => setShowAdmin(false)} />;
    } else if (!household) {
      mainContent = (
        <>
          {isAdmin && (
            <button
              className="btn secondary small"
              style={{ position: 'fixed', top: 12, right: 12, zIndex: 1000 }}
              onClick={() => setShowAdmin(true)}
            >
              Admin console
            </button>
          )}
          <CreateHousehold session={session} onCreated={resolveHousehold} />
        </>
      );
    } else {
      mainContent = (
        <Dashboard
          session={session}
          household={household}
          onHouseholdChange={resolveHousehold}
          isAdmin={isAdmin}
          onOpenAdmin={() => setShowAdmin(true)}
        />
      );
    }
  }

  // The splash sits on top of whatever mainContent already is (Loading /
  // Login / Dashboard, etc.) as a fixed full-screen overlay -- auth and
  // household resolution keep running underneath it the whole time, so by
  // the time it fades out the real screen is already the right one instead
  // of flashing "Loading..." first.
  return (
    <>
      {mainContent}
      {showSplash && <Splash />}
    </>
  );
}
