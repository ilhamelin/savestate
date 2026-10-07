'use client';
import { useSyncExternalStore } from 'react';
const event = 'savestate-crt-change';
function subscribe(callback: () => void) {
  window.addEventListener(event, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(event, callback);
    window.removeEventListener('storage', callback);
  };
}
function snapshot() {
  try {
    return localStorage.getItem('savestate.crt.v1') === 'on';
  } catch {
    return false;
  }
}
export function CrtToggle() {
  const enabled = useSyncExternalStore(subscribe, snapshot, () => false);
  return (
    <>
      <button
        type="button"
        className="crt-toggle"
        aria-pressed={enabled}
        onClick={() => {
          try {
            localStorage.setItem('savestate.crt.v1', enabled ? 'off' : 'on');
            window.dispatchEvent(new Event(event));
          } catch {
            /* Private browsing may restrict storage. */
          }
        }}
      >
        CRT <span>{enabled ? 'ON' : 'OFF'}</span>
      </button>
      {enabled ? <div className="crt-overlay" aria-hidden="true" /> : null}
    </>
  );
}
