import React from 'react';
import '@/styles/game-achievements.css';
import {
  GameAchievementItem,
  GameAchievementsReport,
  getTierLabel,
} from '@/domain/game-achievements';
import { getCachedGameAchievements } from '@/services/game-achievements-service';

function AchievementCard({ item }: { item: GameAchievementItem }) {
  const tierLabel = getTierLabel(item.tier);
  const fillWidth = `${Math.min(100, Math.max(4, item.unlockedPercentage))}%`;

  return (
    <div className={`achievement-card tier-${item.tier}`}>
      <div className="achievement-icon-wrapper">
        <div className="achievement-icon-fallback" aria-hidden="true">
          🏆
        </div>
        {item.iconUrl ? (
          <img
            src={item.iconUrl}
            alt=""
            aria-hidden="true"
            className="achievement-img"
            loading="lazy"
            decoding="async"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : null}
      </div>

      <div className="achievement-content">
        <div className="achievement-title-row">
          <h4 className="achievement-title" title={item.name}>
            {item.name}
          </h4>
          <span className={`achievement-badge badge-${item.tier}`} title={`Rareza: ${tierLabel}`}>
            {item.unlockedPercentage}%
          </span>
        </div>

        {item.description ? (
          <p className="achievement-desc">{item.description}</p>
        ) : item.hidden ? (
          <p className="achievement-desc muted">Detalles ocultos para evitar spoilers.</p>
        ) : null}

        {item.hidden ? (
          <span className="achievement-secret-tag" title="Logro secreto en Steam">
            🔒 Logro Secreto
          </span>
        ) : null}

        <div
          className="achievement-bar-bg"
          title={`Desbloqueado por el ${item.unlockedPercentage}% de los jugadores`}
        >
          <div className={`achievement-bar-fill bar-${item.tier}`} style={{ width: fillWidth }} />
        </div>
      </div>
    </div>
  );
}

export function GameAchievementsView({ report }: { report: GameAchievementsReport }) {
  if (!report || !report.hasAchievements || !report.achievements?.length || !report.summary) {
    return null;
  }

  const { summary, achievements } = report;
  const initialBatch = achievements.slice(0, 12);
  const remainingBatch = achievements.slice(12);

  return (
    <section className="panel achievements-hub-section" aria-label="Salón de trofeos y logros">
      <div className="achievements-hub-header">
        <div>
          <p className="eyebrow">SALÓN DE TROFEOS // STEAM</p>
          <h2>Logros y Rareza Global</h2>
        </div>
        {report.communityUrl ? (
          <a
            href={report.communityUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="achievements-community-link"
          >
            <span>Ver en Steam Community</span>
            <span aria-hidden="true">↗</span>
          </a>
        ) : null}
      </div>

      {/* Resumen Estadístico */}
      <div className="achievements-summary-grid">
        <div className="achievement-stat-card">
          <span className="stat-card-value">{report.totalAchievements ?? 0}</span>
          <span className="stat-card-label">Total Logros</span>
        </div>
        <div className="achievement-stat-card stat-platino">
          <span className="stat-card-value">{summary.platinoCount ?? 0}</span>
          <span className="stat-card-label">💎 Platino</span>
        </div>
        <div className="achievement-stat-card stat-oro">
          <span className="stat-card-value">{summary.oroCount ?? 0}</span>
          <span className="stat-card-label">🥇 Oro</span>
        </div>
        <div className="achievement-stat-card stat-plata">
          <span className="stat-card-value">{summary.plataCount ?? 0}</span>
          <span className="stat-card-label">🥈 Plata</span>
        </div>
        <div className="achievement-stat-card stat-bronce">
          <span className="stat-card-value">{summary.bronceCount ?? 0}</span>
          <span className="stat-card-label">🥉 Bronce</span>
        </div>
        <div className="achievement-stat-card">
          <span className="stat-card-value">{summary.averageUnlockRate ?? 0}%</span>
          <span className="stat-card-label">Media Global</span>
        </div>
      </div>

      {/* Lista de Logros */}
      <div className="achievements-list-grid">
        {initialBatch.map((item) => (
          <AchievementCard key={item.id} item={item} />
        ))}
      </div>

      {/* Expansión progresiva para juegos con más de 12 logros */}
      {remainingBatch.length > 0 ? (
        <details className="achievements-disclosure">
          <summary className="achievements-toggle-btn">
            <span>Explorar los {remainingBatch.length} logros restantes</span>
            <span aria-hidden="true">▼</span>
          </summary>
          <div className="achievements-list-grid">
            {remainingBatch.map((item) => (
              <AchievementCard key={item.id} item={item} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

export async function GameAchievementsHub({ title }: { title: string }) {
  let report: GameAchievementsReport | null = null;
  try {
    report = await getCachedGameAchievements(title);
  } catch {
    return null;
  }

  if (!report || !report.hasAchievements || !report.achievements?.length || !report.summary) {
    return null;
  }

  return <GameAchievementsView report={report} />;
}
