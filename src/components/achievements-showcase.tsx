'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Game, PlayLog, UserGame } from '@/domain/model';
import { showcaseGames, type AchievementPlatform } from '@/domain/achievements-showcase';
import { ConsoleProgressBadge } from '@/components/console-progress-badge';

const PAGE_SIZE = 4;
const PLATFORMS: [AchievementPlatform, string][] = [
  ['all', 'Todas'],
  ['steam', 'Steam'],
  ['xbox', 'Xbox'],
  ['playstation', 'PlayStation'],
];

export function AchievementsShowcase({
  games,
  entries,
  logs,
}: {
  games: Game[];
  entries: UserGame[];
  logs: PlayLog[];
}) {
  const [platform, setPlatform] = useState<AchievementPlatform>('all');
  const [completed, setCompleted] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visible = useMemo(
    () => showcaseGames(games, entries, logs, platform, completed),
    [games, entries, logs, platform, completed],
  );
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const selected = visible.find((item) => item.game.id === selectedId) ?? visible[0];
  const paged = visible.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  return (
    <section
      className="panel achievements-showcase"
      aria-labelledby="achievements-showcase-heading"
    >
      <p className="eyebrow">ACHIEVEMENT DATA / PLAYER SHOWCASE</p>
      <h2 id="achievements-showcase-heading">Vitrina de logros y trofeos</h2>
      <div className="achievements-showcase-grid">
        <div className="achievement-featured" aria-live="polite" aria-atomic="true">
          {selected ? (
            <>
              <div className="achievement-featured-cover">
                {selected.game.cover_url ? (
                  <Image
                    src={selected.game.cover_url}
                    alt={`Portada de ${selected.game.title}`}
                    fill
                    sizes="(max-width: 900px) 260px, 320px"
                  />
                ) : (
                  <span aria-hidden="true">▣</span>
                )}
              </div>
              <h3>
                <Link href={`/games/${selected.game.slug}`}>{selected.game.title} ↗</Link>
              </h3>
              <p className="muted">
                {selected.hours.toFixed(1)} h registradas · {Math.round(selected.percent)}%
              </p>
              {selected.percent === 100 ? <span className="tag">🏆 100% PLATINADO</span> : null}
              {selected.logs.map((log) => (
                <ConsoleProgressBadge
                  key={log.id}
                  progress={log.console_progress!}
                  platform={log.platform_played}
                />
              ))}
            </>
          ) : (
            <p className="muted">No hay juegos con progreso de logros para estos filtros.</p>
          )}
        </div>
        <div className="achievement-browser">
          <div className="filter-buttons" aria-label="Plataforma de logros">
            {PLATFORMS.map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={platform === value}
                onClick={() => {
                  setPlatform(value);
                  setPage(0);
                  setSelectedId(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="achievement-completed-filter">
            <input
              type="checkbox"
              checked={completed}
              onChange={(event) => {
                setCompleted(event.target.checked);
                setPage(0);
                setSelectedId(null);
              }}
            />
            🏆 100% Platinados
          </label>
          <ul className="achievement-list">
            {paged.map((item) => (
              <li key={item.game.id}>
                <button
                  type="button"
                  className="achievement-list-game"
                  aria-pressed={selected?.game.id === item.game.id}
                  onClick={() => setSelectedId(item.game.id)}
                >
                  <span className="achievement-mini-cover">
                    {item.game.cover_url ? (
                      <Image src={item.game.cover_url} alt="" width={48} height={64} />
                    ) : (
                      <span aria-hidden="true">▣</span>
                    )}
                  </span>
                  <span className="achievement-list-copy">
                    <strong>{item.game.title}</strong>
                    <span>
                      {item.logs[0]!.console_progress!.current} /{' '}
                      {item.logs[0]!.console_progress!.total}{' '}
                      {item.logs[0]!.console_progress!.kind === 'gamerscore'
                        ? 'G'
                        : item.logs[0]!.console_progress!.kind === 'trophies'
                          ? 'trofeos'
                          : 'logros'}{' '}
                      · {Math.round(item.percent)}%
                    </span>
                    <progress
                      value={item.percent}
                      max={100}
                      aria-label={`Progreso de ${item.game.title}`}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!visible.length ? (
            <p className="muted">
              Sin resultados. Cambia los filtros o sincroniza los logros desde tu biblioteca.
            </p>
          ) : null}
          <nav className="filter-buttons achievement-pagination" aria-label="Páginas de logros">
            <button
              type="button"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              ← Anterior
            </button>
            <span role="status">
              Página {currentPage + 1} de {pages} ({visible.length} títulos)
            </span>
            <button
              type="button"
              disabled={currentPage >= pages - 1}
              onClick={() => setPage(currentPage + 1)}
            >
              Siguiente →
            </button>
          </nav>
        </div>
      </div>
    </section>
  );
}
