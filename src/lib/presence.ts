'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { browserClient } from '@/integrations/supabase/browser';
import { createPresenceStore } from './presence-store';

const presence = createPresenceStore(browserClient);

export function useOnlineUsers(currentUserId?: string | null): ReadonlySet<string> {
  useEffect(() => presence.retain(currentUserId), [currentUserId]);
  return useSyncExternalStore(presence.subscribe, presence.getSnapshot, presence.getServerSnapshot);
}
