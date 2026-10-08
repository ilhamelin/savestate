'use client';
import { useEffect, useSyncExternalStore } from 'react';
import { CRT_PALETTES, crtPalette } from '@/domain/crt';
const event = 'savestate-crt-change';
let memoryEnabled = false;
let memoryPalette = 'cyan';
let volatileEnabled = false;
let volatilePalette = false;
function subscribe(callback: () => void) {
  window.addEventListener(event, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(event, callback);
    window.removeEventListener('storage', callback);
  };
}
function snapshot() {
  if (volatileEnabled) return memoryEnabled;
  try {
    return localStorage.getItem('savestate.crt.v1') === 'on';
  } catch {
    return memoryEnabled;
  }
}
export function toggleCrt() {
  memoryEnabled = !snapshot();
  try {
    localStorage.setItem('savestate.crt.v1', memoryEnabled ? 'on' : 'off');
    volatileEnabled = false;
  } catch {
    volatileEnabled = true;
  }
  window.dispatchEvent(new Event(event));
}
function paletteSnapshot() {
  if (volatilePalette) return crtPalette(memoryPalette);
  try {
    return crtPalette(localStorage.getItem('savestate.crt.palette.v1'));
  } catch {
    return crtPalette(memoryPalette);
  }
}
function selectPalette(value: string) {
  memoryPalette = crtPalette(value);
  try {
    localStorage.setItem('savestate.crt.palette.v1', memoryPalette);
    volatilePalette = false;
  } catch {
    volatilePalette = true;
  }
  window.dispatchEvent(new Event(event));
}
export function CrtToggle() {
  const enabled = useSyncExternalStore(subscribe, snapshot, () => false);
  const palette = useSyncExternalStore(subscribe, paletteSnapshot, () => 'cyan' as const);
  useEffect(() => {
    document.documentElement.dataset.crtTheme = palette;
  }, [palette]);
  return (
    <>
      <button type="button" className="crt-toggle" aria-pressed={enabled} onClick={toggleCrt}>
        CRT <span>{enabled ? 'ON' : 'OFF'}</span>
      </button>
      <details className="crt-palettes">
        <summary aria-label="Seleccionar paleta de fósforo CRT">◉</summary>
        <label className="crt-palette-menu">
          Fósforo del monitor
          <select value={palette} onChange={(e) => selectPalette(e.target.value)}>
            {Object.entries(CRT_PALETTES).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </details>
      {enabled ? <div className="crt-overlay" aria-hidden="true" /> : null}
    </>
  );
}
