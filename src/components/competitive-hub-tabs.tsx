'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react';
import { api } from '@/lib/client-api';
import { ValorantProfileView } from '@/components/valorant-profile-view';
import { GenshinProfileView } from '@/components/genshin-profile-view';
import { HsrProfileView } from '@/components/hsr-profile-view';
import { RustProfileView } from '@/components/rust-profile-view';
import { VALORANT_REGIONS, type CompetitiveProfile } from '@/domain/competitive-tracker';
import { recentTrackerUids, type TrackerTab } from '@/domain/tracker-accounts';
const TRACKER_TABS = [
  ['lol', 'League of Legends', '/icons/games/lol.png'],
  ['valorant', 'Valorant (Riot ID)', '/icons/games/valorant.png'],
  ['genshin', 'Genshin Impact', '/icons/games/genshin.png'],
  ['hsr', 'Honkai: Star Rail', '/icons/games/hsr.png'],
  ['rust', 'Rust (Steam)', '/icons/games/rust.png'],
] as const;
export function CompetitiveHubTabs({
  children,
  savedGenshinUid,
  savedHsrUid,
  savedSteamId,
  initialTab = 'lol',
  initialIdentity,
  initialError,
}: {
  children: ReactNode;
  savedGenshinUid?: string | null;
  savedHsrUid?: string | null;
  savedSteamId?: string | null;
  initialTab?: TrackerTab;
  initialIdentity?: string;
  initialError?: string | null;
}) {
  function defaultIdentityForTab(targetTab: TrackerTab) {
    return targetTab === 'genshin'
      ? (savedGenshinUid ?? '')
      : targetTab === 'hsr'
        ? (savedHsrUid ?? '')
        : targetTab === 'rust'
          ? (savedSteamId ?? '')
          : '';
  }
  const [tab, setTab] = useState<TrackerTab>(initialTab);
  const [identity, setIdentity] = useState(
    () => initialIdentity ?? defaultIdentityForTab(initialTab),
  );
  const [region, setRegion] = useState('latam');
  const [data, setData] = useState<CompetitiveProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError ?? '');
  const controller = useRef<AbortController | null>(null);
  const recentRef = useRef<{ genshin: string[]; hsr: string[] }>({ genshin: [], hsr: [] });
  const [recents, setRecents] = useState<{ genshin: string[]; hsr: string[] }>({
    genshin: [],
    hsr: [],
  });
  const activeIcon = TRACKER_TABS.find(([id]) => id === tab)![2];
  useEffect(() => () => controller.current?.abort(), []);
  function select(next: typeof tab) {
    controller.current?.abort();
    setBusy(false);
    setTab(next);
    setData(null);
    setError('');
    setIdentity(defaultIdentityForTab(next));
  }
  const runInspect = useCallback(
    async (targetTab: Exclude<TrackerTab, 'lol'>, value: string, selectedRegion = 'latam') => {
      controller.current?.abort();
      const request = new AbortController();
      controller.current = request;
      setTab(targetTab);
      setIdentity(value);
      setBusy(true);
      setError('');
      setData(null);
      try {
        const result = await api<CompetitiveProfile>(
          'tracker/multi/inspect',
          targetTab === 'genshin' || targetTab === 'hsr'
            ? { game: targetTab, uid: value }
            : targetTab === 'rust'
              ? { game: targetTab, steamId: value }
              : { game: targetTab, riotId: value, region: selectedRegion },
          request.signal,
        );
        if (!request.signal.aborted) {
          setData(result);
          if (result.game === 'genshin' || result.game === 'hsr') {
            const next = {
              ...recentRef.current,
              [result.game]: recentTrackerUids(recentRef.current[result.game], result.uid),
            };
            recentRef.current = next;
            setRecents(next);
            try {
              window.localStorage.setItem(
                `savestate_recent_${result.game}_uids`,
                JSON.stringify(next[result.game]),
              );
            } catch {
              /* Storage can be disabled. */
            }
          }
        }
      } catch (failure) {
        if (!request.signal.aborted)
          setError(failure instanceof Error ? failure.message : 'No se pudo consultar.');
      } finally {
        if (!request.signal.aborted) setBusy(false);
      }
    },
    [],
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = { genshin: [] as string[], hsr: [] as string[] };
      for (const game of ['genshin', 'hsr'] as const) {
        try {
          next[game] = recentTrackerUids(
            JSON.parse(window.localStorage.getItem(`savestate_recent_${game}_uids`) ?? '[]'),
          );
        } catch {
          /* Ignore malformed or blocked storage. */
        }
      }
      recentRef.current = next;
      setRecents(next);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (initialTab === 'lol' || !initialIdentity || initialError) return;
    const timer = setTimeout(() => {
      void runInspect(initialTab, initialIdentity);
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.current?.abort();
    };
  }, [initialTab, initialIdentity, initialError, runInspect]);
  function inspect(event: FormEvent) {
    event.preventDefault();
    if (!busy && tab !== 'lol') void runInspect(tab, identity, region);
  }
  return (
    <div className="competitive-hub-tabs">
      <div className="filter-buttons" aria-label="Seleccionar tracker">
        {TRACKER_TABS.map(([id, label, icon]) => (
          <button key={id} type="button" aria-pressed={tab === id} onClick={() => select(id)}>
            <Image
              src={icon}
              alt=""
              width={22}
              height={22}
              className="tracker-tab-icon"
              unoptimized
            />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div hidden={tab !== 'lol'}>{children}</div>
      {tab !== 'lol' && (
        <section className="panel">
          <p className="eyebrow">COMPETITIVE ACCOUNT TERMINAL</p>
          <h1>
            <Image
              src={activeIcon}
              alt=""
              width={36}
              height={36}
              className="tracker-heading-icon"
              unoptimized
            />
            {tab === 'genshin'
              ? 'Genshin Impact · Enka.Network'
              : tab === 'hsr'
                ? 'Honkai: Star Rail · Enka.Network'
                : tab === 'rust'
                  ? 'Rust · Steam'
                  : 'Valorant · Cuenta Riot'}
          </h1>
          <form onSubmit={inspect} className="filter-buttons">
            <label>
              {tab === 'genshin' || tab === 'hsr'
                ? 'UID (9 o 10 dígitos)'
                : tab === 'rust'
                  ? 'Steam ID 64, enlace de perfil o nombre personalizado'
                  : 'Riot ID (Nombre#TAG)'}
              <input
                required
                maxLength={tab === 'genshin' || tab === 'hsr' ? 10 : tab === 'rust' ? 200 : 80}
                pattern={
                  tab === 'genshin' || tab === 'hsr'
                    ? '[0-9]{9,10}'
                    : tab === 'rust'
                      ? undefined
                      : '.+#.+'
                }
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
              />
            </label>
            {tab === 'valorant' && (
              <label>
                Región
                <select value={region} onChange={(e) => setRegion(e.target.value)}>
                  {VALORANT_REGIONS.map((value) => (
                    <option key={value} value={value}>
                      {value.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button className="button" disabled={busy}>
              {busy ? 'Consultando…' : 'Cargar perfil'}
            </button>
          </form>
          {(tab === 'genshin' || tab === 'hsr' || tab === 'rust') && (
            <div
              className="filter-buttons tracker-account-suggestions"
              aria-label="Sugerencias de cuenta"
            >
              {tab === 'genshin' &&
                (savedGenshinUid ? (
                  <button
                    type="button"
                    className="button secondary small"
                    onClick={() => void runInspect('genshin', savedGenshinUid)}
                  >
                    ⭐ Mi UID Genshin: {savedGenshinUid}
                  </button>
                ) : (
                  <Link className="text-link" href="/settings">
                    Guardar mi UID de Genshin en Editar perfil →
                  </Link>
                ))}
              {tab === 'hsr' &&
                (savedHsrUid ? (
                  <button
                    type="button"
                    className="button secondary small"
                    onClick={() => void runInspect('hsr', savedHsrUid)}
                  >
                    ⭐ Mi UID Honkai: {savedHsrUid}
                  </button>
                ) : (
                  <Link className="text-link" href="/settings">
                    Guardar mi UID de Honkai en Editar perfil →
                  </Link>
                ))}
              {tab === 'rust' && savedSteamId && (
                <button
                  type="button"
                  className="button secondary small"
                  onClick={() => void runInspect('rust', savedSteamId)}
                >
                  ⭐ Mi Steam ID: {savedSteamId}
                </button>
              )}
              {(tab === 'genshin' || tab === 'hsr') &&
                recents[tab]
                  .filter((uid) => uid !== (tab === 'genshin' ? savedGenshinUid : savedHsrUid))
                  .map((uid) => (
                    <button
                      type="button"
                      className="button outline small"
                      key={uid}
                      onClick={() => void runInspect(tab, uid)}
                    >
                      Reciente: {uid}
                    </button>
                  ))}
            </div>
          )}
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          {data?.game === 'genshin' && <GenshinProfileView data={data} />}
          {data?.game === 'valorant' && <ValorantProfileView data={data} />}
          {data?.game === 'hsr' && <HsrProfileView data={data} />}
          {data?.game === 'rust' && <RustProfileView data={data} />}
        </section>
      )}
    </div>
  );
}
