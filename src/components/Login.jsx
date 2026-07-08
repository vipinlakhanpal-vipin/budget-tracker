import { useState } from 'react';
import { supabase } from '../supabaseClient';

const SITE_URL = 'https://budget-tracker-tau-liart.vercel.app';

export default function Login() {
  // 'signin' | 'signup' | 'forgot'
  const [mode, setMode] = useState('signin');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [status, setStatus] = useState('idle'); // idle | sending | sent
  const [errorMsg, setErrorMsg] = useState('');

  function resetFeedback() {
    setStatus('idle');
    setErrorMsg('');
  }

  function switchMode(next) {
    setMode(next);
    resetFeedback();
  }

  async function handleSignUp(e) {
    e.preventDefault();
    setErrorMsg('');
    if (!name.trim() || !email.trim() || !location.trim() || !password) {
      setErrorMsg('Please fill in your name, email, location, and a password.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    setStatus('sending');
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: name.trim(), location: location.trim(), phone: phone.trim() || null },
        emailRedirectTo: SITE_URL,
      },
    });
    if (error) {
      setStatus('idle');
      setErrorMsg(error.message);
      return;
    }
    // If email confirmations are turned on in Supabase, there's no session
    // yet -- the user has to click the link in their inbox first. If
    // confirmations are off, `data.session` comes back populated and
    // onAuthStateChange in App.jsx will pick it up automatically.
    if (!data.session) {
      setStatus('sent');
    }
  }

  async function handleSignIn(e) {
    e.preventDefault();
    setErrorMsg('');
    if (!email.trim() || !password) {
      setErrorMsg('Please enter your email and password.');
      return;
    }
    setStatus('sending');
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setStatus('idle');
      setErrorMsg(error.message);
    }
    // On success, onAuthStateChange in App.jsx takes over -- nothing else to do here.
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setErrorMsg('');
    if (!email.trim()) {
      setErrorMsg('Enter the email address for your account.');
      return;
    }
    setStatus('sending');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: SITE_URL,
    });
    if (error) {
      setStatus('idle');
      setErrorMsg(error.message);
    } else {
      setStatus('sent');
    }
  }

  return (
    <div className="center-screen">
      <div className="login-card">
        <h1>Household Budget Tracker</h1>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'signin' ? 'active' : ''}
            onClick={() => switchMode('signin')}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => switchMode('signup')}
          >
            Sign up
          </button>
        </div>

        {mode === 'signin' && (
          <>
            <p className="sub">Sign in with your email and password.</p>
            <form onSubmit={handleSignIn}>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button className="btn" type="submit" disabled={status === 'sending'}>
                {status === 'sending' ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
            <button
              type="button"
              className="link-btn"
              onClick={() => switchMode('forgot')}
              style={{ marginTop: 10 }}
            >
              Forgot password?
            </button>
          </>
        )}

        {mode === 'signup' && (
          <>
            <p className="sub">Create your account -- you'll land in your own household, or automatically join one you've been invited to.</p>
            {status === 'sent' ? (
              <div className="login-sent">
                Check <strong>{email}</strong> to confirm your account, then come back and sign in.
              </div>
            ) : (
              <form onSubmit={handleSignUp}>
                <input
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <input
                  type="text"
                  placeholder="Location (e.g. Dubai, UAE)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  required
                />
                <input
                  type="tel"
                  placeholder="Phone number (optional)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="Password (min 6 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button className="btn" type="submit" disabled={status === 'sending'}>
                  {status === 'sending' ? 'Creating account...' : 'Sign up'}
                </button>
              </form>
            )}
          </>
        )}

        {mode === 'forgot' && (
          <>
            <p className="sub">Enter your email and we'll send you a link to reset your password.</p>
            {status === 'sent' ? (
              <div className="login-sent">
                Check <strong>{email}</strong> for a password reset link.
              </div>
            ) : (
              <form onSubmit={handleForgotPassword}>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <button className="btn" type="submit" disabled={status === 'sending'}>
                  {status === 'sending' ? 'Sending...' : 'Send reset link'}
                </button>
              </form>
            )}
            <button
              type="button"
              className="link-btn"
              onClick={() => switchMode('signin')}
              style={{ marginTop: 10 }}
            >
              Back to sign in
            </button>
          </>
        )}

        {errorMsg && <div className="login-error">{errorMsg}</div>}

        <div className="confidentiality-note">
          Your data is confidential and private to your household. It is never shared with anyone.
        </div>
      </div>
    </div>
  );
}
