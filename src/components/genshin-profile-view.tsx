import Image from 'next/image';
import type { GenshinProfile } from '@/domain/competitive-tracker';
export function GenshinProfileView({ data }: { data: GenshinProfile }) {
  const metrics = [
    ['RANGO DE AVENTURA', `AR ${data.level}`],
    ['NIVEL DE MUNDO', `WL ${data.worldLevel}`],
    ['LOGROS DESBLOQUEADOS', `🏆 ${data.achievements.toLocaleString('es-CL')}`],
    [
      'ESPIRAL DEL ABISMO',
      `🌀 ${data.abyss === 'Sin registro' ? data.abyss : `Piso ${data.abyss}`}`,
    ],
    ['ASALTO ESTIGIO / TEATRO', `⚔️ ${data.stygian ?? data.theater ?? 'Sin registro'}`],
    ['AMISTAD NIVEL 10', `❤️ ${data.fetterCount} personajes`],
  ];
  return (
    <div className="competitive-profile genshin-profile">
      <header>
        <h2>{data.nickname}</h2>
        <span className="tag">UID {data.uid}</span>
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
      <h3>Escaparate público · Builds de personajes</h3>
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
                  <span className="tag">C{character.constellations}</span>
                  <span>Nvl. {character.level}/90</span>
                  <span>{character.element}</span>
                </div>
              </div>
            </header>
            <div className="tags">
              {!!character.talents.length && (
                <span className="tag">Talentos {character.talents.join(' / ')}</span>
              )}
              {character.friendship !== null && (
                <span className="tag">❤️ Amistad {character.friendship}</span>
              )}
            </div>
            {character.stats ? (
              <dl className="genshin-stats-grid">
                {[
                  ['❤️ VIDA', character.stats.hp.toLocaleString('es-CL')],
                  ['⚔️ ATQ', character.stats.atk.toLocaleString('es-CL')],
                  ['🛡️ DEF', character.stats.def.toLocaleString('es-CL')],
                  ['🎯 Prob. CRIT', `${character.stats.critRate}%`],
                  ['💥 Daño CRIT', `${character.stats.critDmg}%`],
                  [
                    '⚡ Recarga / ✨ ME',
                    `${character.stats.energyRecharge}% · ${character.stats.elementalMastery} ME`,
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="muted">Este personaje no tiene su build publicada.</p>
            )}
            {character.weapon && (
              <div className="genshin-weapon-box">
                {character.weapon.iconUrl && (
                  <Image
                    src={character.weapon.iconUrl}
                    alt=""
                    width={42}
                    height={42}
                    unoptimized
                    loading="lazy"
                  />
                )}
                <div>
                  <strong>{character.weapon.name}</strong>
                  <p>
                    Nvl. {character.weapon.level} ·{' '}
                    <span className="tag">R{character.weapon.refinement}</span> ·{' '}
                    {'★'.repeat(Math.min(5, character.weapon.rarity))}
                  </p>
                  {character.weapon.baseAtk !== null && (
                    <span>ATQ Base {character.weapon.baseAtk}</span>
                  )}
                  {character.weapon.substat && <p className="accent">{character.weapon.substat}</p>}
                </div>
              </div>
            )}
            {!!character.artifacts.length && (
              <ul className="genshin-artifact-row" aria-label={`Artefactos de ${character.name}`}>
                {character.artifacts.map((art, index) => (
                  <li key={`${art.iconUrl}-${index}`} title={art.mainStat}>
                    <Image
                      src={art.iconUrl}
                      alt={art.mainStat}
                      width={36}
                      height={36}
                      unoptimized
                      loading="lazy"
                    />
                    <span>+{art.level}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
      {!data.showcase.length && (
        <p className="muted">El jugador no tiene personajes públicos en su escaparate.</p>
      )}
    </div>
  );
}
