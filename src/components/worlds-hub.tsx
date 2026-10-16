'use client';
import { useEffect, useRef, useState } from 'react';
import { readJsonResponse } from '@/lib/api-response';
import { WorldsRosters, WorldsPerformance } from '@/components/worlds-performance';
import { WorldsMusicPlayer } from '@/components/worlds-music-player';
import {
  worldsViewModeForKey,
  WORLDS_BROADCAST_SIGNALS,
  findWorldsBroadcastSignal,
  buildWorldsFrameUrl,
  deduplicateWorldsVods,
  type WorldsViewMode,
} from '@/domain/worlds-features';
import {
  describeWorldsMatch,
  pickDefaultWorldsMatch,
  type WorldsSchedule,
  type WorldsMatchEvent,
  type WorldsMatchDetail,
  type WorldsTeam,
  type WorldsStageSlug,
} from '@/domain/worlds-schedule';
function dateLabel(value: string, full = false) {
  return new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: full ? 'long' : 'short',
    ...(full ? { year: 'numeric' as const } : {}),
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}
function statusLabel(match: WorldsMatchEvent) {
  return match.state === 'inProgress'
    ? '🔴 EN VIVO'
    : match.state === 'completed'
      ? 'Finalizado'
      : 'Próximo';
}
function TeamLogo({ team, large = false }: { team: WorldsTeam; large?: boolean }) {
  return team.imageUrl ? (
    <img
      src={team.imageUrl}
      alt={`Escudo de ${team.name}`}
      width={large ? 80 : 32}
      height={large ? 80 : 32}
      loading="lazy"
      decoding="async"
    />
  ) : null;
}
function countdown(match: WorldsMatchEvent, now: number) {
  if (match.state === 'inProgress') return '🔴 EN DIRECTO';
  if (match.state === 'completed')
    return 'Serie finalizada · Repeticiones cuando estén disponibles';
  const seconds = Math.max(0, Math.floor((Date.parse(match.startTime) - now) / 1000));
  if (!seconds) return 'Esperando confirmación de inicio de LoL Esports';
  return `Comienza en ${Math.floor(seconds / 86400)}d ${String(Math.floor(seconds / 3600) % 24).padStart(2, '0')}h ${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}m ${String(seconds % 60).padStart(2, '0')}s`;
}
export function WorldsHub({ initial }: { initial: WorldsSchedule }) {
  const [schedule, setSchedule] = useState(initial);
  const first = initial.stages
    .flatMap((stage) => stage.matches)
    .find((match) => match.id === initial.defaultMatchId);
  const [stageSlug, setStageSlug] = useState<WorldsStageSlug>(first?.stageSlug ?? 'play-ins');
  const [selectedId, setSelectedId] = useState(initial.defaultMatchId);
  const [detail, setDetail] = useState<WorldsMatchDetail | null>(null);
  const [detailError, setDetailError] = useState('');
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [signal, setSignal] = useState<string>('lvpes');
  const [vodId, setVodId] = useState<string | null>(null);
  const [hostname, setHostname] = useState('');
  const [now, setNow] = useState(Date.parse(initial.fetchedAt));
  const [refreshError, setRefreshError] = useState('');
  const [viewMode, setViewMode] = useState<WorldsViewMode>('normal');
  const theaterToggle = useRef<HTMLButtonElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  const cache = useRef(new Map<string, { value: WorldsMatchDetail; expires: number }>());
  const matches = schedule.stages.flatMap((stage) => stage.matches);
  const match = matches.find((event) => event.id === selectedId) ?? null;
  const stage = schedule.stages.find((item) => item.slug === stageSlug)!;
  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest('input, textarea, select, [role="textbox"], dialog[open]'))
      )
        return;
      if (!['c', 't', 'escape'].includes(event.key.toLowerCase())) return;
      event.preventDefault();
      setViewMode((mode) => worldsViewModeForKey(mode, event.key));
      if (event.key === 'Escape') theaterToggle.current?.focus();
    }
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, []);
  useEffect(() => {
    const resize = () =>
      hubRef.current?.style.setProperty(
        '--worlds-viewport-width',
        `${document.documentElement.clientWidth}px`,
      );
    resize();
    window.addEventListener('resize', resize);
    const timer = setTimeout(() => {
      setHostname(window.location.hostname);
      setNow(Date.now());
    }, 0);
    const tick = setInterval(() => {
      if (document.visibilityState === 'visible') setNow(Date.now());
    }, 1000);
    return () => {
      clearTimeout(timer);
      clearInterval(tick);
      window.removeEventListener('resize', resize);
    };
  }, []);
  useEffect(() => {
    let disposed = false;
    let controller: AbortController | null = null;
    async function refresh() {
      if (document.visibilityState !== 'visible') return;
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch('/api/worlds', {
          signal: controller.signal,
          cache: 'no-store',
        });
        const value = await readJsonResponse<WorldsSchedule>(response);
        if (!disposed && !controller.signal.aborted) {
          setSchedule(value);
          setRefreshError('');
        }
      } catch {
        if (!disposed && !controller?.signal.aborted)
          setRefreshError(
            'No se pudo actualizar el calendario; se conserva la última información.',
          );
      }
    }
    const poll = setInterval(() => void refresh(), 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      disposed = true;
      controller?.abort();
      clearInterval(poll);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  useEffect(() => {
    const matchId = selectedId;
    if (!matchId) return;
    const controller = new AbortController();
    const loadDetail = () => {
      if (document.visibilityState !== 'visible') return;
      setDetailError('');
      const cached = cache.current.get(matchId);
      if (cached && cached.expires > Date.now()) {
        setDetail(cached.value);
        setLoadingDetail(false);
        return;
      }
      setLoadingDetail(true);
      void fetch(`/api/worlds/${encodeURIComponent(matchId)}`, {
        signal: controller.signal,
        cache: 'no-store',
      })
        .then((response) => readJsonResponse<WorldsMatchDetail>(response))
        .then((value) => {
          if (!controller.signal.aborted) {
            cache.current.set(matchId, { value, expires: Date.now() + 15000 });
            setDetail(value);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setDetailError(
              'El detalle de mapas aún no está disponible. Puedes seguir la señal oficial.',
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoadingDetail(false);
        });
    };
    const timer = setTimeout(loadDetail, 0);
    const poll = setInterval(loadDetail, 30000);
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      controller.abort();
    };
  }, [selectedId]);
  // Never render details from the previous selection while a new request starts.
  const selectedDetail = detail?.id === match?.id ? detail : null;
  const description = match ? describeWorldsMatch(match, selectedDetail) : null;
  const vodGroups = deduplicateWorldsVods(selectedDetail?.games ?? [], signal);
  const allFlatVods =
    selectedDetail?.games.flatMap((game) =>
      game.vods.map((vod) => ({ ...vod, number: game.number })),
    ) ?? [];
  const activeVod = allFlatVods.find((vod) => vod.parameter === vodId);
  const audioVods =
    vodGroups
      .find((group) => group.gameNumber === activeVod?.number)
      ?.availableVods.filter((vod) => ['es-MX', 'es-ES', 'en-US', 'pt-BR'].includes(vod.locale)) ??
    [];
  const activeSignal = findWorldsBroadcastSignal(signal);
  const frameUrl = buildWorldsFrameUrl(activeSignal, hostname, activeVod?.parameter);
  function selectStage(slug: WorldsStageSlug) {
    const next = schedule.stages.find((item) => item.slug === slug)!;
    setStageSlug(slug);
    setSelectedId(pickDefaultWorldsMatch(next.matches, now)?.id ?? null);
    setVodId(null);
  }
  return (
    <div className="worlds-hub" ref={hubRef}>
      <div className="worlds-backdrop" aria-hidden="true" />
      <header className="page-heading">
        <div>
          <p className="eyebrow">SUMMONER'S CUP // WORLDS 2026</p>
          <h1>El Mundial, en tu frecuencia.</h1>
          <p>Calendario oficial, directos y mapas · Horarios de Chile (Santiago).</p>
        </div>
        <a
          className="button outline small"
          href="https://lolesports.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          LoL Esports ↗
        </a>
      </header>
      <div className="worlds-hall-banner" aria-label="Legado de Worlds">
        <strong className="worlds-legend-badge">
          👑 HALL OF LEGENDS // FAKER · UNKILLABLE DEMON KING (5× CAMPEÓN MUNDIAL · T1)
        </strong>
        <span className="worlds-legacy-period">Legado hasta Worlds 2024</span>
        <div className="worlds-champion-badges">
          {['2024 T1', '2023 T1', '2022 DRX', '2021 EDG', '2020 DWG'].map((champion) => (
            <span key={champion}>🏆 {champion}</span>
          ))}
          <span className="worlds-cup-badge">⚔️ SUMMONER'S CUP 2026</span>
        </div>
      </div>
      {schedule.source !== 'official' && (
        <p className="worlds-source-notice" role="status">
          {schedule.source === 'fallback'
            ? 'Calendario de respaldo verificado el 13/10/2026. Equipos, horarios y resultados pueden cambiar.'
            : 'La API está temporalmente fuera de servicio; mostramos el último calendario recibido.'}
        </p>
      )}
      {refreshError && (
        <p className="muted" role="status">
          {refreshError}
        </p>
      )}
      <section className="panel worlds-timeline" aria-labelledby="worlds-timeline-title">
        <p className="eyebrow">01 // RUTA A LA COPA</p>
        <h2 id="worlds-timeline-title">Línea de tiempo de los Worlds</h2>
        <div className="worlds-stage-track" aria-label="Seleccionar fase">
          {schedule.stages.map((item, index) => (
            <button
              className={`worlds-stage-node${item.slug === 'final' ? ' is-grand-final' : ''}`}
              type="button"
              key={item.slug}
              aria-pressed={stageSlug === item.slug}
              onClick={() => selectStage(item.slug)}
            >
              <span className="worlds-stage-number">{index + 1}</span>
              <strong>{item.label}</strong>
              <span>{item.dateRangeLabel}</span>
              {item.slug === 'final' && <span className="worlds-cup-badge">🏆 SUMMONER'S CUP</span>}
              {item.state === 'inProgress' && <span className="worlds-live">EN VIVO</span>}
            </button>
          ))}
        </div>
        <div className="worlds-match-track" aria-label={`Partidas de ${stage.label}`}>
          {stage.matches.map((event) => (
            <button
              className="worlds-match-node"
              key={event.id}
              type="button"
              aria-pressed={selectedId === event.id}
              onClick={() => {
                setSelectedId(event.id);
                setVodId(null);
              }}
            >
              <time dateTime={event.startTime}>{dateLabel(event.startTime)}</time>
              <span className={event.state === 'inProgress' ? 'worlds-live' : 'muted'}>
                {statusLabel(event)} · Bo{event.bestOf}
              </span>
              {event.hasConfirmedTeams && event.teams ? (
                <span className="worlds-match-teams">
                  <TeamLogo team={event.teams[0]} />
                  <strong>{event.teams[0].code}</strong>
                  <span>vs</span>
                  <strong>{event.teams[1].code}</strong>
                  <TeamLogo team={event.teams[1]} />
                </span>
              ) : (
                <>
                  <strong>{event.blockName}</strong>
                  <span className="muted">Cruces por definir</span>
                </>
              )}
              {event.state !== 'unstarted' && event.teams && (
                <span>
                  {event.teams[0].gameWins ?? '—'} – {event.teams[1].gameWins ?? '—'}
                </span>
              )}
            </button>
          ))}
          {!stage.matches.length && (
            <p className="muted">No hay series publicadas para esta fase.</p>
          )}
        </div>
      </section>
      {match && description ? (
        <>
          <section
            className={`panel worlds-player${viewMode === 'cinema' ? ' is-cinema' : viewMode === 'theater' ? ' is-theater' : ''}`}
            aria-labelledby="worlds-player-title"
          >
            <p className="eyebrow">02 // SEÑAL OFICIAL</p>
            <h2 id="worlds-player-title">Directo de la partida correspondiente</h2>
            <div className="worlds-player-status">
              <strong>{description.title}</strong>
              <time dateTime={match.startTime}>{dateLabel(match.startTime)}</time>
              <span className={match.state === 'inProgress' ? 'worlds-live' : 'accent'}>
                {countdown(match, now)}
              </span>
            </div>
            <div className="filter-buttons" aria-label="Elegir señal de transmisión">
              <button
                ref={theaterToggle}
                type="button"
                className="button outline small"
                aria-pressed={viewMode === 'cinema'}
                aria-keyshortcuts="c"
                onClick={() => setViewMode((value) => worldsViewModeForKey(value, 'c'))}
              >
                🎦 Modo Cine
              </button>
              <button
                type="button"
                className="button outline small"
                aria-pressed={viewMode === 'theater'}
                aria-keyshortcuts="t"
                onClick={() => setViewMode((value) => worldsViewModeForKey(value, 't'))}
              >
                🌙 Modo Teatro
              </button>
              {viewMode !== 'normal' && (
                <button
                  type="button"
                  className="button outline small"
                  onClick={() => setViewMode('normal')}
                >
                  ✕ Normal
                </button>
              )}
              {WORLDS_BROADCAST_SIGNALS.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className="button outline small"
                  aria-pressed={!activeVod && signal === item.id}
                  onClick={() => {
                    setSignal(item.id);
                    setVodId(null);
                  }}
                >
                  {item.label}
                </button>
              ))}
              {vodGroups.map((group) => (
                <button
                  type="button"
                  className="button outline small"
                  key={`game-${group.gameNumber}`}
                  aria-pressed={activeVod?.number === group.gameNumber}
                  onClick={() => setVodId(group.preferredVod.parameter)}
                >
                  🎬 Juego {group.gameNumber}
                </button>
              ))}
            </div>
            {activeVod && audioVods.length > 1 && (
              <div
                className="worlds-vod-audio-selector"
                role="group"
                aria-label={`Audio del Juego ${activeVod.number}`}
              >
                <span className="muted">Audio:</span>
                {audioVods.map((vod) => (
                  <button
                    type="button"
                    key={`${vod.parameter}-${vod.locale}`}
                    className={`button outline small ${vod.parameter === activeVod.parameter ? 'active' : ''}`}
                    aria-pressed={vod.parameter === activeVod.parameter}
                    onClick={() => setVodId(vod.parameter)}
                  >
                    {vod.locale === 'es-MX'
                      ? '🇲🇽 Latam'
                      : vod.locale === 'es-ES'
                        ? '🇪🇸 España'
                        : vod.locale === 'en-US'
                          ? '🇺🇸 Inglés'
                          : '🇧🇷 Portugués'}
                  </button>
                ))}
              </div>
            )}
            <p className="muted">
              {activeVod
                ? 'Repetición oficial de esta serie.'
                : 'Señal del canal seleccionado; fuera del horario puede mostrar otra emisión o estar desconectada.'}
            </p>
            <div className="worlds-video">
              {frameUrl ? (
                <iframe
                  key={frameUrl}
                  src={frameUrl}
                  title={
                    activeVod
                      ? `VOD oficial · Juego ${activeVod.number}`
                      : `Directo de Worlds · ${activeSignal.label}`
                  }
                  allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : (
                <p role="status">Preparando señal…</p>
              )}
            </div>
            <div className="filter-buttons">
              <a
                className="text-link"
                href="https://lolesports.com/live"
                target="_blank"
                rel="noopener noreferrer"
              >
                LoL Esports Live ↗
              </a>
              <a
                className="text-link"
                href={
                  activeVod
                    ? `https://www.youtube.com/watch?v=${activeVod.parameter}`
                    : activeSignal.href
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                {activeVod
                  ? 'YouTube oficial ↗'
                  : activeSignal.kind === 'twitch'
                    ? 'Abrir Twitch ↗'
                    : 'Abrir en YouTube ↗'}
              </a>
              <a
                className="text-link"
                href="https://www.youtube.com/@lolesports"
                target="_blank"
                rel="noopener noreferrer"
              >
                Canal oficial de YouTube ↗
              </a>
            </div>
          </section>
          <section className="panel worlds-description" aria-labelledby="worlds-description-title">
            <p className="eyebrow">03 // DOSSIER DE LA SERIE</p>
            <h2 id="worlds-description-title">
              Descripción de la partida que ocurre en el momento
            </h2>
            <h3>{description.title}</h3>
            <div className="tags">
              <span className="tag">{description.phase}</span>
              <span className="tag">{description.format}</span>
              <span className="tag">{statusLabel(match)}</span>
            </div>
            <p>
              <time dateTime={match.startTime}>{dateLabel(match.startTime, true)}</time> ·
              America/Santiago
            </p>
            <p>{description.description}</p>
            {description.teams && (
              <div className="worlds-faceoff">
                {description.teams.map((team) => (
                  <div key={team.code}>
                    <TeamLogo team={team} large />
                    <strong>{team.name}</strong>
                    <span className="accent">{team.gameWins ?? '—'} victorias en la serie</span>
                  </div>
                ))}
              </div>
            )}
            {loadingDetail && <p role="status">Cargando mapas y repeticiones…</p>}
            {detailError && (
              <p className="muted" role="status">
                {detailError}
              </p>
            )}
            {description.teams && selectedDetail && selectedDetail.games.length > 0 && (
              <div className="worlds-maps-wrap">
                <table className="worlds-maps">
                  <caption>
                    Mapas de la serie · Los lados pueden cambiar antes de cada juego
                  </caption>
                  <thead>
                    <tr>
                      <th>Mapa</th>
                      <th>Estado</th>
                      <th>Lado Azul</th>
                      <th>Lado Rojo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDetail.games.map((game) => (
                      <tr key={game.number}>
                        <th>Juego {game.number}</th>
                        <td>
                          {game.state === 'inProgress'
                            ? 'En vivo'
                            : game.state === 'completed'
                              ? 'Finalizado'
                              : 'Próximo'}
                        </td>
                        <td className="worlds-blue">
                          {selectedDetail.teams?.find((team) => team.id === game.blueTeamId)
                            ?.name ?? 'Por confirmar'}
                        </td>
                        <td className="worlds-red">
                          {selectedDetail.teams?.find((team) => team.id === game.redTeamId)?.name ??
                            'Por confirmar'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {description.teams && (
              <>
                <WorldsRosters teams={description.teams} detail={selectedDetail} />
                <WorldsPerformance key={match.id} detail={selectedDetail} bestOf={match.bestOf} />
              </>
            )}
          </section>
        </>
      ) : (
        <section className="panel muted">Selecciona una fase con partidas publicadas.</section>
      )}
      <WorldsMusicPlayer />
    </div>
  );
}
