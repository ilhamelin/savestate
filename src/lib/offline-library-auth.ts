import type { SupabaseClient } from '@supabase/supabase-js';
import { revokeOfflineLibrary, synchronizeOfflineLibraryAccount } from '../../public/offline-library/store.mjs';

const installed = new WeakSet<object>();
export function installOfflineLibraryAuth(auth: SupabaseClient['auth']) {
  if (installed.has(auth)) return;
  installed.add(auth);
  const signOut = auth.signOut.bind(auth);
  auth.signOut = async (options) => {
    await revokeOfflineLibrary().catch(() => undefined);
    return signOut(options);
  };
  auth.onAuthStateChange((event, session) => {
    // Never await another Supabase auth call from this callback.
    if (event === 'SIGNED_OUT') void revokeOfflineLibrary().catch(() => undefined);
    else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
      void synchronizeOfflineLibraryAccount(session?.user.id ?? null).catch(() => undefined);
    }
  });
}
