import Image from 'next/image';
import type { HsrProfile } from '@/domain/competitive-tracker';
export function HsrProfileView({ data }: { data: HsrProfile }) {
  const metrics = [
    ['NIVEL TRAZACAMINOS', `TL ${data.level}`],
    ['NIVEL DE EQUILIBRIO', `EQ ${data.worldLevel}`],
    ['LOGROS DESBLOQUEADOS', `🏆 ${data.achievements.toLocaleString('es-CL')}`],
    ['PERSONAJES OBTENIDOS', `👥 ${data.avatarCount}`],
    ['CONOS DE LUZ', `🃏 ${data.lightConeCount}`],
    ['ESCAPARATE ACTIVO', `✨ ${data.showcase.length} unidades`],
  ];
  return (
    <div className="competitive-profile hsr-profile">
      <header>
        <h2>{data.nickname}</h2>
        <span className="tag">
          UID {data.uid} · {data.platform}
        </span>
        {data.signature && <p className="muted">{data.signature}</p>}
      </header>
      <div className="genshin-kpi-grid">
        {metrics.map(([label, value]) => (
          <article key={label}>
            <p className="eyebrow">{label}</p>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <h3>Escaparate público · Tripulación del Expreso</h3>
      <p className="muted">
        Estadísticas base con cono y reliquias publicados. No incluyen bonificaciones de combate,
        trazas ni efectos de equipo.
      </p>
      <div className="competitive-showcase genshin-showcase">
        {data.showcase.map((character) => (
          <article
            key={character.avatarId}
            className={`genshin-character-card element-${character.elementCode}`}
          >
            <header className="genshin-character-heading">
              {character.iconUrl ? (
                <Image
                  className={`genshin-portrait rarity-${character.rarity}`}
                  src={character.iconUrl}
                  alt={`Retrato de ${character.name}`}
                  width={64}
                  height={64}
                  unoptimized
                  loading="lazy"
                />
              ) : (
                <span className="genshin-portrait genshin-portrait-placeholder" aria-hidden="true">
                  ✦
                </span>
              )}
              <div>
                <strong>{character.name}</strong>
                <span className={`genshin-stars rarity-${character.rarity}`}>
                  {'★'.repeat(character.rarity)}
                </span>
                <div className="tags">
                  <span className="tag">E{character.eidolons}</span>
                  <span>Nvl. {character.level}/80</span>
                  <span>{character.element}</span>
                </div>
              </div>
            </header>
            <p>
              🛤️ {character.path} · {character.relicsCount} reliquias
            </p>
            {character.stats ? (
              <dl className="genshin-stats-grid">
                {[
                  ['❤️ PV', character.stats.hp.toLocaleString('es-CL')],
                  ['⚔️ ATQ', character.stats.atk.toLocaleString('es-CL')],
                  ['🛡️ DEF', character.stats.def.toLocaleString('es-CL')],
                  ['👟 VEL', character.stats.speed.toLocaleString('es-CL')],
                  ['🎯 Prob. CRIT', `${character.stats.critRate}%`],
                  ['💥 Daño CRIT', `${character.stats.critDmg}%`],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="muted">
                Estadísticas no disponibles; no se pudo cargar el diccionario del personaje.
              </p>
            )}
            {character.lightCone && (
              <div className="genshin-weapon-box">
                {character.lightCone.iconUrl && (
                  <Image
                    src={character.lightCone.iconUrl}
                    alt=""
                    width={42}
                    height={58}
                    unoptimized
                    loading="lazy"
                  />
                )}
                <div>
                  <strong>{character.lightCone.name}</strong>
                  <p>
                    Nvl. {character.lightCone.level} ·{' '}
                    <span className="tag">S{character.lightCone.superimposition}</span> ·{' '}
                    {'★'.repeat(character.lightCone.rarity)}
                  </p>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
      {!data.showcase.length && (
        <p className="muted">
          El jugador no tiene personajes públicos. Activa el escaparate y sus detalles en Honkai:
          Star Rail.
        </p>
      )}
    </div>
  );
}
