// Shows the household's automation "webhook secret" (used to authenticate
// unattended SMS/email auto-import automation that has no logged-in
// browser session -- see api/webhook-secret.js and api/ingest-transaction.js)
// with copy/regenerate controls, plus a pointer to the E-Manual for the
// per-platform setup steps (Android MacroDroid, iOS Shortcuts/Twilio,
// mail-forwarding for email). Self-contained: manages its own state so it
// can be dropped into the Account tab with a single import + one line.
// Written with React.createElement (no JSX) to keep this file's markup
// safe to generate purely from string templates elsewhere in the toolchain.
import { useEffect, useState, createElement } from 'react';

export default function AutomationSettings({ session }) {
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

const callApi = async (body) => {
  const token = session?.access_token;
  const res = await fetch('/api/webhook-secret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body || {}),
  });
  return res.json();
};

useEffect(() => {
  let cancelled = false;
  (async () => {
    setLoading(true);
    try {
      const data = await callApi({});
      if (!cancelled && data?.secret) setSecret(data.secret);
    } catch {
    } finally {
      if (!cancelled) setLoading(false);
    }
  })();
  return () => { cancelled = true; };
}, []);

const regenerate = async () => {
  if (!window.confirm('Regenerate the automation secret? Anything already configured in MacroDroid, Shortcuts, or Twilio will stop working until you update it with the new value.')) return;
  setBusy(true);
  try {
    const data = await callApi({ action: 'regenerate' });
    if (data?.secret) {
      setSecret(data.secret);
      setRevealed(true);
    }
  } finally {
    setBusy(false);
  }
};

const copy = () => {
  if (!secret) return;
  navigator.clipboard.writeText(secret).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  });
};

const masked = secret ? secret.slice(0, 4) + '...' + secret.slice(-4) : '';

return createElement('div', { className: 'row', style: { paddingTop: 16, borderTop: '1px solid var(--border)' } },
                     createElement('div', { className: 'field', style: { width: '100%' } },
                                   createElement('label', null, 'SMS & Email Auto-Import'),
                                   createElement('div', { className: 'muted-small', style: { marginBottom: 10 } },
                                                 'Auto-capture bank transaction alerts as expenses, with AI picking the category -- no manual entry. Android is fully automatic once configured; iPhone offers a couple of quick-tap options. See the E-Manual (Help) for step-by-step setup on each platform.'
                                                 ),
                                   loading
                                   ? createElement('div', { className: 'muted-small' }, 'Loading...')
                                   : createElement('div', { className: 'row', style: { gap: 8, alignItems: 'center', flexWrap: 'wrap' } },
                                                   createElement('code', { style: { padding: '4px 8px', background: 'var(--panel)', borderRadius: 6 } }, secret ? (revealed ? secret : masked) : 'Not set up yet'),
                                                   secret ? createElement('button', { type: 'button', className: 'btn small secondary', onClick: () => setRevealed((r) => !r) }, revealed ? 'Hide' : 'Reveal') : null,
                                                   secret ? createElement('button', { type: 'button', className: 'btn small secondary', onClick: copy }, copied ? 'Copied!' : 'Copy') : null,
                                                   createElement('button', { type: 'button', className: 'btn small secondary', onClick: regenerate, disabled: busy }, busy ? 'Working...' : (secret ? 'Regenerate' : 'Create secret'))
                                                   )
                                   )
                     );
}
