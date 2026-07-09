import { requireUser } from './admin/_auth.js';

// Same model as the other AI endpoints -- see categorize-expense.js for why
// this specific id (the original claude-3-5-haiku-20241022 was deprecated
// by Anthropic and returned a 404 as of mid-2026).
const MODEL = 'claude-haiku-4-5-20251001';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await requireUser(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  const { currency, categoryBudgetCaps, months } = req.body || {};
  if (!Array.isArray(months) || months.length === 0) {
    return res.status(400).json({ error: 'months is required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(200).json({ advice: null, aiEnabled: false });

  try {
    // IMPORTANT (per explicit user choice): Budget Coach is suggestions-only.
    // It must never claim to have changed anything, and the frontend never
    // wires its output to any write -- it's just text rendered in a panel.
    // The prompt says this explicitly so the model doesn't phrase anything
    // as if an action was already taken.
    const prompt = `You are an experienced, encouraging household budget coach. Review this household's last ${months.length} months of actual spending below and identify meaningful patterns -- do not just restate the raw numbers.

Look specifically for:
1. Any category that has gone over its own budget cap for 2 or more consecutive months.
2. Categories where spending is clearly trending up or down over the period (not just random month-to-month noise).
3. Whether the household's actual net (income minus total spending) suggests its savings goals are realistic, too ambitious, or too conservative.
4. Any other pattern worth flagging (e.g. a month that was a one-off outlier vs. a sustained shift).

Currency: ${currency || ''}
Category budget caps: ${JSON.stringify(categoryBudgetCaps || [])}
Monthly history (oldest first): ${JSON.stringify(months)}

You are suggestions-only -- you cannot change any setting yourself, and must never phrase a suggestion as if it has already been applied (never say "I've raised..." or "I've set..."). Write 1-2 short sentences of overall observation, then a blank line, then 3-5 specific suggestions as separate lines starting with a dash. Only state a number if it's directly calculable from the data given -- otherwise phrase the suggestion qualitatively (e.g. "consider raising the cap" rather than inventing a number). Plain text only, no markdown formatting, no headers. Keep the whole thing under 160 words.`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 450, messages: [{ role: 'user', content: prompt }] }),
    });

    if (!r.ok) {
      console.error('Anthropic API error:', r.status, await r.text());
      return res.status(200).json({ advice: null, aiEnabled: true });
    }

    const data = await r.json();
    const advice = (data?.content?.[0]?.text || '').trim();
    if (!advice) return res.status(200).json({ advice: null, aiEnabled: true });

    return res.status(200).json({ advice, aiEnabled: true });
  } catch (e) {
    console.error('budget-coach failed:', e);
    return res.status(200).json({ advice: null, aiEnabled: true });
  }
}
