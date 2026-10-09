'use client';
import { useState, useSyncExternalStore } from 'react';
export type LibraryViewMode = 'grid' | 'table';
const KEY = 'savestate_library_view_mode';
const EVENT = 'savestate-library-view';
function snapshot(): LibraryViewMode {
  try {
    return localStorage.getItem(KEY) === 'table' ? 'table' : 'grid';
  } catch {
    return 'grid';
  }
}
function subscribe(listener: () => void) {
  window.addEventListener('storage', listener);
  window.addEventListener(EVENT, listener);
  return () => {
    window.removeEventListener('storage', listener);
    window.removeEventListener(EVENT, listener);
  };
}
export function useLibraryViewPreference() {
  const stored = useSyncExternalStore(subscribe, snapshot, () => 'grid' as const);
  const [fallback, setFallback] = useState<LibraryViewMode | null>(null);
  function select(mode: LibraryViewMode) {
    try {
      localStorage.setItem(KEY, mode);
      setFallback(null);
      window.dispatchEvent(new Event(EVENT));
    } catch {
      setFallback(mode);
    }
  }
  return [fallback ?? stored, select] as const;
}
