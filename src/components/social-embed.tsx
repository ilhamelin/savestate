'use client';
import { useEffect, useRef, useState } from 'react';
import { socialPost } from '@/domain/social-embed';
import { readJsonResponse } from '@/lib/api-response';

export function SocialEmbed({ url }: { url: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ url: string; html: string | null } | null>(null);
  const [frame, setFrame] = useState(false);
  const post = socialPost(url);
  useEffect(() => {
    const controller = new AbortController();
    let started = false;
    async function load() {
      if (started) return;
      started = true;
      try {
        const response = await fetch(`/api/embeds/oembed?${new URLSearchParams({ url })}`, {
          signal: controller.signal,
        });
        const data = await readJsonResponse<{ html: string }>(response);
        if (!controller.signal.aborted) setState({ url, html: data.html });
      } catch {
        if (!controller.signal.aborted) setState({ url, html: null });
      }
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void load();
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    if (root.current) observer.observe(root.current);
    return () => {
      observer.disconnect();
      controller.abort();
    };
  }, [url]);
  if (!post) return null;
  const ready = state?.url === url;
  const label = post.provider === 'twitter' ? 'X / Twitter' : 'Instagram';
  return (
    <div ref={root} className="social-embed panel">
      {!ready ? (
        <div role="status">
          <p className="muted">[ Descifrando transmisión de {label}… ]</p>
          <div className="skeleton skeleton-line" aria-hidden="true" />
          <div className="skeleton skeleton-line skeleton-short" aria-hidden="true" />
        </div>
      ) : null}
      {ready && state.html && !frame ? (
        <div className="markdown" dangerouslySetInnerHTML={{ __html: state.html }} />
      ) : null}
      {frame ? (
        <iframe
          className="social-embed-frame"
          src={post.frameUrl}
          title={`Publicación de ${label}`}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
        />
      ) : null}
      <div className="filter-buttons">
        <a className="accent" href={post.url} target="_blank" rel="noopener noreferrer">
          ↗ Ver publicación original en {label}
        </a>
        {!frame && ready ? (
          <button type="button" className="button outline small" onClick={() => setFrame(true)}>
            Cargar contenido interactivo
          </button>
        ) : null}
      </div>
      {ready && !state.html && !frame ? (
        <p className="muted">Publicación privada, eliminada o proveedor no disponible.</p>
      ) : null}
    </div>
  );
}
