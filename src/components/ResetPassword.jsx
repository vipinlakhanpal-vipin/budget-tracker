import { useState } from 'react';
import { supabase } from '../supabaseClient';

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
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
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
    // The recovery link already left them signed in with a valid session --
    // no need to force a second sign-in with the password they just set.
    setTimeout(onDone, 1200);
  }

  return (
    <div className="center-screen">
      <div className="login-card">
        <h1>Hearth</h1>
        <p className="sub">Choose a new password for your account.</p>
        {status === 'done' ? (
          <div className="login-sent">Password updated -- taking you to your account...</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="password"
              placeholder="New password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
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
