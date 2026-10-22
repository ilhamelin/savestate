'use client';
import { useEffect } from 'react';
import { browserClient } from '@/integrations/supabase/browser';
import { isConfigured } from '@/lib/env';

export function OfflineLibrarySessionSync() {
  useEffect(() => {
    if (!isConfigured()) return;
    try {
      browserClient();
    } catch {
      /* Offline storage is optional. */
    }
  }, []);
  return null;
}
