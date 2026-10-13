import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';
import type { Database } from '@/lib/database.types';
// Stateless anonymous queries: no cookies, no service-role bypass of library privacy.
export function publicClient() {
  const { url, key } = publicEnv();
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
