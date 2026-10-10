'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import { api } from '@/lib/client-api';
import { notificationAge } from '@/domain/notifications';
import {
  LOL_QUEUE_FILTERS,
  filterLolMatches,
  lolAnalytics,
  type LolAggregate,
  type LolQueueFilter,
} from '@/domain/lol-analytics';
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
      <details className="lol-match-details">
        <summary>Ver detalles de la partida ({match.participants.length} jugadores)</summary>
        <MatchTeams match={match} />
      </details>
    </article>
  );
}
export function ProfileLolTracker({ configured }: { configured: boolean }) {
  const [queue, setQueue] = useState<LolQueueFilter>('all');
  const [riotId, setRiotId] = useState(''),
    [platform, setPlatform] = useState<LolPlatform>('la2');
  const [profile, setProfile] = useState<LolProfileData | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null),
    working = useRef(false);
  useEffect(() => () => request.current?.abort(), []);
  async function load() {
    if (working.current) return;
    working.current = true;
    setLoading(true);
    setError('');
    const controller = new AbortController();
    request.current = controller;
    try {
      const result = await api<LolProfileData>(
        'tracker/lol/inspect',
        { riotId, platform },
        controller.signal,
      );
      if (!controller.signal.aborted) {
        setProfile(result);
        setQueue('all');
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
              void load();
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
                    <p className="accent">Nivel {profile.summonerLevel}</p>
                    <span className="tag">{LOL_PLATFORMS[profile.platform].name}</span>
                  </div>
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
