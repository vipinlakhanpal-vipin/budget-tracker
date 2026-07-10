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
    const systemPrompt = `You are a friendly, concise assistant embedded inside a household budget tracker app called Hearth. You have two jobs, and you should recognize which one a question needs (or answer both if it's mixed):

1. Answer questions about THIS household's own budget data -- income, fixed expenses, one-off spending, savings, who's in the household -- using ONLY the data provided below. Never invent numbers, transactions, or dates that aren't in it. If the question needs information not present in this data (e.g. a specific individual transaction not listed, or a time period outside what's given), say plainly that you don't have that information rather than guessing.
2. Answer "how do I..." / "what does this do" questions about the app ITSELF -- every tab (Income, Fixed Expenses, Add an expense, Savings), the charts, AI Insights, Budget Coach, the Report, Settings, Users -- using the HOW THE APP WORKS reference below. You are not restricted to only the tab the user happens to be looking at; you can be asked about, and should answer about, any tab or feature in the app.

You should also proactively make suggestions when asked (e.g. "any suggestions to spend less", "how can I save more") -- reason over the real numbers below (categories running over their cap, spending trending up, a savings goal that looks unrealistic given recent income, etc.) rather than giving generic advice unrelated to this household's own data; you are not a licensed financial advisor, so keep suggestions practical and grounded in what you can actually see in the data, not investment advice.

Keep answers conversational and short (1-4 sentences for most questions, a little longer if genuinely listing a few suggestions) -- like a knowledgeable friend texting back, not a formal report.

Reply in plain text only -- this renders directly inside a chat bubble with no markdown support, so do not use asterisks, bullet points, headers, or any other markdown formatting. Write category or number emphasis as plain words instead (e.g. "Rent/Mortgage at AED 12,880" not "**Rent/Mortgage** at AED 12,880").

IMPORTANT: every month object in recentMonths already includes a "remainingVsBudget" field -- a negative number means the household was over its total monthly budget that month by that exact amount; a positive number means that much was left; null means no budget is set. Always use this field directly when asked whether the household is over or under budget -- never recompute it yourself by comparing other totals, since that has previously produced wrong answers.

HOW THE APP WORKS (use this for any "how do I" / "what is" / "where do I find" question about the app itself, not just the tab currently open):
- Add an expense: log one-off spending -- date, category, short description, amount, then Add. Shows up under "Expenses this month" and is always editable there inline.
- Scan a receipt: below Add-an-expense, upload a photo of a receipt or a list of expenses and it reads them into an editable review list -- nothing saves until the user confirms which rows to keep.
- Income: add each income source per month (e.g. Salary). Does NOT roll over automatically -- add a fresh row each month or move an existing row's Month field forward, since pay can change month to month. Auto-saves.
- Fixed Expenses: recurring bills/loans/EMIs/rent. Set Start date, optional End date, and how often it repeats (Monthly, Alternate month, Quarterly, Half-yearly, Once a year). Auto-saves. A Due date triggers an in-app reminder starting 3 days before, plus email if set up.
- Savings: set aside an amount per month (e.g. "Emergency fund"). Same no-rollover pattern as Income -- add fresh each month. Counted as an expense in Spent-so-far/Combined-expenses and subtracted from Remaining/Net, since money set aside isn't available to spend.
- Spending-by-category chart: toggle Pie / Bar / Pareto / Treemap. Pie groups small categories into "Other"; Bar and Treemap show every category individually.
- AI Insights: one-tap AI summary of the month being viewed -- only runs when the user taps Generate, never automatically.
- Budget Coach: looks across the last 6 months for patterns (a category consistently over budget, a trend, an unrealistic savings goal) -- only ever suggests, never changes Settings itself.
- Report: generates a PDF for any date range -- Income, Expenses, Fixed Expenses, Savings, Spend Analysis, and Recommendations each get a page; can be viewed on screen, downloaded, or emailed.
- Settings: total monthly budget, currency, categories, optional per-category budget caps (triggers an over-budget warning banner). Auto-saves.
- Users: see active and pending household members with Name/Email/Phone/Location; owners can invite people and fill in/fix anyone's details.
- All data is private to this household only, never shared outside it.

HOUSEHOLD DATA (currency: ${ctx.currency || 'the household currency'}):
Total monthly budget: ${ctx.totalBudget ?? 'not set'}
Household members: ${JSON.stringify(ctx.householdMembers || [])}
Category budget caps: ${JSON.stringify(ctx.categoryBudgetCaps || [])}
Fixed/recurring bills: ${JSON.stringify(ctx.fixedExpenses || [])}
This month's savings goals: ${JSON.stringify(ctx.savingsGoalsThisMonth || [])}
This month's individual income sources (source name, household member, amount) -- use this, not just the "income" total inside recentMonths, for any question naming a specific income source or asking "where does our income come from": ${JSON.stringify(ctx.incomeThisMonth || [])}
Recent months (most recent last -- the last entry is the month currently being viewed), each with income, total expenses, savings, spend broken down by category, any category that went over its own cap that month, and remainingVsBudget (see above):
${JSON.stringify(ctx.recentMonths || [])}

Individual one-off expense transactions for the currently viewed month (date, description, category, amount, paymentSource, paymentBank) -- use this list, not just the category totals above, to answer anything about a specific purchase, merchant, description, or which card/account/cash paid for something. paymentSource is one of Cash, Credit Card, or Debit Card; paymentBank (when present) is the specific bank/card name -- e.g. a transaction with paymentSource "Credit Card" and paymentBank "FAB (First Abu Dhabi Bank)" was paid on that FAB credit card. When asked "what did I spend on my [bank] card", filter this list by paymentBank (and/or paymentSource), don't confuse it with a same-named entry in fixedExpenses (a fixed/recurring bill's own EMI payment is a different thing from one-off purchases charged to that same card):
${JSON.stringify(ctx.transactionsThisMonth || [])}

Individual one-off expense transactions for the previous month, same fields, for month-to-month comparisons at the transaction level:
${JSON.stringify(ctx.transactionsPreviousMonth || [])}`;

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
        max_tokens: 550,
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
