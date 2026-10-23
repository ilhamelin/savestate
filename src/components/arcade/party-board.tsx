'use client';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { PartyBoard as PartyCards } from '@/components/party-board';
import { PartyModal } from './party-modal';
import { readJsonResponse } from '@/lib/api-response';
import {
  PARTY_PLATFORMS,
  PARTY_STYLES,
  PARTY_STYLE_LABELS,
  type PartyFeedResponse,
  type PartyPlatform,
  type PartyStyle,
} from '@/domain/arcade';

export function PartyBoard({
  initial,
  viewerId,
  configured = true,
}: {
  initial: PartyFeedResponse;
  viewerId: string | null;
  configured?: boolean;
}) {
  const [platform, setPlatform] = useState<PartyPlatform | ''>('');
  const [playstyle, setPlaystyle] = useState<PartyStyle | ''>('');
  const [page, setPage] = useState(1),
    [revision, setRevision] = useState(0);
  const key = JSON.stringify([platform, playstyle, page, revision]);
  const loadedKey = useRef(key);
  const [result, setResult] = useState<{
    key: string;
    feed: PartyFeedResponse | null;
    error: string;
  }>({
    key,
    feed: initial,
    error: '',
  });
  const [notice, setNotice] = useState('');
  const id = useId();
  useEffect(() => {
    if (!configured || loadedKey.current === key) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    async function refresh() {
      try {
        const params = new URLSearchParams({ page: String(page) });
        if (platform) params.set('platform', platform);
        if (playstyle) params.set('playstyle', playstyle);
        const response = await fetch('/api/parties?' + params, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const data = await readJsonResponse<{ data: PartyFeedResponse }>(response);
        if (!controller.signal.aborted) {
          loadedKey.current = key;
          setResult({ key, feed: data.data, error: '' });
        }
      } catch (failure) {
        if (!disposed) {
          loadedKey.current = key;
          setResult({
            key,
            feed: null,
            error: controller.signal.aborted
              ? 'La consulta tardó demasiado. Intenta actualizar.'
              : failure instanceof Error
                ? failure.message
                : 'No se pudieron cargar las convocatorias.',
          });
        }
      } finally {
        clearTimeout(timeout);
      }
    }
    let disposed = false;
    void refresh();
    return () => {
      disposed = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [configured, key, page, platform, playstyle]);
  const loading = configured && result.key !== key;
  const feed = result.key === key ? result.feed : null;
  function resetFeed() {
    setPage(1);
    setRevision((value) => value + 1);
  }
  return (
    <section aria-labelledby={id + '-title'} aria-busy={loading}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">LOBBIES ABIERTOS // 48 HORAS</p>
          <h2 id={id + '-title'}>Compañeros de partida</h2>
        </div>
        {viewerId && configured ? (
          <PartyModal
            onCreated={() => {
              setPlatform('');
              setPlaystyle('');
              resetFeed();
              setNotice('Convocatoria publicada. ¡Tu escuadrón te espera!');
            }}
          />
        ) : (
          <Link className="button" href="/login?next=/forum?tab=arcade">
            Conecta para publicar
          </Link>
        )}
      </div>
      <div className="party-filters">
        <label htmlFor={id + '-platform'}>
          Plataforma
          <select
            id={id + '-platform'}
            value={platform}
            disabled={!configured}
            onChange={(event) => {
              setPlatform(event.target.value as PartyPlatform | '');
              setPage(1);
              setNotice('');
            }}
          >
            <option value="">Todas las plataformas</option>
            {PARTY_PLATFORMS.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label htmlFor={id + '-style'}>
          Estilo
          <select
            id={id + '-style'}
            value={playstyle}
            disabled={!configured}
            onChange={(event) => {
              setPlaystyle(event.target.value as PartyStyle | '');
              setPage(1);
              setNotice('');
            }}
          >
            <option value="">Todos los estilos</option>
            {PARTY_STYLES.map((value) => (
              <option key={value} value={value}>
                {PARTY_STYLE_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="button outline small"
          disabled={loading || !configured}
          onClick={() => setRevision((value) => value + 1)}
        >
          ↻ Actualizar
        </button>
      </div>
      {notice ? (
        <p role="status" className="notice">
          {notice}
        </p>
      ) : null}
      {loading ? (
        <p role="status" className="panel skeleton">
          Cargando convocatorias…
        </p>
      ) : null}
      {result.key === key && result.error ? (
        <p role="alert" className="error-text">
          {result.error}
        </p>
      ) : null}
      {feed ? (
        <PartyCards
          items={feed.items}
          generatedAt={feed.generatedAt}
          viewerId={viewerId}
          onRemoved={() => {
            resetFeed();
            setNotice('Convocatoria retirada.');
          }}
        />
      ) : null}
      <nav className="filter-buttons" aria-label="Páginas de convocatorias">
        <button
          type="button"
          className="button outline small"
          disabled={loading || page === 1}
          onClick={() => setPage((value) => value - 1)}
        >
          ← Anterior
        </button>
        <span aria-live="polite">Página {page}</span>
        <button
          type="button"
          className="button outline small"
          disabled={loading || !feed?.hasMore}
          onClick={() => setPage((value) => value + 1)}
        >
          Siguiente →
        </button>
      </nav>
    </section>
  );
}
