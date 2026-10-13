'use client';
import { useEffect, useRef, useState } from 'react';
import { ScreenHeroRadar } from './screen-hero-radar';
import { ScreenFilterBar } from './screen-filter-bar';
import { ScreenMediaGrid } from './screen-media-grid';
import { ScreenTelemetryDrawer } from './screen-telemetry-drawer';
import { api } from '@/lib/client-api';
import { readJsonResponse } from '@/lib/api-response';
import {
  screenProgress,
  screenEpisodeKey,
  type ScreenDetail,
  type ScreenMediaItem,
  type ScreenEntryRow,
  type ScreenUserProgress,
  type ScreenRegion,
  type ScreenFilter,
} from '@/domain/screen';
type DetailResult = { detail: ScreenDetail; progress: ScreenUserProgress; available: boolean };
export function ScreenHub({
  featured,
  initialItems,
  entries,
  initialDetail,
  canEdit,
  available,
  initialRegion,
  initialOpenMobile = false,
}: {
  featured: ScreenMediaItem[];
  initialItems: ScreenMediaItem[];
  entries: ScreenEntryRow[];
  initialDetail: ScreenDetail | null;
  canEdit: boolean;
  available: boolean;
  initialRegion: ScreenRegion;
  initialOpenMobile?: boolean;
}) {
  const [items, setItems] = useState(initialItems),
    [filter, setFilter] = useState<ScreenFilter>('popular'),
    [region, setRegion] = useState(initialRegion),
    [query, setQuery] = useState('');
  const [progressMap, setProgressMap] = useState<Record<string, ScreenUserProgress>>(() =>
    Object.fromEntries(
      entries.map((row) => [`${row.media_type}:${row.tmdb_id}`, screenProgress(row)]),
    ),
  );
  const [detail, setDetail] = useState(initialDetail);
  const [drawerRequested, setDrawerRequested] = useState(initialOpenMobile);
  const [progress, setProgress] = useState<ScreenUserProgress>(() =>
    screenProgress(
      entries.find(
        (row) =>
          row.tmdb_id === initialDetail?.tmdbId && row.media_type === initialDetail.mediaType,
      ),
    ),
  );
  const [loading, setLoading] = useState(false),
    [detailLoading, setDetailLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const catalogCache = useRef(new Map([[`popular|${initialRegion}|`, initialItems]]));
  const request = useRef<AbortController | null>(null),
    busy = useRef(false);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    const search = query.trim(),
      key = `${filter}|${region}|${search}`,
      controller = new AbortController();
    const timer = setTimeout(
      async () => {
        if (search && search.length < 2) return;
        const cached = catalogCache.current.get(key);
        if (cached) {
          setItems(cached);
          setLoading(false);
          return;
        }
        setLoading(true);
        setError('');
        try {
          const params = new URLSearchParams({ region, ...(search ? { q: search } : { filter }) });
          const response = await fetch(`/api/screen/${search ? 'search' : 'popular'}?${params}`, {
            signal: controller.signal,
          });
          const result = await readJsonResponse<{ items: ScreenMediaItem[] }>(response);
          if (!controller.signal.aborted) {
            catalogCache.current.set(key, result.items);
            setItems(result.items);
          }
        } catch (failure) {
          if (!controller.signal.aborted) setError((failure as Error).message);
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      },
      search ? 300 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filter, region, query]);
  async function fetchDetail(
    item: ScreenMediaItem,
    season = 1,
    country = region,
  ): Promise<DetailResult> {
    const params = new URLSearchParams({
      type: item.mediaType,
      region: country,
      season: String(season),
    });
    return readJsonResponse<DetailResult>(
      await fetch(`/api/screen/media/${item.tmdbId}?${params}`, {
        signal: request.current?.signal,
      }),
    );
  }
  async function select(
    item: ScreenMediaItem,
    season = progressMap[item.id]?.currentSeason ?? 1,
    country = region,
  ) {
    if (busy.current) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setDetailLoading(true);
    setError('');
    setNotice('');
    try {
      const result = await fetchDetail(item, season, country);
      if (controller.signal.aborted) return;
      setDetail(result.detail);
      setDrawerRequested(true);
      setProgress({
        ...result.progress,
        currentSeason: season,
        currentEpisode:
          season === result.progress.currentSeason ? result.progress.currentEpisode : 0,
        totalEpisodes: result.detail.totalEpisodes,
      });
      const params = new URLSearchParams(window.location.search);
      params.set('select', String(item.tmdbId));
      params.set('type', item.mediaType);
      window.history.replaceState(null, '', `/screen?${params}`);
    } catch (failure) {
      if (!controller.signal.aborted) setError((failure as Error).message);
    } finally {
      if (!controller.signal.aborted) setDetailLoading(false);
    }
  }
  async function persist(item: ScreenDetail, next: ScreenUserProgress) {
    const row = await api<ScreenEntryRow>('screen/progress', {
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      ...next,
    });
    const saved = screenProgress(row);
    setProgressMap((map) => ({ ...map, [item.id]: saved }));
    return saved;
  }
  async function save(patch: Partial<ScreenUserProgress>) {
    if (!detail || busy.current || !canEdit || !available) return;
    busy.current = true;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const next = { ...progress, ...patch };
      if (patch.status === 'completed' && detail.mediaType === 'tv') {
        next.watchedEpisodes = detail.seasons.flatMap((season) =>
          Array.from({ length: season.episodeCount }, (_, index) =>
            screenEpisodeKey(season.number, index + 1),
          ),
        );
      }
      const saved = await persist(detail, next);
      setProgress(saved);
      setNotice('Checkpoint guardado.');
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  function toggleEpisode(key: number) {
    const watched = progress.watchedEpisodes.includes(key),
      episodes = watched
        ? progress.watchedEpisodes.filter((value) => value !== key)
        : [...progress.watchedEpisodes, key];
    void save({
      watchedEpisodes: episodes,
      status: episodes.length === detail?.totalEpisodes ? 'completed' : 'watching',
      currentEpisode: watched
        ? Math.max(
            0,
            ...episodes
              .filter((value) => Math.floor(value / 10000) === progress.currentSeason)
              .map((value) => value % 10000),
          )
        : key % 10000,
    });
  }
  async function advance(item: ScreenMediaItem) {
    if (busy.current || !canEdit || !available) return;
    busy.current = true;
    setSaving(true);
    setError('');
    request.current?.abort();
    request.current = new AbortController();
    try {
      let result = await fetchDetail(item, progressMap[item.id]?.currentSeason ?? 1);
      const entry = progressMap[item.id] ?? result.progress;
      const first = result.detail.seasons
        .flatMap((season) =>
          Array.from({ length: season.episodeCount }, (_, index) => ({
            season: season.number,
            episode: index + 1,
            key: screenEpisodeKey(season.number, index + 1),
          })),
        )
        .find((episode) => !entry.watchedEpisodes.includes(episode.key));
      if (!first) {
        setNotice('Todos los episodios ya están registrados.');
        return;
      }
      if (first.season !== result.detail.episodes[0]?.seasonNumber)
        result = await fetchDetail(item, first.season);
      const episode = result.detail.episodes.find(
        (episode) => episode.episodeNumber === first.episode,
      );
      if (!episode) throw new Error('No se encontró el siguiente episodio.');
      const next: ScreenUserProgress = {
        ...entry,
        currentSeason: first.season,
        currentEpisode: first.episode,
        totalEpisodes: result.detail.totalEpisodes,
        watchedEpisodes: [...entry.watchedEpisodes, first.key],
        status:
          entry.watchedEpisodes.length + 1 === result.detail.totalEpisodes
            ? 'completed'
            : 'watching',
      };
      const saved = await persist(result.detail, next);
      setDetail(result.detail);
      setDrawerRequested(true);
      setProgress(saved);
      setNotice('Episodio registrado.');
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  return (
    <div className="screen-module">
      <ScreenHeroRadar
        items={featured}
        progress={progressMap}
        onSelect={(item) => void select(item)}
      />
      {initialItems.some((item) => item.source === 'demo') && (
        <p className="screen-demo-notice">
          MODO DEMO // Títulos curados y episodios de ejemplo. Configura TMDB_API_KEY o
          TMDB_READ_TOKEN para obtener datos y disponibilidad reales.
        </p>
      )}
      {!available && (
        <p className="error-text">Aplica la migración 029 para guardar tu bitácora.</p>
      )}
      <ScreenFilterBar
        filter={filter}
        region={region}
        query={query}
        onFilter={(value) => {
          setFilter(value);
          setQuery('');
        }}
        onRegion={(value) => {
          setRegion(value);
          catalogCache.current.clear();
          if (detail) void select(detail, progress.currentSeason, value);
        }}
        onQuery={setQuery}
      />
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="screen-save-notice">
          {notice}
        </p>
      )}
      <div className={`screen-layout${!detail && !detailLoading ? ' screen-layout-wide' : ''}`}>
        <section aria-label="Catálogo de Screen" aria-busy={loading}>
          <div className="screen-grid-heading">
            <h2>Tu próxima señal</h2>
            <span className="muted">{loading ? 'Cargando…' : `${items.length} títulos`}</span>
          </div>
          <ScreenMediaGrid
            items={items}
            progress={progressMap}
            selected={detail?.id ?? null}
            onSelect={(item) => void select(item)}
            onAdvance={(item) => void advance(item)}
            busy={saving || detailLoading || !canEdit || !available}
          />
          {!loading && !items.length && (
            <p className="panel">No se encontraron títulos. Prueba otra búsqueda.</p>
          )}
        </section>
        {(detail || detailLoading) && (
          <div className="screen-drawer-column">
            {detailLoading ? (
              <div className="screen-hud-card skeleton" role="status">
                Cargando telemetría…
              </div>
            ) : detail ? (
              <ScreenTelemetryDrawer
                detail={detail}
                openMobile={drawerRequested}
                progress={{ ...progress, totalEpisodes: detail.totalEpisodes }}
                busy={saving}
                canEdit={canEdit && available}
                onSave={(patch) => void save(patch)}
                onSeason={(season) => void select(detail, season)}
                onToggle={toggleEpisode}
                onNotes={(notes) => setProgress((value) => ({ ...value, notes }))}
                onClose={() => {
                  setDetail(null);
                  setDrawerRequested(false);
                }}
              />
            ) : (
              <div className="screen-hud-card muted">
                Selecciona un título para abrir su ficha y bitácora.
              </div>
            )}
          </div>
        )}
      </div>
      <p className="screen-attribution">
        <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer">
          TMDB
        </a>{' '}
        ·{' '}
        <a href="https://www.justwatch.com" target="_blank" rel="noopener noreferrer">
          JustWatch
        </a>
        <br />
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>
    </div>
  );
}
