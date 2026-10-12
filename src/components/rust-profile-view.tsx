import Image from 'next/image';
import type { RustProfile, RustBreakdownItem } from '@/domain/rust-profile';
const formatted = (value: number) => value.toLocaleString('es-CL');
function compactNumber(value: number) {
  if (value >= 1_000_000)
    return `${(value / 1_000_000).toLocaleString('es-CL', { maximumFractionDigits: 2 })}M`;
  if (value >= 100_000)
    return `${(value / 1000).toLocaleString('es-CL', { maximumFractionDigits: 1 })}k`;
  return formatted(value);
}
function MiniHudGauge({ percent, color }: { percent: number; color: string }) {
  return (
    <svg width="34" height="34" viewBox="0 0 36 36" aria-hidden="true" className="rust-mini-gauge">
      <circle cx="18" cy="18" r="14" fill="none" stroke="#26323c" strokeWidth="3" />
      <circle
        cx="18"
        cy="18"
        r="14"
        fill="none"
        stroke={color}
        strokeWidth="3"
        pathLength={100}
        strokeDasharray={`${Math.min(100, Math.max(0, percent))} 100`}
        transform="rotate(-90 18 18)"
      />
    </svg>
  );
}
function HudTelemetryRing({
  totalLabel,
  totalValue,
  items,
}: {
  totalLabel: string;
  totalValue: string;
  items: RustBreakdownItem[];
}) {
  const segments = items.map((item, index) => ({
    item,
    start: items.slice(0, index).reduce((offset, previous) => offset + previous.percent, 0),
  }));
  return (
    <div className="rust-telemetry-ring">
      <svg width="168" height="168" viewBox="0 0 120 120" aria-hidden="true">
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="#00f0ff20"
          strokeWidth="1"
          strokeDasharray="2 4"
        />
        <circle cx="60" cy="60" r="46" fill="none" stroke="#26323c" strokeWidth="12" />
        {segments
          .filter(({ item }) => item.percent > 0)
          .map(({ item, start }) => (
            <circle
              key={item.id}
              cx="60"
              cy="60"
              r="46"
              fill="none"
              stroke={item.color}
              strokeWidth="12"
              pathLength={100}
              strokeDasharray={`${item.percent} ${100 - item.percent}`}
              strokeDashoffset={-start}
              transform="rotate(-90 60 60)"
            />
          ))}
      </svg>
      <div className="rust-ring-center">
        <small>{totalLabel}</small>
        <strong>{totalValue}</strong>
      </div>
    </div>
  );
}
function BreakdownCard({
  title,
  total,
  items,
  compact = false,
}: {
  title: string;
  total: number;
  items: RustBreakdownItem[];
  compact?: boolean;
}) {
  return (
    <section className="panel rust-breakdown-card">
      <h3 className="eyebrow">{title}</h3>
      <HudTelemetryRing
        totalLabel="TOTAL REGISTRADO"
        totalValue={compact ? compactNumber(total) : formatted(total)}
        items={items}
      />
      <ul className="rust-breakdown-list">
        {items.map((item) => (
          <li key={item.id}>
            <div>
              <span className="rust-segment-label">
                <i style={{ background: item.color }} aria-hidden="true" />
                {item.icon} {item.label}
              </span>
              <strong>
                {item.count >= 100000 ? compactNumber(item.count) : formatted(item.count)}
              </strong>
              <small>{formatted(item.percent)}%</small>
            </div>
            <span className="rust-breakdown-track" aria-hidden="true">
              <span
                style={{
                  width: `${Math.min(100, Math.max(item.count > 0 ? 3 : 0, item.percent))}%`,
                  background: item.color,
                }}
              />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
function TacticalModule({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <section className="panel rust-module-card">
      <h3 className="eyebrow">{title}</h3>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
export function RustProfileView({ data }: { data: RustProfile }) {
  const c = data.combat,
    b = data.breakdowns,
    m = data.modules;
  const playerHitRatio =
    b && b.totalBulletHits > 0
      ? Number((((c?.bulletsHitPlayer ?? 0) / b.totalBulletHits) * 100).toFixed(2))
      : 0;
  const metrics: { label: string; value: string; gauge?: { percent: number; color: string } }[] = [
    { label: 'Ratio K/D PvP', value: c ? formatted(c.kdRatio) : '—' },
    { label: 'Bajas de Jugadores', value: c ? formatted(c.killsPvp) : '—' },
    { label: 'Muertes', value: c ? formatted(c.deaths) : '—' },
    { label: 'Headshots', value: c ? formatted(c.headshots) : '—' },
    { label: 'Balas Disparadas', value: c ? compactNumber(c.bulletsFired) : '—' },
    { label: 'Impactos a Jugadores', value: c ? formatted(c.bulletsHitPlayer) : '—' },
    {
      label: 'Precisión',
      value: c ? `${formatted(c.accuracyPercent)}%` : '—',
      gauge: c ? { percent: c.accuracyPercent, color: '#00f0ff' } : undefined,
    },
    {
      label: 'Tasa de Headshot',
      value: c ? `${formatted(c.headshotRatePercent)}%` : '—',
      gauge: c ? { percent: c.headshotRatePercent, color: '#ff5500' } : undefined,
    },
  ];
  return (
    <div className="competitive-profile rust-profile rust-hud">
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
          <p className="eyebrow">RUST // SURVIVOR TELEMETRY</p>
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
      <div className="rust-top-grid">
        <section className="panel rust-playtime-panel">
          <h3 className="eyebrow">⏱️ TIEMPO DE OPERACIÓN</h3>
          <strong className="rust-playtime-value">
            {data.hoursPlayed !== null ? `${formatted(data.hoursPlayed)} HORAS` : 'NO DISPONIBLE'}
          </strong>
          <div className="tags">
            <span className="tag">
              {data.recentHours2Weeks !== null ? formatted(data.recentHours2Weeks) : '—'} h últimas
              2 sem.
            </span>
            <span className="tag">🏆 {data.achievementsUnlocked ?? '—'} logros Steam</span>
          </div>
          {b && c && b.totalBulletHits > 0 ? (
            <div className="rust-ratio-split">
              <div className="rust-ratio-bar" aria-hidden="true">
                <span style={{ width: `${playerHitRatio}%` }} />
                <span style={{ width: `${100 - playerHitRatio}%` }} />
              </div>
              <p>
                <strong>Fuego contra Jugadores</strong>
                <span>
                  {formatted(playerHitRatio)}% · {formatted(c.bulletsHitPlayer)} imp.
                </span>
              </p>
              <p>
                <strong>Fuego contra Entorno/Estructuras</strong>
                <span>{formatted(100 - playerHitRatio)}%</span>
              </p>
            </div>
          ) : (
            <p className="muted">
              {b
                ? 'Sin impactos registrados para calcular la distribución.'
                : 'Distribución de impactos no disponible.'}
            </p>
          )}
        </section>
        <section className="panel rust-pvp-panel">
          <h3 className="eyebrow">⚔️ TELEMETRÍA PVP // MATRIZ DE COMBATE</h3>
          <dl className="rust-pvp-matrix">
            {metrics.map((metric) => (
              <div key={metric.label}>
                <dt>{metric.label}</dt>
                <dd>
                  <strong>{metric.value}</strong>
                  {metric.gauge && <MiniHudGauge {...metric.gauge} />}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
      {data.statsPublic && b && m ? (
        <>
          <div className="rust-breakdown-grid">
            <BreakdownCard
              title="🎯 IMPACTOS DE BALA"
              total={b.totalBulletHits}
              items={b.bulletHits}
            />
            <BreakdownCard title="💀 DESGLOSE DE BAJAS" total={b.totalKills} items={b.kills} />
            <BreakdownCard
              title="🌲 RECURSOS RECOLECTADOS"
              total={b.totalResources}
              items={b.resources}
              compact
            />
          </div>
          <div className="rust-modules-grid">
            <TacticalModule
              title="🏗️ CONSTRUCCIÓN Y BASE"
              rows={[
                ['Bloques colocados', formatted(m.building.blocksPlaced)],
                ['Bloques mejorados', formatted(m.building.blocksUpgraded)],
                ['Planos estudiados', formatted(m.building.blueprintsStudied)],
              ]}
            />
            <TacticalModule
              title="🐎 MOVILIDAD Y RESCATE"
              rows={[
                ['Kilómetros recorridos', `${formatted(m.horse.kilometersRidden)} km`],
                ['Millas recorridas', `${formatted(m.horse.milesRidden)} mi`],
                ['Jugadores levantados', formatted(m.horse.woundedHealed)],
              ]}
            />
            <TacticalModule
              title="🪓 CUERPO A CUERPO Y ASEDIO"
              rows={[
                ['Golpes melee', compactNumber(m.melee.strikes)],
                ['Armas arrojadizas', formatted(m.melee.throws)],
                ['Cohetes disparados', formatted(m.melee.rocketsFired)],
              ]}
            />
            <TacticalModule
              title="🍖 SUPERVIVENCIA Y CONSUMO"
              rows={[
                ['Calorías consumidas', compactNumber(m.consumption.calories)],
                ['Agua consumida', compactNumber(m.consumption.water)],
                ['Veces abatido', formatted(m.consumption.woundedTimes)],
              ]}
            />
          </div>
        </>
      ) : (
        <p className="rust-private-notice" role="status">
          Las estadísticas de Rust están privadas o no disponibles. En Steam, abre Editar perfil →
          Configuración de privacidad → Detalles de los juegos → Público. Las horas también
          requieren que el tiempo de juego sea visible.
        </p>
      )}
      <p className="muted">
        Telemetría acumulada de Steam; no corresponde a un servidor o wipe específico. El cálculo
        PvP descuenta científicos, fauna y moradores cuando el contador total supera sus bajas
        combinadas.
      </p>
    </div>
  );
}
