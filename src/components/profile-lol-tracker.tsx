'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import { api } from '@/lib/client-api';
import { notificationAge } from '@/domain/notifications';
import {
  LOL_QUEUE_FILTERS,
  filterLolMatches,
  lolAnalytics,
  lolMatchMedals,
  lolMomentLink,
  type LolAggregate,
  type LolQueueFilter,
} from '@/domain/lol-analytics';
import {
  lolAccount,
  recentLolAccounts,
  sameLolAccount,
  type LolAccount,
} from '@/domain/lol-accounts';
import {
  LOL_PLATFORMS,
  LOL_TIERS,
  type LolPlatform,
  type LolProfileData,
  type LolRankEntry,
  type LolMatchParticipant,
  type LolMatchSummary,
} from '@/domain/lol-tracker';

const format = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 });
const masteryPoints = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
function RiftImage({ src, alt, size = 32 }: { src: string | null; alt: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="lol-icon" style={{ width: size, height: size }} title={alt}>
      {src && !failed ? (
        <Image
          src={src}
          width={size}
          height={size}
          alt={alt}
          unoptimized
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span role="img" aria-label={alt}>
          ◇
        </span>
      )}
    </span>
  );
}
function ItemBuild({ player }: { player: LolMatchParticipant }) {
  return (
    <div className="lol-build" aria-label="Objetos y centinela">
      {player.items.map((src, index) => (
        <RiftImage
          key={`${index}-${src}`}
          src={src}
          alt={
            player.itemIds[index]
              ? `Objeto ${player.itemIds[index]}`
              : `Espacio de objeto ${index + 1} vacío`
          }
        />
      ))}
      <span className="lol-trinket">
        <RiftImage
          key={player.trinket}
          src={player.trinket}
          alt={player.trinketId ? `Centinela ${player.trinketId}` : 'Espacio de centinela vacío'}
        />
      </span>
    </div>
  );
}
function AnalyticsPanel({
  title,
  rows,
  champions = false,
}: {
  title: string;
  rows: LolAggregate[];
  champions?: boolean;
}) {
  return (
    <section className="panel lol-analytics-panel" aria-label={title}>
      <h2 className="eyebrow">{title}</h2>
      {rows.length ? (
        <ul className="lol-analytics-list">
          {rows.map((row) => (
            <li key={row.id}>
              <div className="lol-analytics-heading">
                {champions ? (
                  <RiftImage src={row.icon} alt={row.label} size={40} />
                ) : (
                  <span className="lol-role-icon" aria-hidden="true">
                    {row.icon}
                  </span>
                )}
                <div>
                  <strong>{row.label}</strong>
                  <small>
                    {row.games} partidas · {row.wins} W // {row.losses} L
                  </small>
                </div>
              </div>
              <label className="lol-winrate">
                WR {format.format(row.winrate)}%
                <progress value={row.winrate} max={100} aria-label={`Winrate de ${row.label}`} />
              </label>
              <p className="lol-analytics-kda">
                {row.perfect ? 'Perfecto' : format.format(row.kdaRatio)} KDA
              </p>
              <small>
                Promedio K // D // A: {format.format(row.kills)} // {format.format(row.deaths)} //{' '}
                {format.format(row.assists)}
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">
          {champions
            ? 'Sin campeones en esta muestra.'
            : 'Sin posiciones definidas en esta muestra.'}
        </p>
      )}
    </section>
  );
}
function Spells({ player }: { player: LolMatchParticipant }) {
  return (
    <div className="lol-spells" aria-label="Hechizos de invocador">
      {player.spells.map((src, index) => (
        <RiftImage
          key={`${index}-${src}`}
          src={src}
          alt={player.spellNames[index] ?? 'Hechizo no disponible'}
          size={24}
        />
      ))}
    </div>
  );
}
function RankCard({
  rank,
  status,
  title,
}: {
  rank: LolRankEntry | null;
  status: LolProfileData['rankStatus'];
  title: string;
}) {
  const tier = rank && Object.hasOwn(LOL_TIERS, rank.tier) ? LOL_TIERS[rank.tier] : '';
  return (
    <div className="lol-rank-card">
      <span
        className={`lol-rank-emblem ${rank ? `tier-${rank.tier.toLowerCase()}` : ''}`}
        aria-hidden="true"
      >
        <Trophy size={30} />
      </span>
      <div>
        <p className="eyebrow">{title}</p>
        <strong>
          {status === 'unavailable'
            ? 'Rango no disponible'
            : rank
              ? `${tier} ${['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(rank.tier) ? '' : rank.rank}`
              : 'Sin clasificar'}
        </strong>
        {rank && status === 'available' ? (
          <>
            <p>
              {rank.leaguePoints} LP · {rank.wins}V / {rank.losses}D
            </p>
            <label className="lol-winrate">
              Winrate: {format.format(rank.winrate)}%
              <progress value={rank.winrate} max={100} aria-label={`Winrate de ${title}`} />
            </label>
          </>
        ) : null}
      </div>
    </div>
  );
}
function MatchTeams({ match }: { match: LolMatchSummary }) {
  const teamIds = [...new Set(match.participants.map((player) => player.teamId))].sort(
    (a, b) => a - b,
  );
  return (
    <div
      className="lol-team-table-scroll"
      role="region"
      aria-label="Tabla de jugadores de la partida"
    >
      <table className="lol-team-table">
        <caption>Todos los jugadores · {match.gameMode}</caption>
        <thead>
          <tr>
            <th scope="col">Jugador / Campeón</th>
            <th scope="col">KDA</th>
            <th scope="col">CS</th>
            <th scope="col">Daño a campeones</th>
            <th scope="col">Oro</th>
            <th scope="col">Hechizos / Objetos</th>
          </tr>
        </thead>
        {teamIds.map((team) => (
          <tbody key={team}>
            <tr className="lol-team-heading">
              <th colSpan={6} scope="rowgroup">
                {team === 100 ? 'Equipo azul' : team === 200 ? 'Equipo rojo' : `Equipo ${team}`} ·{' '}
                {match.participants.find((player) => player.teamId === team)?.win
                  ? 'Victoria'
                  : 'Derrota'}
              </th>
            </tr>
            {match.participants
              .filter((player) => player.teamId === team)
              .map((player, index) => (
                <tr
                  key={`${player.puuid}-${index}`}
                  className={player.puuid === match.player.puuid ? 'lol-selected-player' : ''}
                >
                  <th scope="row">
                    <div className="lol-table-player">
                      <RiftImage src={player.championIcon} alt={player.championName} />
                      <span>
                        {player.riotId}
                        <small>
                          {player.championName} · Nvl {player.championLevel}
                          {player.role ? ` · ${player.role}` : ''}
                        </small>
                      </span>
                    </div>
                  </th>
                  <td>
                    {player.kills} / {player.deaths} / {player.assists}
                    <small>{player.kda} KDA</small>
                  </td>
                  <td>
                    {player.cs}
                    <small>{format.format(player.csPerMin)}/min</small>
                  </td>
                  <td>{format.format(player.totalDamage)}</td>
                  <td>{format.format(player.gold)}</td>
                  <td>
                    <Spells player={player} />
                    <ItemBuild player={player} />
                  </td>
                </tr>
              ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
function MatchCard({ match, now }: { match: LolMatchSummary; now: string }) {
  const medals = lolMatchMedals(match);
  const player = match.player,
    seconds = Math.round(match.gameDurationMinutes * 60);
  const ended = new Date(match.gameEndTimestamp).toISOString();
  return (
    <article className={`panel lol-match-card ${player.win ? 'lol-victory' : 'lol-defeat'}`}>
      <div className="lol-match-heading">
        <strong>{player.win ? '🟢 Victoria' : '🔴 Derrota'}</strong>
        <span>{match.gameMode}</span>
        <time dateTime={ended} title={new Date(ended).toLocaleString('es-CL')}>
          {notificationAge(ended, now)}
        </time>
        <span>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} min
        </span>
      </div>
      <div className="lol-match-overview">
        <div className="lol-champion">
          <RiftImage src={player.championIcon} alt={player.championName} size={56} />
          <div>
            <strong>{player.championName}</strong>
            <small>Nivel {player.championLevel}</small>
            <Spells player={player} />
          </div>
        </div>
        <div
          className={`lol-kda ${player.deaths === 0 || player.kdaRatio >= 3 ? 'lol-kda-good' : player.kdaRatio < 1 ? 'lol-kda-low' : ''}`}
        >
          <strong>
            {player.kills} / {player.deaths} / {player.assists}
          </strong>
          <small>{player.kda} KDA</small>
        </div>
        <div className="lol-match-stats">
          <span>
            CS: {player.cs} · {format.format(player.csPerMin)}/min
          </span>
          <span>Daño a campeones: {format.format(player.totalDamage)}</span>
          <span>Oro: {format.format(player.gold)}</span>
        </div>
        <ItemBuild player={player} />
      </div>
      <div className="lol-match-medals">
        {medals.multikill ? (
          <span className="tag lol-medal-gold">⚡ {medals.multikill}</span>
        ) : null}
        {medals.mvp ? (
          <span
            className="tag lol-medal-gold"
            title="Distintivo SaveState: mayor daño o mejor KDA del equipo; incluye empates."
          >
            👑 MVP
          </span>
        ) : null}
        <span className="tag" title="Participación en los asesinatos del equipo">
          🎯 {medals.killParticipation}% P/K
        </span>
      </div>
      <details className="lol-match-details">
        <summary>Ver detalles de la partida ({match.participants.length} jugadores)</summary>
        <MatchTeams match={match} />
      </details>
      <Link className="button outline small lol-publish-match" href={lolMomentLink(match)}>
        🚀 Publicar en Momentos
      </Link>
    </article>
  );
}
export function ProfileLolTracker({
  configured,
  initialAccount = null,
  initialError = '',
}: {
  configured: boolean;
  initialAccount?: LolAccount | null;
  initialError?: string;
}) {
  const [pinned, setPinned] = useState<LolAccount | null>(null);
  const [recent, setRecent] = useState<LolAccount[]>([]);
  const recentRef = useRef<LolAccount[]>([]);
  const [queue, setQueue] = useState<LolQueueFilter>('all');
  const [riotId, setRiotId] = useState(initialAccount?.riotId ?? ''),
    [platform, setPlatform] = useState<LolPlatform>(initialAccount?.platform ?? 'la2');
  const [profile, setProfile] = useState<LolProfileData | null>(null),
    [error, setError] = useState(initialError),
    [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null),
    working = useRef(false);
  const load = useCallback(async (account: LolAccount) => {
    if (working.current) return;
    working.current = true;
    setLoading(true);
    setError('');
    const controller = new AbortController();
    request.current = controller;
    try {
      const result = await api<LolProfileData>(
        'tracker/lol/inspect',
        { ...account },
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setProfile(result);
        setQueue('all');
        const canonical = {
          riotId: `${result.gameName}#${result.tagLine}`,
          platform: result.platform,
        };
        setRiotId(canonical.riotId);
        setPlatform(canonical.platform);
        const next = recentLolAccounts([canonical, ...recentRef.current]);
        recentRef.current = next;
        setRecent(next);
        try {
          window.localStorage.setItem('savestate_recent_lol_searches', JSON.stringify(next));
        } catch {
          /* Las restricciones o datos inválidos de localStorage no bloquean la consulta. */
        }
      }
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(
          failure instanceof Error ? failure.message : 'No se pudo cargar el historial de Riot.',
        );
    } finally {
      working.current = false;
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      let saved: LolAccount | null = null;
      try {
        saved = lolAccount(
          JSON.parse(window.localStorage.getItem('savestate_pinned_lol_account') ?? 'null'),
        );
      } catch {
        /* Las restricciones o datos inválidos de localStorage no bloquean la consulta. */
      }
      setPinned(saved);
      try {
        const savedRecent = recentLolAccounts(
          JSON.parse(window.localStorage.getItem('savestate_recent_lol_searches') ?? '[]'),
        );
        recentRef.current = savedRecent;
        setRecent(savedRecent);
      } catch {
        /* Las restricciones o datos inválidos de localStorage no bloquean la consulta. */
      }
      const account = initialAccount ?? (!initialError ? saved : null);
      if (account) {
        setRiotId(account.riotId);
        setPlatform(account.platform);
        if (configured) void load(account);
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      request.current?.abort();
    };
  }, [initialAccount, initialError, configured, load]);
  function pinAccount() {
    if (!profile) return;
    const account = {
      riotId: `${profile.gameName}#${profile.tagLine}`,
      platform: profile.platform,
    };
    const next = sameLolAccount(pinned, account) ? null : account;
    try {
      if (next) window.localStorage.setItem('savestate_pinned_lol_account', JSON.stringify(next));
      else window.localStorage.removeItem('savestate_pinned_lol_account');
      setPinned(next);
    } catch {
      setError('El navegador no permite guardar la cuenta fijada.');
    }
  }
  const matches = filterLolMatches(profile?.matches ?? [], queue);
  const analytics = lolAnalytics(matches);
  return (
    <section id="rift-tracker" className="lol-tracker">
      <div className="page-heading">
        <div>
          <p className="eyebrow">RIFT TRACKER // LEAGUE OF LEGENDS</p>
          <h1>Tu señal en la Grieta.</h1>
        </div>
      </div>
      <p className="muted">
        Consulta un Riot ID para ver su rango y sus últimas diez partidas disponibles.
      </p>
      {!configured ? (
        <p className="notice" role="status">
          Rift Tracker está pendiente de configuración. Se requiere RIOT_API_KEY en el servidor para
          consultar la API oficial de Riot.
        </p>
      ) : null}
      <div className={`lol-layout-grid ${profile ? 'lol-has-profile' : ''}`}>
        <div className="lol-main-column">
          <form
            className="lol-search-form"
            onSubmit={(event) => {
              event.preventDefault();
              const account = lolAccount({ riotId, platform });
              if (account) void load(account);
              else setError('Usa un Riot ID válido con formato Nombre#TAG.');
            }}
          >
            <label>
              Riot ID
              <input
                value={riotId}
                maxLength={64}
                required
                placeholder="Nombre#TAG"
                onChange={(event) => setRiotId(event.target.value)}
                disabled={loading}
              />
            </label>
            <label>
              Servidor
              <select
                value={platform}
                onChange={(event) => setPlatform(event.target.value as LolPlatform)}
                disabled={loading}
              >
                {Object.entries(LOL_PLATFORMS).map(([id, region]) => (
                  <option key={id} value={id}>
                    {region.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="button" disabled={!configured || loading || !riotId.trim()}>
              {loading ? 'Consultando Riot…' : 'Cargar Historial'}
            </button>
          </form>
          {recent.length ? (
            <div
              className="filter-buttons lol-recent-searches"
              role="group"
              aria-label="Búsquedas recientes"
            >
              <span className="muted">Recientes:</span>
              {recent.map((account) => (
                <button
                  key={`${account.platform}-${account.riotId}`}
                  type="button"
                  className="button outline small"
                  disabled={loading || !configured}
                  onClick={() => {
                    setRiotId(account.riotId);
                    setPlatform(account.platform);
                    void load(account);
                  }}
                >
                  {account.riotId} · {account.platform.toUpperCase()}
                </button>
              ))}
            </div>
          ) : null}
          {loading ? (
            <p role="status" className="muted">
              [ Recuperando señal, rango y partidas… ]
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="error-text">
              {error}
            </p>
          ) : null}
          {profile ? (
            <div className="lol-results">
              <div className="panel lol-summoner-card">
                <div className="lol-summoner-identity">
                  <RiftImage
                    key={profile.profileIconUrl}
                    src={profile.profileIconUrl}
                    alt={`Icono de ${profile.gameName}`}
                    size={80}
                  />
                  <div>
                    <h3>
                      {profile.gameName}#{profile.tagLine}
                    </h3>
                    <button
                      type="button"
                      className="button outline small"
                      aria-pressed={sameLolAccount(pinned, {
                        riotId: `${profile.gameName}#${profile.tagLine}`,
                        platform: profile.platform,
                      })}
                      onClick={pinAccount}
                    >
                      {sameLolAccount(pinned, {
                        riotId: `${profile.gameName}#${profile.tagLine}`,
                        platform: profile.platform,
                      })
                        ? '⭐ Cuenta fijada · Desfijar'
                        : '☆ Fijar mi cuenta'}
                    </button>
                    <p className="accent">Nivel {profile.summonerLevel}</p>
                    <span className="tag">{LOL_PLATFORMS[profile.platform].name}</span>
                  </div>
                </div>
                <div className="lol-mastery-section">
                  <p className="eyebrow">TOP 3 // MAESTRÍA HISTÓRICA</p>
                  {profile.masteryStatus === 'unavailable' ? (
                    <p className="muted">Maestrías no disponibles.</p>
                  ) : profile.masteries.length ? (
                    <div className="lol-masteries">
                      {profile.masteries.map((mastery) => (
                        <div key={mastery.championId} className="lol-mastery-card">
                          <RiftImage
                            key={mastery.championIcon}
                            src={mastery.championIcon}
                            alt={mastery.championName}
                            size={48}
                          />
                          <div>
                            <strong>{mastery.championName}</strong>
                            <small>
                              Nivel {mastery.level} ·{' '}
                              {masteryPoints.format(mastery.points).toLowerCase()} pts
                            </small>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">Sin maestrías registradas.</p>
                  )}
                </div>
                <div className="lol-ranks">
                  <RankCard
                    rank={profile.soloQueue}
                    status={profile.rankStatus}
                    title="Solo / Dúo"
                  />
                  <RankCard rank={profile.flexQueue} status={profile.rankStatus} title="Flexible" />
                </div>
              </div>
              {profile.warnings.map((warning) => (
                <p className="notice" key={warning} role="status">
                  {warning}
                </p>
              ))}
              <p className="muted">
                Actualizado: {new Date(profile.lastUpdated).toLocaleString('es-CL')} · caché de
                hasta 2 minutos.
              </p>
              <div
                className="filter-buttons lol-queue-filters"
                role="group"
                aria-label="Filtrar partidas por cola"
              >
                {Object.entries(LOL_QUEUE_FILTERS).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={`button small ${queue === id ? '' : 'outline'}`}
                    aria-pressed={queue === id}
                    onClick={() => setQueue(id as LolQueueFilter)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="muted" role="status">
                {matches.length} de {profile.matches.length} partidas cargadas ·{' '}
                {LOL_QUEUE_FILTERS[queue]}
              </p>
              {matches.length ? (
                <div className="lol-match-list">
                  {matches.map((match) => (
                    <MatchCard key={match.matchId} match={match} now={profile.lastUpdated} />
                  ))}
                </div>
              ) : (
                <p className="empty-state">No hay partidas disponibles para esta cola.</p>
              )}
            </div>
          ) : null}
        </div>
        {profile ? (
          <aside className="lol-analytics-sidebar" aria-label="Analíticas de las partidas cargadas">
            <p className="muted">
              Muestra: {matches.length} partidas · {LOL_QUEUE_FILTERS[queue]}. Estadísticas del
              historial cargado.
            </p>
            <AnalyticsPanel title="ROLES" rows={analytics.roles} />
            <AnalyticsPanel title="TOP CHAMPIONS" rows={analytics.champions} champions />
          </aside>
        ) : null}
      </div>
      <p className="muted lol-attribution">
        SaveState no está respaldado por Riot Games ni representa las opiniones de Riot Games o de
        las personas que crean y gestionan sus productos. Riot Games y sus propiedades asociadas son
        marcas comerciales o marcas registradas de Riot Games, Inc.
      </p>
    </section>
  );
}
