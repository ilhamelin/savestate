'use client';
import { useState } from 'react';
import {
  FALLBACK_WORLDS_2026_ROSTERS,
  WORLDS_ROLES,
  type WorldsMatchDetail,
  type WorldsTeam,
  type WorldsPlayerProfile,
  type WorldsGamePlayerStats,
  type WorldsGameTeamStats,
} from '@/domain/worlds-schedule';
function Player({ player, league }: { player?: WorldsPlayerProfile; league?: string | null }) {
  return (
    <div className="worlds-roster-player">
      {player?.imageUrl ? (
        <img
          src={player.imageUrl}
          alt={`Foto de ${player.summonerName}`}
          width={58}
          height={68}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="worlds-player-silhouette" aria-hidden="true">
          ♟
        </span>
      )}
      <div>
        <strong>{player?.summonerName ?? 'Sin jugador registrado'}</strong>
        <span>{[player?.firstName, player?.lastName].filter(Boolean).join(' ')}</span>
        <small>{league}</small>
      </div>
    </div>
  );
}
export function WorldsRosters({
  teams,
  detail,
}: {
  teams: [WorldsTeam, WorldsTeam];
  detail: WorldsMatchDetail | null;
}) {
  const rosters = teams.map(
    (team) =>
      detail?.rosters?.[team.code.toUpperCase()] ??
      FALLBACK_WORLDS_2026_ROSTERS[team.code.toUpperCase()],
  );
  const starters = rosters.map((roster, index) =>
    WORLDS_ROLES.map(({ role }) => {
      const preferred = FALLBACK_WORLDS_2026_ROSTERS[
        teams[index]!.code.toUpperCase()
      ]?.players.find((p) => p.role === role);
      return (
        roster?.players.find(
          (p) =>
            p.role === role &&
            p.summonerName.toLowerCase() === preferred?.summonerName.toLowerCase(),
        ) ?? roster?.players.find((p) => p.role === role)
      );
    }),
  );
  return (
    <section className="worlds-rosters" aria-labelledby="worlds-rosters-title">
      <h3 id="worlds-rosters-title">Alineaciones Oficiales · Duelo de Líneas</h3>
      <p className="muted">
        Plantillas registradas. La alineación de referencia puede cambiar antes del mapa.
      </p>
      <div className="worlds-roster-heading">
        <strong>{teams[0].name}</strong>
        <strong>{teams[1].name}</strong>
      </div>
      {WORLDS_ROLES.map(({ role, code, label }, index) => (
        <div className="worlds-roster-row" key={role}>
          <Player player={starters[0]?.[index]} league={rosters[0]?.homeLeague} />
          <span className="worlds-role-tag" title={label}>
            {code}
            <small>{label}</small>
          </span>
          <Player player={starters[1]?.[index]} league={rosters[1]?.homeLeague} />
        </div>
      ))}
      <div className="worlds-roster-rotations">
        {rosters.map((roster, index) => {
          const players =
            roster?.players.filter(
              (player) => !starters[index]?.some((p) => p?.id === player.id),
            ) ?? [];
          return players.length ? (
            <div key={teams[index]!.code}>
              <strong>Suplentes / Rotación · {teams[index]!.code}</strong>
              <div>
                {players.map((player) => (
                  <span className="tag" key={player.id}>
                    {player.summonerName} · {WORLDS_ROLES.find((r) => r.role === player.role)?.code}
                  </span>
                ))}
              </div>
            </div>
          ) : null;
        })}
      </div>
    </section>
  );
}
const dragons: Record<string, string> = {
  infernal: 'Infernal',
  hextech: 'Hextech',
  mountain: 'Montaña',
  ocean: 'Océano',
  cloud: 'Nube',
  chemtech: 'Quimtech',
  elder: 'Ancestral',
};
const gold = (value: number) => (value / 1000).toFixed(1) + 'k';
function TeamObjectives({ stats, label }: { stats: WorldsGameTeamStats; label: string }) {
  return (
    <div className="worlds-objectives">
      <strong>{label}</strong>
      <div className="tags">
        <span className="tag">🗼 {stats.towers} torretas</span>
        <span className="tag">👑 {stats.barons} barones</span>
        <span className="tag">🏛️ {stats.inhibitors} inhibidores</span>
      </div>
      <p>
        🐉{' '}
        {stats.dragons.length
          ? stats.dragons.map((d) => dragons[d] ?? d).join(' · ')
          : 'Sin dragones'}
      </p>
    </div>
  );
}
function Scoreboard({ players, label }: { players: WorldsGamePlayerStats[]; label: string }) {
  return (
    <div className="worlds-maps-wrap">
      <table className="worlds-scoreboard">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th>Jugador / Campeón</th>
            <th>K / D / A</th>
            <th>KDA</th>
            <th>KP%</th>
            <th>CS</th>
            <th>Oro / % equipo</th>
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.participantId} className={player.isMvp ? 'worlds-mvp-row' : ''}>
              <td>
                <div className="worlds-champion-player">
                  {player.championIconUrl && (
                    <img
                      src={player.championIconUrl}
                      alt={player.championId}
                      width={40}
                      height={40}
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                  <div>
                    <strong>{player.summonerName}</strong>
                    <small>
                      {player.championId} · Nv. {player.level} ·{' '}
                      {WORLDS_ROLES.find((r) => r.role === player.role)?.code}
                    </small>
                    {player.isMvp && <span className="worlds-mvp-badge">★ MVP</span>}
                  </div>
                </div>
              </td>
              <td>
                {player.kills} / {player.deaths} / {player.assists}
              </td>
              <td>
                <span
                  className={`worlds-kda ${player.kdaRatio >= 4 ? 'good' : player.kdaRatio >= 2.5 ? 'great' : player.kdaRatio < 1.5 ? 'low' : ''}`}
                >
                  {player.kdaRatio.toFixed(2)}
                </span>
              </td>
              <td>{player.killParticipationPct}%</td>
              <td>{player.creepScore}</td>
              <td>
                {gold(player.totalGold)} · {player.goldSharePct}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Comparison({
  label,
  blue,
  red,
  format,
}: {
  label: string;
  blue: number;
  red: number;
  format: (value: number) => string;
}) {
  const percent = blue + red ? (blue / (blue + red)) * 100 : 50;
  return (
    <div className="worlds-comparison">
      <div>
        <strong>{label}</strong>
        <span>
          {format(blue)} vs {format(red)} · Ventaja {format(Math.abs(blue - red))} (
          {blue === red ? 'empate' : blue > red ? 'Azul' : 'Rojo'})
        </span>
      </div>
      <div
        className="worlds-dual-bar"
        role="img"
        aria-label={`${label}: Azul ${format(blue)}, Rojo ${format(red)}`}
      >
        <span style={{ width: `${percent}%` }} />
        <span style={{ width: `${100 - percent}%` }} />
      </div>
    </div>
  );
}
export function WorldsPerformance({
  detail,
  bestOf,
}: {
  detail: WorldsMatchDetail | null;
  bestOf: number;
}) {
  const [gameNumber, setGameNumber] = useState(1);
  const count = detail?.games.length || bestOf;
  const selected = gameNumber <= count ? gameNumber : 1;
  const telemetry = detail?.gameTelemetry?.[selected];
  const game = detail?.games.find((g) => g.number === selected);
  const duration = telemetry?.durationSeconds;
  return (
    <section className="worlds-performance" aria-labelledby="worlds-performance-title">
      <h3 id="worlds-performance-title">Telemetría y Desempeño por Mapa</h3>
      <div className="filter-buttons" aria-label="Seleccionar mapa de telemetría">
        {Array.from({ length: count }, (_, index) => index + 1).map((number) => (
          <button
            type="button"
            className="button outline small"
            aria-pressed={selected === number}
            key={number}
            onClick={() => setGameNumber(number)}
          >
            Juego {number}
          </button>
        ))}
      </div>
      {telemetry ? (
        <>
          <div className="tags">
            <span className="tag">
              {telemetry.gameState === 'finished' ? 'Mapa finalizado' : 'Datos en vivo'}
            </span>
            <span className="tag">
              ⏱️{' '}
              {duration == null
                ? 'Sin duración'
                : `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`}
            </span>
            <span className="tag">Parche {telemetry.patchVersion ?? 'Por confirmar'}</span>
          </div>
          <Comparison
            label="Oro Total"
            blue={telemetry.blueTeam.totalGold}
            red={telemetry.redTeam.totalGold}
            format={gold}
          />
          <Comparison
            label="Asesinatos Totales"
            blue={telemetry.blueTeam.totalKills}
            red={telemetry.redTeam.totalKills}
            format={String}
          />
          <div className="worlds-objectives-grid">
            <TeamObjectives stats={telemetry.blueTeam} label="Lado Azul" />
            <TeamObjectives stats={telemetry.redTeam} label="Lado Rojo" />
          </div>
          <Scoreboard players={telemetry.bluePlayers} label="Lado Azul · Desempeño de jugadores" />
          <Scoreboard players={telemetry.redPlayers} label="Lado Rojo · Desempeño de jugadores" />
          <p className="muted">
            MVP estimado por impacto (KDA y participación de oro), priorizando el equipo con
            ventaja. Actualización automática cada 30 segundos mientras esta vista está activa.
          </p>
        </>
      ) : (
        <div className="worlds-telemetry-preview">
          <h4>
            {game?.state && game.state !== 'unstarted'
              ? 'Esperando datos oficiales'
              : 'Radar de Telemetría Pre-Partido'}{' '}
            · Juego {selected}
          </h4>
          <div className="worlds-preview-metrics">
            {['Oro Total', 'Asesinatos', 'Torretas', 'Barones', 'Dragones', 'Inhibidores'].map(
              (label) => (
                <div key={label}>
                  <strong>{label}</strong>
                  <span>En espera</span>
                </div>
              ),
            )}
          </div>
          <p>Campeón · K/D/A · KP% · CS · % de Oro · MVP del Mapa</p>
          <p className="muted">
            {game?.state && game.state !== 'unstarted'
              ? 'El feed no tiene datos disponibles para este mapa. Se volverá a consultar automáticamente.'
              : `Se actualizará automáticamente al iniciar/finalizar el Juego ${selected}.`}
          </p>
        </div>
      )}
    </section>
  );
}
