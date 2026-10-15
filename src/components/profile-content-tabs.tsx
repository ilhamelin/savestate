'use client';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { PROFILE_TAB_ANCHORS, profileTabForHash, type ProfileTab } from '@/domain/profile-tabs';

export function ProfileContentTabs({
  library,
  statistics,
  showcase,
  vault,
}: {
  library: ReactNode;
  statistics: ReactNode;
  showcase: ReactNode;
  vault?: ReactNode;
}) {
  const hasVault = Boolean(vault);
  const TABS: [ProfileTab, string][] = [
    ['library', '🎮 Biblioteca'],
    ['stats', '📊 Dossier y Estadísticas'],
    ['showcase', '🏆 Logros y Memory Card'],
    ...(hasVault ? ([['vault', '💾 Bóveda']] as [ProfileTab, string][]) : []),
  ];
  const [tab, setTab] = useState<ProfileTab>('library');
  const activeTab = tab === 'vault' && !hasVault ? 'library' : tab;
  const id = useId();
  const frame = useRef<number | null>(null);
  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash;
      const next = profileTabForHash(hash);
      if (!next || (next === 'vault' && !hasVault)) return;
      setTab(next);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() =>
        document
          .getElementById(hash === '#vault' ? 'player-vault' : hash.slice(1))
          ?.scrollIntoView({ block: 'start' }),
      );
    };
    sync();
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [hasVault]);
  function activate(next: ProfileTab) {
    setTab(next);
    window.history.replaceState(null, '', `#${PROFILE_TAB_ANCHORS[next]}`);
  }
  const content = { library, stats: statistics, showcase, vault: vault ?? null };
  return (
    <div className="profile-content-tabs">
      <div role="tablist" className="profile-content-tablist" aria-label="Contenido del perfil">
        {TABS.map(([key, label], index) => (
          <button
            type="button"
            key={key}
            id={`${id}-${key}-tab`}
            role="tab"
            aria-selected={activeTab === key}
            aria-controls={`${id}-${key}-panel`}
            tabIndex={activeTab === key ? 0 : -1}
            className={`button small${activeTab === key ? '' : ' outline'}`}
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
          hidden={activeTab !== key}
          tabIndex={0}
        >
          {content[key]}
        </div>
      ))}
    </div>
  );
}
