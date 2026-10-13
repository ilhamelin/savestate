'use client';
import Image from 'next/image';
import { useState } from 'react';
import type { GenshinProfile, GenshinShowcaseCharacter } from '@/domain/competitive-tracker';
import { GENSHIN_ARTIFACT_SLOTS } from '@/domain/genshin-build';
const number = (value: number) => value.toLocaleString('es-CL');
function Asset({
  src,
  alt = '',
  size = 48,
  className = '',
  fallbackSrc,
}: {
  src: string | null;
  alt?: string;
  size?: number;
  className?: string;
  fallbackSrc?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  if (failed && fallbackSrc)
    return <Asset src={fallbackSrc} alt={alt} size={size} className={className} />;
  return src && !failed ? (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
      unoptimized
      onError={() => setFailed(true)}
    />
  ) : (
    <span
      className={`genshin-asset-fallback ${className}`}
      aria-label={alt || undefined}
      aria-hidden={!alt}
    >
      ✦
    </span>
  );
}
function Attributes({ character }: { character: GenshinShowcaseCharacter }) {
  const s = character.stats;
  if (!s) return <p className="muted">Este personaje no tiene su build publicada.</p>;
  const damage =
    s.physicalDmgBonus > s.elementalDmgBonus.value
      ? { label: 'Bono de Daño Físico', value: s.physicalDmgBonus }
      : s.elementalDmgBonus;
  return (
    <section className="genshin-attributes" aria-label="Atributos del personaje">
      <h4>Atributos del personaje</h4>
      <div className="genshin-attributes-columns">
        <dl>
          {[
            ['❤️ Vida Máx.', s.baseHp, s.bonusHp, s.maxHp],
            ['⚔️ ATQ', s.baseAtk, s.bonusAtk, s.atk],
            ['🛡️ DEF', s.baseDef, s.bonusDef, s.def],
          ].map(([label, base, bonus, total]) => (
            <div key={label}>
              <dt>
                {label}
                <small>
                  {number(Number(base))} <em>+{number(Number(bonus))}</em>
                </small>
              </dt>
              <dd>{number(Number(total))}</dd>
            </div>
          ))}
          <div>
            <dt>🌀 Maestría Elemental</dt>
            <dd>{number(s.elementalMastery)}</dd>
          </div>
          <div>
            <dt>{damage.label}</dt>
            <dd>{damage.value}%</dd>
          </div>
        </dl>
        <dl>
          {[
            ['✦ Prob. CRIT', s.critRate],
            ['💥 Daño CRIT', s.critDamage],
            ['💚 Bono de Curación', s.healingBonus],
            ['💖 Curación recibida', s.incomingHealingBonus],
            ['⚡ Recarga de Energía', s.energyRecharge],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}%</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
function CharacterInspector({ character }: { character: GenshinShowcaseCharacter }) {
  const weapon = character.weapon;
  const highlighted = Array.from(
    new Map(
      character.artifacts
        .flatMap((a) => a.substats)
        .filter((s) => s.isHighlight)
        .map((s) => [s.propId, s.label]),
    ).values(),
  );
  return (
    <div className={`genshin-inspector element-${character.elementCode}`}>
      <div className="genshin-character-showcase-stage">
        <div className="genshin-stage-visual">
          <Asset
            key={character.splashUrl ?? character.iconUrl}
            src={character.splashUrl ?? character.iconUrl}
            fallbackSrc={character.iconUrl}
            alt={`Ilustración de ${character.name}`}
            size={620}
            className="genshin-splash"
          />
          <ol className="genshin-constellation-rail" aria-label="Constelaciones">
            {character.constellationsList.map((c) => (
              <li
                key={c.index}
                className={c.unlocked ? 'unlocked' : 'locked'}
                title={`C${c.index}: ${c.unlocked ? 'desbloqueada' : 'bloqueada'}`}
                aria-label={`Constelación ${c.index}, ${c.unlocked ? 'desbloqueada' : 'bloqueada'}`}
              >
                <Asset src={c.iconUrl || null} size={32} />
                {!c.unlocked && (
                  <span className="genshin-lock" aria-hidden="true">
                    🔒
                  </span>
                )}
              </li>
            ))}
          </ol>
          <div className="genshin-visual-footer">
            <span className="genshin-chip">👁️ Amistad: {character.friendshipLevel ?? '—'}</span>
            <ul className="genshin-talent-row" aria-label="Talentos">
              {character.talentsList.map((t, index) => (
                <li
                  key={t.id}
                  className={t.boosted ? 'boosted' : ''}
                  title={`Talento ${index + 1}: nivel ${t.level}${t.boosted ? ' · bonificado por constelación' : ''}`}
                  aria-label={`Talento ${index + 1}: nivel ${t.level}${t.boosted ? ', bonificado por constelación' : ''}`}
                >
                  <Asset src={t.iconUrl} size={38} />
                  <span className="genshin-talent-level">{t.level}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="genshin-stage-details">
          <header>
            <span className="genshin-chip">{character.element}</span>
            <h3>{character.name}</h3>
            <div className="genshin-character-meta">
              <span className="genshin-chip">Niv. {character.level}</span>
              <span className="genshin-stars">{'★'.repeat(character.rarity)}</span>
              <span>C{character.constellations}</span>
            </div>
          </header>
          <Attributes character={character} />
          <section className="genshin-inspector-weapon" aria-label="Arma equipada">
            <h4>Arma</h4>
            {weapon ? (
              <div>
                <div className="genshin-weapon-icon">
                  <Asset src={weapon.iconUrl} size={64} />
                  <span aria-label={`Refinamiento ${weapon.refinement}`}>{weapon.refinement}</span>
                </div>
                <div>
                  <strong>{weapon.name}</strong>
                  <p className="genshin-stars">
                    {'★'.repeat(weapon.rarity)}{' '}
                    <span className="genshin-chip">Niv. {weapon.level}</span>
                  </p>
                  <div className="genshin-equipment-pills">
                    {weapon.baseAtk !== null && <span>ATQ Básico {number(weapon.baseAtk)}</span>}
                    {weapon.substat && <span>{weapon.substat}</span>}
                  </div>
                </div>
              </div>
            ) : (
              <p className="muted">Arma no publicada.</p>
            )}
          </section>
        </div>
      </div>
      <section
        className="genshin-inspector-artifacts"
        aria-label={`Artefactos de ${character.name}`}
      >
        <header>
          <h3>Artefactos</h3>
          <div className="genshin-equipment-pills">
            {character.activeArtifactSets.map((set) => (
              <span key={set.setName}>
                {set.count >= 4 ? '4p' : '2p'} {set.setName}
              </span>
            ))}
          </div>
        </header>
        <div className="genshin-artifact-summary">
          <p>
            <strong>Atributos principales:</strong>{' '}
            {character.artifacts
              .filter((a) => a.mainStatHighlight)
              .map((a) => (
                <span key={a.slot}>
                  {a.slotLabel}: {a.mainStat}
                </span>
              ))}
          </p>
          <p>
            <strong>Atributos secundarios:</strong>{' '}
            {highlighted.length ? (
              highlighted.map((label) => <span key={label}>{label} ✓</span>)
            ) : (
              <span className="muted">Sin subatributos publicados</span>
            )}
          </p>
        </div>
        <div className="genshin-artifacts-cards-grid">
          {GENSHIN_ARTIFACT_SLOTS.map((slot) => {
            const art = character.artifacts.find((a) => a.slot === slot);
            return art ? (
              <article key={slot} className="genshin-artifact-card">
                <header>
                  <div>
                    <small>{art.slotLabel}</small>
                    <h4>{art.setName || art.name}</h4>
                    <span className="genshin-chip">Niv. +{art.level}</span>
                    <p className="genshin-stars">{'★'.repeat(art.rarity)}</p>
                  </div>
                  <Asset src={art.iconUrl} size={52} />
                </header>
                <div
                  className={`genshin-artifact-main ${art.mainStatHighlight ? 'highlighted' : ''}`}
                >
                  <span>{art.mainStatLabel}</span>
                  <strong>{art.mainStatValue}</strong>
                </div>
                <ul>
                  {art.substats.map((sub) => (
                    <li key={sub.propId} className={sub.isHighlight ? 'highlighted' : ''}>
                      <span>
                        {sub.isHighlight ? '✦ ' : ''}
                        {sub.label}
                      </span>
                      <strong>+{sub.valueText}</strong>
                    </li>
                  ))}
                </ul>
                {!art.substats.length && <p className="muted">Sin subatributos publicados</p>}
              </article>
            ) : (
              <article className="genshin-artifact-card genshin-empty-slot" key={slot}>
                <span aria-hidden="true">◇</span>
                <h4>
                  {
                    (
                      {
                        EQUIP_BRACER: 'Flor',
                        EQUIP_NECKLACE: 'Pluma',
                        EQUIP_SHOES: 'Reloj',
                        EQUIP_RING: 'Cáliz',
                        EQUIP_DRESS: 'Corona',
                      } as Record<string, string>
                    )[slot]
                  }
                </h4>
                <p className="muted">Ranura no publicada</p>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
function GenshinInspector({ data }: { data: GenshinProfile }) {
  const [selectedCharIndex, setSelectedCharIndex] = useState(0);
  const index = Math.min(selectedCharIndex, Math.max(0, data.showcase.length - 1));
  const character = data.showcase[index];
  const select = (value: number) =>
    setSelectedCharIndex((value + data.showcase.length) % data.showcase.length);
  const metrics = [
    ['Rango de Aventura', data.level],
    ['Nivel de Mundo', data.worldLevel],
    ['Logros alcanzados', number(data.achievements)],
    ['Personajes en Vitrina', data.showcase.length],
    ['Personajes con Amistad Máx.', data.fetterCount],
    ['Espiral del Abismo', data.abyss],
    [
      'Teatro Fantasía',
      `${data.theater ?? '—'}${data.theaterStars !== null ? ` · ⭐ ${data.theaterStars}` : ''}`,
    ],
    ['Conflagración estigia', data.stygianSeconds !== null ? `${data.stygianSeconds}s` : '—'],
  ];
  return (
    <div className="competitive-profile genshin-profile genshin-chronicle">
      <header
        className="genshin-traveler-banner"
        style={
          data.nameCardUrl
            ? {
                backgroundImage: `linear-gradient(90deg,rgba(16,18,28,.94),rgba(16,18,28,.6)), url("${data.nameCardUrl}")`,
              }
            : undefined
        }
      >
        <Asset
          key={data.profileIconUrl}
          src={data.profileIconUrl}
          alt="Avatar del viajero"
          size={72}
          className="genshin-traveler-avatar"
        />
        <div>
          <div className="genshin-traveler-title">
            <h2>{data.nickname}</h2>
            <span className="genshin-chip">Niv. {data.level}</span>
          </div>
          <p>
            {data.regionLabel ?? 'Servidor no disponible'} · UID {data.uid}
          </p>
          {data.signature && <p className="muted">{data.signature}</p>}
        </div>
      </header>
      <section className="genshin-chronicle-summary">
        <h3>✦ Resumen de la partida</h3>
        <div>
          {metrics.map(([label, value]) => (
            <article key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </article>
          ))}
        </div>
      </section>
      <section className="genshin-characters-section">
        <h3>✦ Mis personajes</h3>
        {character ? (
          <>
            <div className="genshin-avatar-selector">
              <button
                type="button"
                className="button outline small"
                aria-label="Personaje anterior"
                disabled={data.showcase.length < 2}
                onClick={() => select(index - 1)}
              >
                ‹
              </button>
              <div className="genshin-avatar-strip" role="group" aria-label="Seleccionar personaje">
                {data.showcase.map((char, i) => (
                  <button
                    type="button"
                    key={char.avatarId}
                    aria-pressed={i === index}
                    aria-label={`Inspeccionar ${char.name}`}
                    onClick={() => select(i)}
                  >
                    <Asset src={char.iconUrl} size={56} />
                    <span>{char.name}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="button outline small"
                aria-label="Personaje siguiente"
                disabled={data.showcase.length < 2}
                onClick={() => select(index + 1)}
              >
                ›
              </button>
            </div>
            <CharacterInspector key={character.avatarId} character={character} />
          </>
        ) : (
          <p className="muted">El jugador no tiene personajes públicos en su escaparate.</p>
        )}
      </section>
    </div>
  );
}
export function GenshinProfileView({ data }: { data: GenshinProfile }) {
  return <GenshinInspector key={data.uid} data={data} />;
}
