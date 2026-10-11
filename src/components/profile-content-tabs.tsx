'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { PROFILE_TAB_ANCHORS, profileTabForHash, type ProfileTab } from '@/domain/profile-tabs';

const TABS: [ProfileTab, string][] = [
  ['library', '🎮 Biblioteca'],
  ['stats', '📊 Dossier y Estadísticas'],
  ['showcase', '🏆 Logros y Memory Card'],
];
export function ProfileContentTabs({
  library,
  statistics,
  showcase,
}: {
  library: ReactNode;
  statistics: ReactNode;
  showcase: ReactNode;
}) {
  const [tab, setTab] = useState<ProfileTab>('library');
  const id = useId();
  const frame = useRef<number | null>(null);
  function reveal(hash: string) {
    const next = profileTabForHash(hash);
    if (!next) return;
    setTab(next);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() =>
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }),
    );
  }
  useEffect(() => {
    const sync = () => reveal(window.location.hash);
    sync();
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);
  function activate(next: ProfileTab) {
    setTab(next);
    window.history.replaceState(null, '', `#${PROFILE_TAB_ANCHORS[next]}`);
  }
  const content = { library, stats: statistics, showcase };
  return (
    <div className="profile-content-tabs">
      <div role="tablist" className="profile-content-tablist" aria-label="Contenido del perfil">
        {TABS.map(([key, label], index) => (
          <button
            type="button"
            key={key}
            id={`${id}-${key}-tab`}
            role="tab"
            aria-selected={tab === key}
            aria-controls={`${id}-${key}-panel`}
            tabIndex={tab === key ? 0 : -1}
            className={`button small${tab === key ? '' : ' outline'}`}
            onClick={() => activate(key)}
            onKeyDown={(event) => {
              const target =
                event.key === 'ArrowRight'
                  ? (index + 1) % TABS.length
                  : event.key === 'ArrowLeft'
                    ? (index + TABS.length - 1) % TABS.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? TABS.length - 1
                        : null;
              if (target === null) return;
              event.preventDefault();
              const next = TABS[target]![0];
              activate(next);
              document.getElementById(`${id}-${next}-tab`)?.focus();
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {TABS.map(([key]) => (
        <div
          key={key}
          id={`${id}-${key}-panel`}
          className="profile-content-panel"
          role="tabpanel"
          aria-labelledby={`${id}-${key}-tab`}
          hidden={tab !== key}
          tabIndex={0}
        >
          {content[key]}
        </div>
      ))}
    </div>
  );
}
