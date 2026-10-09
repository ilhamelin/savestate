'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/client-api';
import {
  matchingTitle,
  suggestedSteamStatus,
  type SteamPreview,
  type SteamStatus,
} from '@/domain/steam';
import {
  cleanSteamSearchTitle,
  isSteamReady,
  type SteamMatchFilter,
} from '@/domain/steam-matching';
type Candidate = {
  id: string;
  title: string;
  release_year: number | null;
  slug: string;
  cover_url: string | null;
};
type PreviewPage = {
  games: SteamPreview[];
  total: number;
  nextOffset: number | null;
  steamId: string;
  linkTicket: string;
};
export function SteamImporter({ configured }: { configured: boolean }) {
  const [profile, setProfile] = useState(''),
    [games, setGames] = useState<SteamPreview[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set()),
    [statuses, setStatuses] = useState<Record<number, SteamStatus>>({});
  const [matches, setMatches] = useState<Record<number, Candidate[]>>({}),
    [choices, setChoices] = useState<Record<number, string>>({});
  const [results, setResults] = useState<Record<number, string>>({}),
    [finished, setFinished] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [search, setSearch] = useState(''),
    [page, setPage] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [filterMode, setFilterMode] = useState<SteamMatchFilter>('all');
  const [manualQueries, setManualQueries] = useState<Record<number, string>>({});
  const [linkTicket, setLinkTicket] = useState('');
  const [linked, setLinked] = useState(false);
  const [linkMessage, setLinkMessage] = useState('');
  const [total, setTotal] = useState(0),
    [nextOffset, setNextOffset] = useState<number | null>(null),
    [loadedProfile, setLoadedProfile] = useState('');
  const cancelled = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelled.current = true;
    };
  }, []);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);
  async function preview() {
    setBusy(true);
    setError('');
    try {
      const result = await api<PreviewPage>('steam/import', { action: 'preview', profile });
      const rows = result.games;
      if (!mounted.current) return;
      setGames(rows);
      setLinkTicket(result.linkTicket);
      setLinked(false);
      setLinkMessage('');
      setTotal(result.total);
      setNextOffset(result.nextOffset);
      setLoadedProfile(profile);
      setLoaded(true);
      setSelected(new Set(rows.map((row) => row.appid)));
      setStatuses({});
      setMatches({});
      setChoices({});
      setManualQueries({});
      setFilterMode('all');
      setSearch('');
      setResults({});
      setFinished(new Set());
      setPage(0);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo consultar Steam.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function more() {
    if (nextOffset === null) return;
    setBusy(true);
    setError('');
    try {
      const result = await api<PreviewPage>('steam/import', {
        action: 'preview',
        profile: loadedProfile,
        offset: nextOffset,
      });
      if (!mounted.current) return;
      setLinkTicket(result.linkTicket);
      setGames((old) => [
        ...new Map([...old, ...result.games].map((game) => [game.appid, game])).values(),
      ]);
      setTotal(result.total);
      setNextOffset(result.nextOffset);
    } catch (failure) {
      if (mounted.current)
        setError(
          failure instanceof Error ? failure.message : 'No se pudo cargar la siguiente página.',
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function find(game: SteamPreview, title?: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const candidates = await api<Candidate[]>('steam/import', {
        action: 'match',
        ticket: game.ticket,
        ...(title !== undefined ? { title } : {}),
      });
      if (!mounted.current) return;
      setMatches((old) => ({ ...old, [game.appid]: candidates }));
      const exact = candidates.filter(
        (candidate) =>
          matchingTitle(cleanSteamSearchTitle(candidate.title)) ===
          matchingTitle(cleanSteamSearchTitle(title ?? game.name)),
      );
      setChoices((old) => ({
        ...old,
        [game.appid]: candidates.some((candidate) => candidate.id === old[game.appid])
          ? old[game.appid]!
          : exact.length === 1
            ? exact[0]!.id
            : '',
      }));
      setResults((old) => ({
        ...old,
        [game.appid]: candidates.length
          ? 'Elige y confirma la ficha que corresponde a tu juego.'
          : 'Sin coincidencias. Prueba otro título en la búsqueda manual.',
      }));
    } catch (failure) {
      if (mounted.current)
        setError(failure instanceof Error ? failure.message : 'No se pudo buscar el juego.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function linkAccount() {
    setBusy(true);
    setError('');
    try {
      const result = await api<{ message: string }>('steam/import', {
        action: 'link',
        ticket: linkTicket,
      });
      if (mounted.current) {
        setLinked(true);
        setLinkMessage(result.message);
      }
    } catch (failure) {
      if (mounted.current)
        setError(failure instanceof Error ? failure.message : 'No se pudo vincular Steam.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function commit() {
    setBusy(true);
    setError('');
    cancelled.current = false;
    try {
      for (const game of games.filter(
        (row) => selected.has(row.appid) && !finished.has(row.appid),
      )) {
        if (cancelled.current) break;
        try {
          const result = await api<{ state: string; message: string }>('steam/import', {
            action: 'commit',
            ticket: game.ticket,
            status: statuses[game.appid] ?? suggestedSteamStatus(game.minutes),
            game_id: choices[game.appid] || undefined,
          });
          if (!mounted.current) break;
          setResults((old) => ({ ...old, [game.appid]: result.message }));
          if (['imported', 'existing'].includes(result.state)) setLinked(true);
          if (['imported', 'existing'].includes(result.state))
            setFinished((old) => new Set(old).add(game.appid));
        } catch (failure) {
          if (!mounted.current) break;
          setResults((old) => ({
            ...old,
            [game.appid]: failure instanceof Error ? failure.message : 'No se pudo importar.',
          }));
        }
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  const readyCount = games.filter((game) => isSteamReady(game.appid, choices, finished)).length;
  const visible = games.filter(
      (game) =>
        game.name.toLowerCase().includes(search.toLowerCase()) &&
        (filterMode === 'all' ||
          (filterMode === 'matched') === isSteamReady(game.appid, choices, finished)),
    ),
    totalPages = Math.ceil(visible.length / 24),
    currentPage = Math.min(page, Math.max(0, totalPages - 1));
  return (
    <section className="steam-studio panel" aria-label="Importar biblioteca Steam">
      {!configured ? (
        <p className="notice">
          Steam aún no está configurado. El administrador debe añadir STEAM_API_KEY en el servidor.
          Puedes seguir usando tu biblioteca.
        </p>
      ) : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void preview();
        }}
      >
        <label>
          Steam ID 64 o enlace de perfil público
          <input
            required
            maxLength={200}
            value={profile}
            onChange={(event) => setProfile(event.target.value)}
            placeholder="https://steamcommunity.com/id/tu_perfil"
            disabled={busy}
          />
        </label>
        <button className="button" disabled={busy || !configured}>
          Consultar Steam
        </button>
      </form>
      <p className="muted">
        Tu perfil y «Detalles de juegos» deben ser públicos. Las horas de Steam son acumuladas; no
        prueban que hayas terminado un juego.
      </p>
      {error ? (
        <p role="alert" className="error-text">
          {error}
        </p>
      ) : null}
      {loaded && linkTicket ? (
        <div className="form-stack">
          <button
            type="button"
            className="button secondary"
            disabled={busy || linked}
            onClick={() => void linkAccount()}
          >
            {linked
              ? 'Cuenta vinculada para sincronización rápida'
              : 'Vincular esta cuenta para sincronización rápida'}
          </button>
          <p role="status" className="muted">
            {linkMessage ||
              'Los juegos ya importados podrán actualizar sus horas desde la biblioteca. Cambiar la cuenta no reinicia la cuota diaria.'}
          </p>
          {linked ? (
            <Link className="text-link" href="/library">
              Ir a sincronización rápida →
            </Link>
          ) : null}
        </div>
      ) : null}
      {games.length ? (
        <>
          <h2>Encontramos {total} juegos en tu cuenta de Steam.</h2>
          <p>{games.length} títulos cargados para revisión.</p>
          {nextOffset !== null ? (
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => void more()}
            >
              Cargar más juegos de Steam
            </button>
          ) : null}
          <p>
            Revisa los estados y desmarca lo que no quieras añadir. Los registros existentes se
            conservan. Solo se importan automáticamente títulos con una única coincidencia exacta;
            puedes elegir otra ficha.
          </p>
          <div className="steam-toolbar">
            <div
              className="filter-buttons"
              role="group"
              aria-label="Estado de emparejamiento Steam"
            >
              {(
                [
                  ['all', `Todos (${games.length})`],
                  ['matched', `Listos (${readyCount})`],
                  ['unmatched', `⚠️ Sin ficha / Pendientes (${games.length - readyCount})`],
                ] as const
              ).map(([mode, label]) => (
                <button
                  type="button"
                  key={mode}
                  aria-pressed={filterMode === mode}
                  disabled={busy}
                  onClick={() => {
                    setFilterMode(mode);
                    setPage(0);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <label>
              Buscar en los resultados
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
              />
            </label>
            <button
              type="button"
              className="button secondary small"
              disabled={busy}
              onClick={() => setSelected(new Set(visible.map((game) => game.appid)))}
            >
              Seleccionar resultados
            </button>
            <button
              type="button"
              className="button secondary small"
              disabled={busy}
              onClick={() => setSelected(new Set())}
            >
              Desmarcar todos
            </button>
          </div>
          <p role="status">
            {selected.size} seleccionados · {finished.size} procesados correctamente{' '}
            {busy ? '· Procesando…' : ''}
          </p>
          <div className="steam-grid">
            {visible.slice(currentPage * 24, (currentPage + 1) * 24).map((game) => (
              <article className="panel" key={game.appid}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={selected.has(game.appid)}
                    disabled={busy || finished.has(game.appid)}
                    onChange={(event) =>
                      setSelected((old) => {
                        const next = new Set(old);
                        if (event.target.checked) next.add(game.appid);
                        else next.delete(game.appid);
                        return next;
                      })
                    }
                  />
                  {game.name}
                </label>
                <p className="accent">{(game.minutes / 60).toFixed(1)} h en Steam</p>
                <label>
                  Estado para {game.name}
                  <select
                    value={statuses[game.appid] ?? suggestedSteamStatus(game.minutes)}
                    disabled={busy || finished.has(game.appid)}
                    onChange={(event) =>
                      setStatuses((old) => ({
                        ...old,
                        [game.appid]: event.target.value as SteamStatus,
                      }))
                    }
                  >
                    <option value="backlog">Backlog</option>
                    <option value="playing">Playing</option>
                    <option value="cleared">Cleared · ya lo terminé</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="button secondary small"
                  disabled={busy || finished.has(game.appid)}
                  onClick={() => void find(game)}
                >
                  Elegir ficha de catálogo
                </button>
                <form
                  className="steam-manual-search"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void find(
                      game,
                      manualQueries[game.appid] ?? cleanSteamSearchTitle(game.name).slice(0, 80),
                    );
                  }}
                >
                  <label>
                    Búsqueda manual para {game.name}
                    <input
                      type="search"
                      maxLength={80}
                      required
                      value={
                        manualQueries[game.appid] ?? cleanSteamSearchTitle(game.name).slice(0, 80)
                      }
                      disabled={busy || finished.has(game.appid)}
                      onChange={(event) =>
                        setManualQueries((old) => ({ ...old, [game.appid]: event.target.value }))
                      }
                    />
                  </label>
                  <button
                    className="button secondary small"
                    disabled={busy || finished.has(game.appid)}
                  >
                    🔍 Buscar
                  </button>
                </form>
                {matches[game.appid]?.length ? (
                  <fieldset
                    className="steam-candidates"
                    disabled={busy || finished.has(game.appid)}
                  >
                    <legend>Ficha para {game.name}</legend>
                    {matches[game.appid]!.map((candidate) => (
                      <label className="steam-candidate" key={candidate.id}>
                        <input
                          type="radio"
                          name={`steam-match-${game.appid}`}
                          checked={choices[game.appid] === candidate.id}
                          onChange={() =>
                            setChoices((old) => ({ ...old, [game.appid]: candidate.id }))
                          }
                        />
                        {candidate.cover_url ? (
                          <Image src={candidate.cover_url} alt="" width={32} height={44} />
                        ) : (
                          <span aria-hidden="true">🎮</span>
                        )}
                        <span>
                          {candidate.title}
                          <small>{candidate.release_year ?? 'Sin año'}</small>
                        </span>
                      </label>
                    ))}
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => setChoices((old) => ({ ...old, [game.appid]: '' }))}
                    >
                      Quitar ficha elegida
                    </button>
                  </fieldset>
                ) : null}
                {results[game.appid] ? <p className="notice">{results[game.appid]}</p> : null}
              </article>
            ))}
          </div>
          {!visible.length ? (
            <p role="status">No hay juegos que coincidan con estos filtros.</p>
          ) : null}
          <nav className="steam-toolbar" aria-label="Páginas de Steam">
            <button
              type="button"
              className="button secondary"
              disabled={busy || currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Anterior
            </button>
            <span>
              {currentPage + 1} / {Math.max(1, totalPages)}
            </span>
            <button
              type="button"
              className="button secondary"
              disabled={busy || currentPage + 1 >= totalPages}
              onClick={() => setPage(currentPage + 1)}
            >
              Siguiente
            </button>
          </nav>
          <button
            type="button"
            className="button"
            disabled={busy || ![...selected].some((id) => !finished.has(id))}
            onClick={() => void commit()}
          >
            Confirmar importación ({[...selected].filter((id) => !finished.has(id)).length})
          </button>
          {busy ? (
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                cancelled.current = true;
              }}
            >
              Detener después del juego actual
            </button>
          ) : null}
        </>
      ) : !busy && loaded ? (
        <p>La biblioteca está vacía.</p>
      ) : null}
      <Link className="accent" href="/library">
        Volver a mi biblioteca →
      </Link>
    </section>
  );
}
