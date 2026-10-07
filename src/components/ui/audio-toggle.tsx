'use client';
import { useSyncExternalStore } from 'react';
import { isAudioEnabled, subscribeAudio, toggleAudio, soundFx } from '@/lib/sound';
export function AudioToggle() {
  const enabled = useSyncExternalStore(subscribeAudio, isAudioEnabled, () => false);
  return (
    <button
      type="button"
      className="crt-toggle"
      aria-label="Sonidos retro"
      aria-pressed={enabled}
      onClick={() => {
        if (toggleAudio()) soundFx.click();
      }}
    >
      AUDIO <span>{enabled ? 'ON' : 'OFF'}</span>
    </button>
  );
}
