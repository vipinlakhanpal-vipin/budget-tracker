import { createClient } from '@supabase/supabase-js';

export const ADMIN_EMAIL = 'vipinlakhanpal@gmail.com';

export function createAdminClient() {
  return createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function requireAdmin(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) {
    const err = new Error('Missing auth token');
    err.status = 401;
    throw err;
  }
  const admin = createAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    const err = new Error('Invalid session');
    err.status = 401;
    throw err;
  }
  if ((data.user.email || '').toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    const err = new Error('Not authorized');
    err.status = 403;
    throw err;
  }
  return data.user;
}
