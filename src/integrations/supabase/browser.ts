'use client';
import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';
import { installOfflineLibraryAuth } from '@/lib/offline-library-auth';
import type { Database } from '@/lib/database.types';
export function browserClient() {
  const { url, key } = publicEnv();
  const client = createBrowserClient<Database>(url, key);
  installOfflineLibraryAuth(client.auth);
  return client;
}
