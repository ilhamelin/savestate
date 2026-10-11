'use client';
import { useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react';
import { api } from '@/lib/client-api';
import { VALORANT_REGIONS, type CompetitiveProfile } from '@/domain/competitive-tracker';
export function CompetitiveHubTabs({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<'lol' | 'valorant' | 'genshin'>('lol');
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
    if (busy || tab === 'lol') return;
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
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={tab === id} onClick={() => select(id)}>
            {label}
          </button>
        ))}
      </div>
      <div hidden={tab !== 'lol'}>{children}</div>
      {tab !== 'lol' && (
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
          {data?.game === 'genshin' && (
            <div className="competitive-profile">
              <h2>{data.nickname}</h2>
              <p>{data.signature}</p>
              <div className="tags">
                <span className="tag">AR {data.level}</span>
                <span className="tag">WL {data.worldLevel}</span>
                <span className="tag">🏆 {data.achievements} logros</span>
                <span className="tag">Abismo {data.abyss}</span>
                <span className="tag">Amistad máxima: {data.fetterCount}</span>
              </div>
              <h3>Escaparate público de personajes</h3>
              <div className="competitive-showcase">
                {data.showcase.map((character) => (
                  <article className="panel" key={character.avatarId}>
                    <strong>Personaje #{character.avatarId}</strong>
                    <p>
                      Nivel {character.level} · {character.element}
                    </p>
                  </article>
                ))}
              </div>
              {!data.showcase.length && (
                <p className="muted">El jugador no tiene personajes públicos en su escaparate.</p>
              )}
            </div>
          )}
          {data?.game === 'valorant' && (
            <div className="competitive-profile">
              <h2>
                {data.gameName}#{data.tagLine}
              </h2>
              <p className="accent">✓ Cuenta Riot verificada</p>
              <p>
                Shard activo: {data.activeShard ?? 'No disponible'} · Región solicitada:{' '}
                {data.region.toUpperCase()}
              </p>
              <p className="muted">
                PUUID: {data.puuid.slice(0, 12)}… · Verificada:{' '}
                {new Date(data.verifiedAt).toLocaleString('es-CL')}
              </p>
              <p className="notice">
                Esta consulta verifica la identidad y el shard; no proporciona rango, estadísticas
                ni historial competitivo.
              </p>
              <a
                className="button outline"
                href={`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(`${data.gameName}#${data.tagLine}`)}/overview`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Consultar estadísticas externas ↗
              </a>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
