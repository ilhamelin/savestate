'use client';
import { useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react';
import { api } from '@/lib/client-api';
import { ValorantProfileView } from '@/components/valorant-profile-view';
import { GenshinProfileView } from '@/components/genshin-profile-view';
import { GameLiveRadarSearch } from '@/components/game-live-radar-search';
import { VALORANT_REGIONS, type CompetitiveProfile } from '@/domain/competitive-tracker';
export function CompetitiveHubTabs({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<'lol' | 'valorant' | 'genshin' | 'radar'>('lol');
  const [identity, setIdentity] = useState('');
  const [region, setRegion] = useState('latam');
  const [data, setData] = useState<CompetitiveProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  function select(next: typeof tab) {
    controller.current?.abort();
    setBusy(false);
    setTab(next);
    setData(null);
    setError('');
    setIdentity('');
  }
  async function inspect(event: FormEvent) {
    event.preventDefault();
    if (busy || tab === 'lol' || tab === 'radar') return;
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setError('');
    setData(null);
    try {
      const result = await api<CompetitiveProfile>(
        'tracker/multi/inspect',
        tab === 'genshin' ? { game: tab, uid: identity } : { game: tab, riotId: identity, region },
        request.signal,
      );
      if (!request.signal.aborted) setData(result);
    } catch (failure) {
      if (!request.signal.aborted)
        setError(failure instanceof Error ? failure.message : 'No se pudo consultar.');
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="competitive-hub-tabs">
      <div className="filter-buttons" aria-label="Seleccionar tracker">
        {(
          [
            ['lol', '⚔️ League of Legends'],
            ['valorant', '🎯 Valorant (Riot ID)'],
            ['genshin', '✨ Genshin Impact'],
            ['radar', '📡 Radar en Vivo (Steam · Ofertas · Twitch)'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={tab === id} onClick={() => select(id)}>
            {label}
          </button>
        ))}
      </div>
      <div hidden={tab !== 'lol'}>{children}</div>
      {tab === 'radar' && <GameLiveRadarSearch />}
      {(tab === 'valorant' || tab === 'genshin') && (
        <section className="panel">
          <p className="eyebrow">COMPETITIVE ACCOUNT TERMINAL</p>
          <h1>{tab === 'genshin' ? 'Genshin Impact · Enka.Network' : 'Valorant · Cuenta Riot'}</h1>
          <form onSubmit={inspect} className="filter-buttons">
            <label>
              {tab === 'genshin' ? 'UID (9 o 10 dígitos)' : 'Riot ID (Nombre#TAG)'}
              <input
                required
                maxLength={tab === 'genshin' ? 10 : 80}
                pattern={tab === 'genshin' ? '[0-9]{9,10}' : '.+#.+'}
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
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          {data?.game === 'genshin' && <GenshinProfileView data={data} />}
          {data?.game === 'valorant' && <ValorantProfileView data={data} />}
        </section>
      )}
    </div>
  );
}
