'use client';
import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';
import type { Database } from '@/lib/database.types';
export function browserClient() {
  const { url, key } = publicEnv();
  return createBrowserClient<Database>(url, key);
}
