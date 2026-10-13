'use client';
import { Search } from 'lucide-react';
import type { ScreenFilter, ScreenRegion } from '@/domain/screen';
export function ScreenFilterBar({
  filter,
  region,
  query,
  onFilter,
  onRegion,
  onQuery,
}: {
  filter: ScreenFilter;
  region: ScreenRegion;
  query: string;
  onFilter: (value: ScreenFilter) => void;
  onRegion: (value: ScreenRegion) => void;
  onQuery: (value: string) => void;
}) {
  return (
    <section className="screen-filter-bar screen-hud-card" aria-label="Filtros de cine y series">
      <div className="filter-buttons">
        {(
          [
            ['popular', 'Populares'],
            ['adaptations', 'Adaptaciones gamer'],
            ['tv', 'Series'],
            ['movie', 'Películas'],
            ['upcoming', 'Estrenos'],
            ['top', 'Mejor valoradas'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`button ${filter === value ? '' : 'outline'} small`}
            aria-pressed={filter === value}
            onClick={() => onFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="screen-search-row">
        <label>
          <span>
            <Search size={14} /> Buscar título &gt;_
          </span>
          <input
            value={query}
            maxLength={100}
            placeholder="Arcane, una película, una serie…"
            onChange={(event) => onQuery(event.target.value)}
          />
        </label>
        <label>
          <span>Región JustWatch</span>
          <select value={region} onChange={(event) => onRegion(event.target.value as ScreenRegion)}>
            {[
              ['CL', 'Chile'],
              ['MX', 'México'],
              ['ES', 'España'],
              ['US', 'Estados Unidos'],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
