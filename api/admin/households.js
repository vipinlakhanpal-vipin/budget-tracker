import { createAdminClient, requireAdmin } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await requireAdmin(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('households')
    .select('id, name, created_at')
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.status(200).json({ households: data || [] });
}
