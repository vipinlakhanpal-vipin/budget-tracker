import { requireUser } from './admin/_auth.js';

// Same model as the other AI endpoints -- see categorize-expense.js for why
// this specific id (the original claude-3-5-haiku-20241022 was deprecated
// by Anthropic and returned a 404 as of mid-2026).
const MODEL = 'claude-haiku-4-5-20251001';

// Keeps the request small and the model's context tight -- a chat rarely
// needs more than the last handful of turns to stay coherent, and every
// request already re-sends a fresh snapshot of the household's numbers
// anyway (see `context` below), so old turns are only needed for
// conversational continuity, not for the numbers themselves.
const MAX_HISTORY_TURNS = 10;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await requireUser(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  const { message, history, context } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(200).json({ reply: null, aiEnabled: false });

  try {
    const ctx = context || {};
    const systemPrompt = `You are a friendly, concise budgeting assistant embedded inside a household budget tracker app called Hearth. Answer the user's question using ONLY the household data provided below -- never invent numbers, transactions, or dates that aren't in it. If the question needs information not present in this data (e.g. a specific individual transaction not listed, or a time period outside what's given), say plainly that you don't have that information rather than guessing.

Keep answers conversational and short (1-4 sentences for most questions) -- like a knowledgeable friend texting back, not a formal report. Do not give generic investment or financial advice unrelated to this household's own budget data; you are not a licensed financial advisor.

Reply in plain text only -- this renders directly inside a chat bubble with no markdown support, so do not use asterisks, bullet points, headers, or any other markdown formatting. Write category or number emphasis as plain words instead (e.g. "Rent/Mortgage at AED 12,880" not "**Rent/Mortgage** at AED 12,880").

IMPORTANT: every month object in recentMonths already includes a "remainingVsBudget" field -- a negative number means the household was over its total monthly budget that month by that exact amount; a positive number means that much was left; null means no budget is set. Always use this field directly when asked whether the household is over or under budget -- never recompute it yourself by comparing other totals, since that has previously produced wrong answers.

HOUSEHOLD DATA (currency: ${ctx.currency || 'the household currency'}):
Total monthly budget: ${ctx.totalBudget ?? 'not set'}
Category budget caps: ${JSON.stringify(ctx.categoryBudgetCaps || [])}
Fixed/recurring bills: ${JSON.stringify(ctx.fixedExpenses || [])}
This month's savings goals: ${JSON.stringify(ctx.savingsGoalsThisMonth || [])}
Recent months (most recent last -- the last entry is the month currently being viewed), each with income, total expenses, savings, spend broken down by category, any category that went over its own cap that month, and remainingVsBudget (see above):
${JSON.stringify(ctx.recentMonths || [])}`;

    const trimmedHistory = Array.isArray(history) ? history.slice(-MAX_HISTORY_TURNS) : [];
    const messages = [
      ...trimmedHistory
        .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
        .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) })),
      { role: 'user', content: message.slice(0, 2000) },
    ];

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system: systemPrompt,
        messages,
      }),
    });

    if (!r.ok) {
      console.error('Anthropic API error:', r.status, await r.text());
      return res.status(200).json({ reply: null, aiEnabled: true });
    }

    const data = await r.json();
    const reply = (data?.content?.[0]?.text || '').trim();
    if (!reply) return res.status(200).json({ reply: null, aiEnabled: true });

    return res.status(200).json({ reply, aiEnabled: true });
  } catch (e) {
    console.error('chat-assistant failed:', e);
    return res.status(200).json({ reply: null, aiEnabled: true });
  }
}
