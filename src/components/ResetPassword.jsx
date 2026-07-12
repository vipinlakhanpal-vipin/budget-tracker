import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { passwordRuleError, PASSWORD_HINT } from '../passwordRules.js';

// Shown when the app is opened via a Supabase password-recovery link.
// Previously, clicking the reset link in the email just logged the user
// straight into the Dashboard -- Supabase establishes a real session from
// the recovery token, and App.jsx had no special handling for that, so it
// looked exactly like a normal sign-in. Nothing ever prompted for a new
// password, so the OLD password silently stayed in effect; the person had
// no way to know that, and would be locked out again the next time they
// signed out. This screen intercepts that moment (App.jsx watches for the
// PASSWORD_RECOVERY auth event) and forces an actual password change before
// continuing into the app.
export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('idle'); // idle | saving | done
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    const pwError = passwordRuleError(password);
    if (pwError) {
      setErrorMsg(pwError);
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    setStatus('saving');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus('idle');
      setErrorMsg(error.message);
      return;
    }
    setStatus('done');
    // Per explicit request: after a successful reset, take the person to the
    // actual Sign-in screen (rather than silently continuing the recovery
    // session straight into the Dashboard) so the new password is
    // immediately verified end-to-end. Remember their email first so Login's
    // sign-in field auto-fills it -- they only have to type the new
    // password, not their email too.
    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.email) localStorage.setItem('hearth-last-email', data.user.email);
    } catch {
      // ignore -- purely a nice-to-have convenience, not worth surfacing an error for
    }
    await supabase.auth.signOut();
    setTimeout(onDone, 1500);
  }

  return (
    <div className="center-screen">
      <div className="login-card">
        <h1>Hearth</h1>
        <p className="sub">Choose a new password for your account.</p>
        {status === 'done' ? (
          <div className="login-sent">Password successfully changed -- taking you to sign in...</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
            <div className="muted-small" style={{ margin: '-6px 0 8px' }}>
              {PASSWORD_HINT}
            </div>
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <button className="btn" type="submit" disabled={status === 'saving'}>
              {status === 'saving' ? 'Saving...' : 'Save new password'}
            </button>
          </form>
        )}
        {errorMsg && <div className="login-error">{errorMsg}</div>}
      </div>
    </div>
  );
}
