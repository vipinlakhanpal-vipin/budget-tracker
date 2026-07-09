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
    // categoryBreakdown already includes fixed/recurring bills (they're
    // grouped into their own categories, same as one-off expenses), so its
    // sum below IS the total spend excluding savings -- fixedTotal is only
    // passed separately as narrative color (e.g. "bills make up most of
    // this"), never as something to add on top. Every total the model needs
    // is precomputed here and handed over as a ready-to-use fact, precisely
    // so it never has to add up figures itself -- an earlier version left
    // that arithmetic to the model and it silently miscalculated "total
    // spent" (adding income + over-budget-amount instead of using the real
    // total), producing a number that didn't match the dashboard.
    const catLines = categoryBreakdown
      .map((c) => `- ${c.name}: ${currency || ''} ${Number(c.amount).toFixed(2)}`)
      .join('\n');
    const spendExcludingSavings = categoryBreakdown.reduce((s, c) => s + Number(c.amount), 0);
    const spendIncludingSavings = spendExcludingSavings + Number(savingsTotal || 0);
    const overLine = overBudgetCategories && overBudgetCategories.length
      ? `Categories currently over their own budget cap: ${overBudgetCategories.join(', ')}.`
      : 'No individual category is currently over its budget cap.';
    const budgetLine = Number(remaining || 0) < 0
      ? `This puts the household OVER its total monthly budget by ${currency || ''} ${Math.abs(Number(remaining || 0)).toFixed(2)}.`
      : `This is within the total monthly budget, with ${currency || ''} ${Number(remaining || 0).toFixed(2)} remaining.`;

    const prompt = `You are a friendly household budgeting assistant. Write a short, warm, plain-language summary of this household's spending for ${monthLabel}. Every figure you need is already calculated below -- use these exact numbers as given and do not perform any arithmetic of your own or restate them differently.

Total income: ${currency || ''} ${Number(totalIncome || 0).toFixed(2)}
Total monthly budget: ${currency || ''} ${Number(totalBudget || 0).toFixed(2)}
Total spent this month (expenses + fixed/recurring bills, not including savings): ${currency || ''} ${spendExcludingSavings.toFixed(2)}
Total spent including planned savings set aside: ${currency || ''} ${spendIncludingSavings.toFixed(2)}
${budgetLine}
Of the total spent, fixed/recurring bills (rent, loans, EMIs, subscriptions) make up: ${currency || ''} ${Number(fixedTotal || 0).toFixed(2)}
Planned savings set aside this month: ${currency || ''} ${Number(savingsTotal || 0).toFixed(2)}
Spending by category, highest first (this already includes fixed bills grouped into their categories):
${catLines}
${overLine}

Write 2-3 short sentences highlighting what stands out (e.g. the biggest category, whether they're over or under budget -- using the exact figures above, word-for-word where you state a number), then a blank line, then 2 short suggestions as separate lines starting with a dash. Keep the whole thing under 120 words. Plain text only, no markdown formatting, no headers.`;

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
