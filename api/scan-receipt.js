import { requireUser } from './admin/_auth.js';

// Same model as categorize-expense.js / monthly-digest.js -- see those
// files' comments for why this specific id (the original
// claude-3-5-haiku-20241022 was deprecated by Anthropic and returned a 404
// as of mid-2026). This model is multimodal (accepts image input).
const MODEL = 'claude-haiku-4-5-20251001';

// Model output should be a bare JSON array, but models sometimes wrap it in
// a markdown code fence or add a stray sentence around it despite being
// asked not to -- this pulls the array out either way rather than failing
// the whole scan over formatting.
function extractJsonArray(text) {
  if (!text) return null;
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    const bracketMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!bracketMatch) return null;
    try {
      const parsed = JSON.parse(bracketMatch[0]);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await requireUser(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  const { imageBase64, categoryNames } = req.body || {};
  if (!imageBase64 || !Array.isArray(categoryNames) || categoryNames.length === 0) {
    return res.status(400).json({ error: 'imageBase64 and categoryNames are required' });
  }
  // The browser already resizes/re-encodes to a JPEG before this ever
  // arrives (see readFileAsResizedBase64 in Dashboard.jsx), so this should
  // rarely trip -- it's a defensive backstop against Anthropic's own
  // per-image limit (~5MB base64) rather than the primary size control.
  if (imageBase64.length > 7_000_000) {
    return res.status(400).json({ error: 'Image is too large -- try a smaller photo or a screenshot instead.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(200).json({ items: [], aiEnabled: false });

  try {
    const prompt = `You are extracting expense data from a photo of a receipt or a document listing expenses, for a household budgeting app. Look at the image and identify every distinct expense in it.

If this is a single receipt/invoice with one final total, return exactly one item using that total (the amount actually paid, not each individual line item on the receipt).
If this looks like a spreadsheet, bank statement, or list that explicitly shows multiple separate expenses/transactions, return one item per row/transaction instead.

For each item:
- date: the transaction/purchase date if visible, in YYYY-MM-DD format. If no date is visible anywhere, use null.
- description: a short plain-language description (merchant name and/or what was purchased), max 8 words.
- amount: the numeric total as a plain number (no currency symbol, no commas, no text).
- categoryName: pick the single best match from exactly this list of allowed categories: ${categoryNames.join(', ')}. If nothing fits reasonably, use null.

Respond with ONLY a JSON array, no other text before or after it, no markdown code fences. Example: [{"date":"2026-07-04","description":"Grocery run at Carrefour","amount":142.50,"categoryName":"Groceries"}]

If the image doesn't contain any readable expense information at all, respond with exactly: []`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });

    if (!r.ok) {
      console.error('Anthropic API error:', r.status, await r.text());
      return res.status(200).json({ items: [], aiEnabled: true });
    }

    const data = await r.json();
    const raw = data?.content?.[0]?.text || '';
    const parsed = extractJsonArray(raw);
    if (!parsed) {
      console.error('scan-receipt: could not parse model response as JSON array:', raw.slice(0, 500));
      return res.status(200).json({ items: [], aiEnabled: true });
    }

    // Sanitize/cap defensively -- this is untrusted model output, and a
    // malformed or absurdly long response shouldn't crash the frontend or
    // let someone accidentally bulk-insert hundreds of garbage rows.
    const items = parsed
      .slice(0, 40)
      .map((item) => ({
        date: typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : null,
        description: typeof item.description === 'string' ? item.description.slice(0, 200) : '',
        amount: Number.isFinite(Number(item.amount)) ? Number(item.amount) : null,
        categoryName: typeof item.categoryName === 'string' ? item.categoryName : null,
      }))
      .filter((item) => item.amount && item.amount > 0);

    return res.status(200).json({ items, aiEnabled: true });
  } catch (e) {
    console.error('scan-receipt failed:', e);
    return res.status(200).json({ items: [], aiEnabled: true });
  }
}
