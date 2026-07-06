import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
const [status, setStatus] = useState('idle');
const [errorMsg, setErrorMsg] = useState('');

async function handleSubmit(e) {
e.preventDefault();
if (!email.trim()) return;
setStatus('sending');
setErrorMsg('');

const { error } = await supabase.auth.signInWithOtp({
email: email.trim(),
options: { shouldCreateUser: false },
});

if (error) {
setStatus('error');
setErrorMsg(error.message);
} else {
setStatus('sent');
}
}

return (
<div className="center-screen">
<div className="login-card">
<h1>Household Budget Tracker</h1>
<p className="sub">Sign in with the email address you were invited with.</p>

{status === 'sent' ? (
<div className="login-sent">
Check <strong>{email}</strong> for a sign-in link.
</div>
) : (
<form onSubmit={handleSubmit}>
<input
type="email"
placeholder="you@example.com"
value={email}
onChange={(e) => setEmail(e.target.value)}
required
/>
<button className="btn" type="submit" disabled={status === 'sending'}>
{status === 'sending' ? 'Sending link...' : 'Send sign-in link'}
</button>
</form>
)}

{status === 'error' && (
<div className="login-error">
{errorMsg || 'Something went wrong. Make sure this email was invited from the Supabase dashboard.'}
</div>
)}
</div>
</div>
);
}
