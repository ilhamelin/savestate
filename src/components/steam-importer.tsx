'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/client-api';
import { suggestedSteamStatus, type SteamPreview, type SteamStatus } from '@/domain/steam';
type Candidate = { id: string; title: string; release_year: number | null; slug: string };
type PreviewPage = { games: SteamPreview[]; total: number; nextOffset: number | null };
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
      setTotal(result.total);
      setNextOffset(result.nextOffset);
      setLoadedProfile(profile);
      setLoaded(true);
      setSelected(new Set(rows.map((row) => row.appid)));
      setStatuses({});
      setMatches({});
      setChoices({});
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
  async function find(game: SteamPreview) {
    setBusy(true);
    setError('');
    try {
      const candidates = await api<Candidate[]>('steam/import', {
        action: 'match',
        ticket: game.ticket,
      });
      setMatches((old) => ({ ...old, [game.appid]: candidates }));
      if (!candidates.length)
        setResults((old) => ({
          ...old,
          [game.appid]: 'Sin coincidencias. Puedes buscar el título desde Explorar.',
        }));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo buscar el juego.');
    } finally {
      setBusy(false);
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
  const visible = games.filter((game) => game.name.toLowerCase().includes(search.toLowerCase())),
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
                {matches[game.appid]?.length ? (
                  <label>
                    Ficha para {game.name}
                    <select
                      value={choices[game.appid] ?? ''}
                      disabled={busy || finished.has(game.appid)}
                      onChange={(event) =>
                        setChoices((old) => ({ ...old, [game.appid]: event.target.value }))
                      }
                    >
                      <option value="">Coincidencia exacta automática</option>
                      {matches[game.appid]!.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.title} ({candidate.release_year ?? 'Sin año'})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {results[game.appid] ? <p className="notice">{results[game.appid]}</p> : null}
              </article>
            ))}
          </div>
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
