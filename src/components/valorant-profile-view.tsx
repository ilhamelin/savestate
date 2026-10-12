import Image from 'next/image';
import type { ValorantProfile } from '@/domain/competitive-tracker';
export function ValorantProfileView({ data }: { data: ValorantProfile }) {
  const avatar = data.cardSmallUrl ?? data.riotCrossProfile?.profileIconUrl;
  const metrics = [
    ['SHARD / REGIÓN', `🌐 ${(data.activeShard ?? data.region).toUpperCase()}`],
    ['NIVEL VALORANT', data.accountLevel === null ? 'Sin datos' : `⭐ Nvl. ${data.accountLevel}`],
    ['RANGO / POSICIÓN VALORANT', data.currentRank ?? 'Sin datos'],
    [
      'PICO HISTÓRICO / ELO',
      data.peakRank ?? (data.elo !== null ? `${data.elo} ELO` : 'No registrado'),
    ],
    ['ACTO COMPETITIVO', data.activeActName ?? 'Sin datos'],
  ];
  return (
    <div className="competitive-profile valorant-profile">
      <header className="valorant-profile-header">
        {data.cardWideUrl && (
          <Image
            className="valorant-banner"
            loading="eager"
            src={data.cardWideUrl}
            alt=""
            fill
            unoptimized
            sizes="100vw"
          />
        )}
        <div className="valorant-identity">
          {avatar && (
            <Image
              className="valorant-avatar"
              src={avatar}
              alt={
                data.cardSmallUrl
                  ? 'Tarjeta de jugador Valorant'
                  : 'Icono del perfil cruzado de LoL'
              }
              width={72}
              height={72}
              unoptimized
            />
          )}
          <div>
            <h2>
              {data.gameName}#{data.tagLine}
            </h2>
            <span className="tag">✓ RIOT ID ENCONTRADO</span>
            <p className="muted">
              {data.dataSource === 'henrik_full'
                ? 'HenrikDev · datos disponibles'
                : 'Riot · datos oficiales disponibles'}
            </p>
          </div>
        </div>
      </header>
      <div className="genshin-kpi-grid valorant-kpi-grid">
        {metrics.map(([label, value]) => (
          <article key={label}>
            <p className="eyebrow">{label}</p>
            <strong>{value}</strong>
            {label === 'RANGO / POSICIÓN VALORANT' && (
              <div className="valorant-rank">
                {data.rankIconUrl && (
                  <Image
                    src={data.rankIconUrl}
                    alt="Icono del rango Valorant"
                    width={44}
                    height={44}
                    unoptimized
                  />
                )}
                {data.rankingInTier !== null && <span>{data.rankingInTier} RR</span>}
                {data.lastMmrChange !== null && (
                  <span className={data.lastMmrChange >= 0 ? 'accent' : 'error-text'}>
                    {data.lastMmrChange > 0 ? '+' : ''}
                    {data.lastMmrChange} RR en la última partida
                  </span>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
      {data.riotCrossProfile && (
        <section className="valorant-cross">
          <h3>Perfil cruzado Riot · LoL / TFT</h3>
          <div className="tags">
            {data.riotCrossProfile.summonerLevel !== null && (
              <span className="tag">LoL: nivel {data.riotCrossProfile.summonerLevel}</span>
            )}
            {data.riotCrossProfile.tftTier && (
              <span className="tag">
                TFT: {data.riotCrossProfile.tftTier} · {data.riotCrossProfile.tftWins ?? '—'} V /{' '}
                {data.riotCrossProfile.tftLosses ?? '—'} D
              </span>
            )}
          </div>
        </section>
      )}
      <h3>Últimas partidas de Valorant</h3>
      {data.matches.length ? (
        <div className="valorant-match-list">
          {data.matches.map((match) => (
            <article
              className={`valorant-match-card ${match.won === true ? 'is-victory' : match.won === false ? 'is-defeat' : ''}`}
              key={match.matchId}
            >
              {match.agentIconUrl && (
                <Image
                  src={match.agentIconUrl}
                  alt={match.agentName}
                  width={48}
                  height={48}
                  unoptimized
                  loading="lazy"
                />
              )}
              <div>
                <strong>
                  {match.agentName} · {match.map}
                </strong>
                <p>
                  {match.mode} ·{' '}
                  {match.startedAt ? (
                    <time dateTime={match.startedAt}>
                      {new Date(match.startedAt).toLocaleString('es-CL')}
                    </time>
                  ) : (
                    'Fecha no disponible'
                  )}
                </p>
                <span>
                  {match.won === true
                    ? '🟢 VICTORIA'
                    : match.won === false
                      ? '🔴 DERROTA'
                      : 'Resultado no disponible'}{' '}
                  · {match.roundsWon ?? '—'} - {match.roundsLost ?? '—'}
                </span>
              </div>
              <div className="valorant-match-stats">
                <strong>
                  {match.kills} / {match.deaths} / {match.assists}
                </strong>
                <span>🎯 {match.headshotPercent}% HS</span>
                <span>Puntuación de combate total: {match.score.toLocaleString('es-CL')}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">No hay historial disponible en esta consulta.</p>
      )}
      {!!data.regionalLeaderboard.length && (
        <section>
          <h3>
            🏆 Top 5 regional · {(data.activeShard ?? data.region).toUpperCase()} ·{' '}
            {data.activeActName ?? 'Acto sin identificar'}
          </h3>
          <ol className="valorant-leaderboard">
            {data.regionalLeaderboard.map((player) => (
              <li key={player.rank}>
                <strong>#{player.rank}</strong>
                <span>
                  {player.gameName}#{player.tagLine}
                </span>
                <span>
                  {player.rankedRating.toLocaleString('es-CL')} RR · {player.numberOfWins} victorias
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
      {data.dataSource === 'riot_official' && (
        <p className="notice">
          Para consultar MMR individual e historial mediante HenrikDev, configura HENRIK_API_KEY en
          el servidor. La disponibilidad depende del proveedor y de los permisos de la clave. La
          ausencia de datos aquí no indica que el jugador esté sin clasificar.
        </p>
      )}
      <div className="filter-buttons">
        <a
          className="button outline"
          href={`https://tracker.gg/valorant/profile/riot/${encodeURIComponent(`${data.gameName}#${data.tagLine}`)}/overview`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Tracker.gg Valorant ↗
        </a>
        <a
          className="button outline"
          href={`https://blitz.gg/valorant/profile/${encodeURIComponent(`${data.gameName}-${data.tagLine}`)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Blitz.gg Valorant ↗
        </a>
      </div>
      <p className="muted">
        Consultado: {new Date(data.verifiedAt).toLocaleString('es-CL')}
        {data.dataSource === 'riot_official' && data.cardWideUrl
          ? ' · Banner decorativo de Valorant'
          : ''}
      </p>
    </div>
  );
}
