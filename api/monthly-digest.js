import { requireUser } from './admin/_auth.js';

// Same model as categorize-expense.js -- see that file's comment for why
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

  const {
    currency, monthLabel, totalIncome, totalBudget, remaining,
    fixedTotal, savingsTotal, categoryBreakdown, overBudgetCategories,
  } = req.body || {};

  if (!monthLabel || !Array.isArray(categoryBreakdown)) {
    return res.status(400).json({ error: 'monthLabel and categoryBreakdown are required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(200).json({ digest: null, aiEnabled: false });

  try {
    const catLines = categoryBreakdown
      .map((c) => `- ${c.name}: ${currency || ''} ${Number(c.amount).toFixed(2)}`)
      .join('\n');
    const overLine = overBudgetCategories && overBudgetCategories.length
      ? `Categories currently over their own budget cap: ${overBudgetCategories.join(', ')}.`
      : 'No individual category is currently over its budget cap.';

    const prompt = `You are a friendly household budgeting assistant. Write a short, warm, plain-language summary of this household's spending for ${monthLabel}, based only on the numbers below. Do not invent any numbers not given to you.

Total income: ${currency || ''} ${Number(totalIncome || 0).toFixed(2)}
Total monthly budget: ${currency || ''} ${Number(totalBudget || 0).toFixed(2)}
Remaining after all spending and savings: ${currency || ''} ${Number(remaining || 0).toFixed(2)}
Fixed/recurring bills total: ${currency || ''} ${Number(fixedTotal || 0).toFixed(2)}
Planned savings total: ${currency || ''} ${Number(savingsTotal || 0).toFixed(2)}
Spending by category (highest first):
${catLines}
${overLine}

Write 2-3 short sentences highlighting what stands out (e.g. the biggest category, whether they're over or under budget), then a blank line, then 2 short suggestions as separate lines starting with a dash. Keep the whole thing under 120 words. Plain text only, no markdown formatting, no headers.`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 300, messages: [{ role: 'user', content: prompt }] }),
    });

    if (!r.ok) {
      console.error('Anthropic API error:', r.status, await r.text());
      return res.status(200).json({ digest: null, aiEnabled: true });
    }

    const data = await r.json();
    const text = (data?.content?.[0]?.text || '').trim();
    if (!text) return res.status(200).json({ digest: null, aiEnabled: true });

    return res.status(200).json({ digest: text, aiEnabled: true });
  } catch (e) {
    console.error('monthly-digest failed:', e);
    return res.status(200).json({ digest: null, aiEnabled: true });
  }
}
