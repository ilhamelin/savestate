import Image from 'next/image';
import type { RustProfile } from '@/domain/competitive-tracker';
const formatted = (value: number) => value.toLocaleString('es-CL');
export function RustProfileView({ data }: { data: RustProfile }) {
  const metrics = [
    [
      'TIEMPO EN RUST',
      data.hoursPlayed !== null ? `⏱️ ${formatted(data.hoursPlayed)} h` : 'No disponible',
    ],
    ['RATIO K/D PVP', data.combat ? `🎯 ${data.combat.kdRatio}` : '—'],
    [
      'BAJAS PVP / MUERTES',
      data.combat
        ? `💀 ${formatted(data.combat.killsPvp)} / ${formatted(data.combat.deaths)}`
        : '—',
    ],
    ['HEADSHOTS', data.combat ? `🤯 ${formatted(data.combat.headshots)}` : '—'],
    ['PRECISIÓN DE DISPARO', data.combat ? `🔫 ${data.combat.accuracyPercent}%` : '—'],
    [
      'LOGROS DESBLOQUEADOS',
      data.achievementsUnlocked !== null ? `🏆 ${formatted(data.achievementsUnlocked)}` : '—',
    ],
  ];
  return (
    <div className="competitive-profile rust-profile">
      <header className="rust-profile-heading">
        {data.avatarUrl && (
          <Image
            className="rust-avatar"
            src={data.avatarUrl}
            alt={`Avatar de ${data.personaName}`}
            width={72}
            height={72}
            unoptimized
          />
        )}
        <div>
          <h2>{data.personaName}</h2>
          <span className="tag">STEAM ID {data.steamId}</span>
          {data.profileUrl && (
            <p>
              <a href={data.profileUrl} target="_blank" rel="noopener noreferrer">
                Ver perfil de Steam ↗
              </a>
            </p>
          )}
        </div>
      </header>
      <div className="genshin-kpi-grid">
        {metrics.map(([label, value], index) => (
          <article key={label}>
            <p className="eyebrow">{label}</p>
            <strong>{value}</strong>
            {index === 0 && data.recentHours2Weeks !== null && (
              <p className="muted">{formatted(data.recentHours2Weeks)} h últimas 2 sem.</p>
            )}
          </article>
        ))}
      </div>
      {data.statsPublic && data.combat && data.survival ? (
        <div className="rust-telemetry-grid">
          <section className="rust-telemetry-panel">
            <h3>Telemetría de Combate y Supervivencia</h3>
            <dl className="genshin-stats-grid">
              {[
                ['🔫 Balas disparadas', data.combat.bulletsFired],
                ['🎯 Impactos a jugadores', data.combat.bulletsHitPlayer],
                ['🧪 Científicos eliminados', data.combat.scientistsKilled],
                ['🐻 Fauna cazada', data.combat.animalsKilled],
                ['🩹 Veces levantado', data.survival.woundedHealed],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{formatted(Number(value))}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="rust-telemetry-panel">
            <h3>Farmeo de Recursos y Raideo</h3>
            <dl className="genshin-stats-grid">
              {[
                ['🪵 Madera recolectada', data.survival.woodHarvested],
                ['🪨 Piedra recolectada', data.survival.stoneHarvested],
                ['⚙️ Mineral de Metal', data.survival.metalOre],
                ['🧨 Mineral de Azufre', data.survival.sulfurOre],
                ['🚀 Cohetes disparados', data.survival.rocketsFired],
                ['📐 Planos estudiados', data.survival.blueprintsStudied],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{formatted(Number(value))}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      ) : (
        <p className="rust-private-notice" role="status">
          Las estadísticas de Rust están privadas o no disponibles. En Steam, abre Editar perfil →
          Configuración de privacidad → Detalles de los juegos → Público. Las horas también
          requieren que el tiempo de juego sea visible.
        </p>
      )}
      <p className="muted">
        Telemetría acumulada publicada por Steam; no corresponde a un servidor o wipe específico.
      </p>
    </div>
  );
}
