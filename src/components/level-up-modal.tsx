'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { browserClient } from '@/integrations/supabase/browser';
import {
  parseSeenLevel,
  seenLevelKey,
  shouldCelebrateLevel,
  levelUpTitle,
} from '@/domain/level-up';
import { soundFx, unlockAudio, isAudioEnabled, toggleAudio } from '@/lib/sound';

export function LevelUpModal({ userId, initialLevel }: { userId: string; initialLevel: number }) {
  const [celebration, setCelebration] = useState<number | null>(null);
  const baseline = useRef<number | null>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const current = useRef(initialLevel);
  useEffect(() => {
    let disposed = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    function observe(level: number) {
      if (disposed || !Number.isInteger(level) || level < 1) return;
      current.current = level;
      let seen = baseline.current;
      try {
        seen = parseSeenLevel(localStorage.getItem(seenLevelKey(userId))) ?? seen;
      } catch {
        /* Optional storage. */
      }
      if (shouldCelebrateLevel(level, seen)) setCelebration(level);
      else if (seen === null || level < seen) {
        baseline.current = level;
        try {
          localStorage.setItem(seenLevelKey(userId), String(level));
        } catch {
          /* Optional storage. */
        }
        setCelebration(null);
      }
    }
    let running = false;
    async function refresh() {
      if (running || document.visibilityState === 'hidden') return;
      running = true;
      try {
        const db = browserClient();
        if (!db) return;
        const result = await db
          .from('profiles')
          .select('level')
          .eq('id', userId)
          .abortSignal(controller.signal)
          .maybeSingle();
        if (!result.error && result.data) observe(result.data.level);
      } catch {
        /* A celebration must not interrupt navigation. */
      } finally {
        running = false;
      }
    }
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 500);
    }
    function storage(event: StorageEvent) {
      if (event.key === seenLevelKey(userId)) {
        const seen = parseSeenLevel(event.newValue);
        if (seen !== null && seen >= current.current) {
          baseline.current = seen;
          setCelebration(null);
        }
      }
    }
    const start = setTimeout(() => observe(initialLevel), 0);
    const interval = setInterval(() => void refresh(), 60000);
    window.addEventListener('savestate:progress-changed', schedule);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', schedule);
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(start);
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('savestate:progress-changed', schedule);
      window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', schedule);
    };
  }, [userId, initialLevel]);
  useEffect(() => {
    if (celebration === null) {
      dialog.current?.close();
      return;
    }
    if (!dialog.current?.open) dialog.current?.showModal();
    soundFx.levelUp();
  }, [celebration]);
  function acknowledge() {
    if (celebration !== null) {
      baseline.current = celebration;
      try {
        localStorage.setItem(seenLevelKey(userId), String(celebration));
      } catch {
        /* Optional storage. */
      }
    }
    setCelebration(null);
  }
  return (
    <dialog
      ref={dialog}
      className="level-up-modal"
      aria-labelledby="level-up-heading"
      onCancel={(event) => {
        event.preventDefault();
        acknowledge();
      }}
    >
      {celebration !== null && (
        <>
          <div className="level-up-confetti" aria-hidden="true">
            {Array.from({ length: 32 }, (_, index) => (
              <i
                key={index}
                style={
                  {
                    '--x': `${(index * 37) % 100}%`,
                    '--delay': `${(index % 8) * 0.08}s`,
                    '--color': ['#00f0ff', '#ff9900', '#a855f7', '#39ff14'][index % 4],
                  } as CSSProperties
                }
              />
            ))}
          </div>
          <p className="eyebrow">CHECKPOINT // NUEVO RANGO</p>
          <h2 id="level-up-heading">🎉 ¡LEVEL UP! NIVEL ALCANZADO</h2>
          <strong className="level-up-number">{celebration}</strong>
          <p>👑 {levelUpTitle(celebration)}</p>
          <button
            type="button"
            className="button outline"
            onClick={async () => {
              if (!isAudioEnabled()) toggleAudio();
              await unlockAudio();
              soundFx.levelUp();
            }}
          >
            ♪ Escuchar fanfarria 8-bit
          </button>
          <button type="button" className="button" onClick={acknowledge}>
            ¡A seguir jugando! 🚀
          </button>
        </>
      )}
    </dialog>
  );
}
