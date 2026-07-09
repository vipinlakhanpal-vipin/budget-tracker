// First AI feature (see the AI roadmap: auto-categorization -> AI digest ->
// receipt scanning -> chat assistant -> agentic "Budget Coach"). Given a
// free-text expense description and the household's own category list,
// asks Claude to pick the single best-matching category so users don't have
// to manually select one every time.
//
// Requires ANTHROPIC_API_KEY as a Vercel env var. Until that's set, or if
// the call fails for any reason, this always responds 200 with
// { categoryName: null } -- a missing/failed AI suggestion should never
// break the Add Expense form, it should just silently not suggest anything.
import { requireUser } from './admin/_auth.js';

const MODEL = 'claude-haiku-4-5-20251001';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await requireUser(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  const { description, categoryNames } = req.body || {};
  if (!description || !Array.isArray(categoryNames) || categoryNames.length === 0) {
    return res.status(400).json({ error: 'description and categoryNames are required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ categoryName: null, aiEnabled: false });
  }

  try {
    const prompt =
      `You categorize personal household expenses. Given an expense description and a fixed list ` +
      `of allowed categories, reply with ONLY the single best-matching category name from the list, ` +
      `exactly as written, and nothing else -- no punctuation, no explanation. If nothing fits ` +
      `reasonably, reply with exactly: none\n\n` +
      `Allowed categories: ${categoryNames.join(', ')}\n\n` +
      `Expense description: "${description}"`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 20,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!r.ok) {
      console.error('Anthropic API error:', r.status, await r.text());
      return res.status(200).json({ categoryName: null, aiEnabled: true });
    }

    const data = await r.json();
    const raw = (data?.content?.[0]?.text || '').trim();
    const match = categoryNames.find((c) => c.toLowerCase() === raw.toLowerCase());
    return res.status(200).json({ categoryName: match || null, aiEnabled: true });
  } catch (e) {
    console.error('categorize-expense failed:', e);
    return res.status(200).json({ categoryName: null, aiEnabled: true });
  }
}
