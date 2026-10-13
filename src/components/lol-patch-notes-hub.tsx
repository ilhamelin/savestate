'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  LolPatchListItem,
  LolPatchDetail,
  PatchChampion,
  PatchMode,
  PatchSkin,
  SkinVideo,
} from '@/domain/lol-patch-notes';
import { readJsonResponse } from '@/lib/api-response';
export interface LolPatchIndex {
  patches: LolPatchListItem[];
  latestVersion: string | null;
  fetchedAt: string;
}
function PatchImage({
  src,
  alt = '',
  className = '',
  onClick,
}: {
  src: string | null;
  alt?: string;
  className?: string;
  onClick?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const image =
    src && !failed ? (
      <img
        src={src}
        alt={alt}
        className={className}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    ) : (
      <span className="patch-image-placeholder" aria-label={alt || 'Imagen no disponible'}>
        ◈
      </span>
    );
  return onClick ? (
    <button
      type="button"
      className="patch-image-button"
      onClick={onClick}
      aria-label="Ampliar resumen del parche"
    >
      {image}
    </button>
  ) : (
    image
  );
}
function Champions({ rows }: { rows: PatchChampion[] }) {
  return (
    <section className="patch-panel">
      <h3>Campeones</h3>
      {rows.length ? (
        rows.map((c) => (
          <article className="patch-champion" key={c.name}>
            <header>
              <PatchImage src={c.iconUrl} className="patch-champion-icon" />
              <h4>{c.name}</h4>
            </header>
            {c.summary ? <blockquote>{c.summary}</blockquote> : null}
            {c.abilities.map((a, i) => (
              <div className="patch-ability" key={i}>
                <h5>
                  {a.iconUrl ? <PatchImage src={a.iconUrl} className="patch-ability-icon" /> : null}
                  {a.title}
                </h5>
                <ul>
                  {a.changes.map((change, n) => (
                    <li key={n}>{change}</li>
                  ))}
                </ul>
              </div>
            ))}
          </article>
        ))
      ) : (
        <p className="muted">Este parche no incluye cambios de campeones en esta sección.</p>
      )}
    </section>
  );
}
function Mode({ mode, title }: { mode: PatchMode; title: string }) {
  return (
    <section className="patch-panel">
      <h3>{title}</h3>
      {mode.summary ? <blockquote>{mode.summary}</blockquote> : null}
      {mode.changes.map((group, i) => (
        <article className="patch-ability" key={i}>
          <h4>{group.title}</h4>
          <ul>
            {group.changes.map((c, n) => (
              <li key={n}>{c}</li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
function PatchMediaDialog({
  skin,
  image,
  onClose,
}: {
  skin: PatchSkin | null;
  image: string | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    [video, setVideo] = useState<SkinVideo | null>(null),
    [loading, setLoading] = useState(Boolean(skin));
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    const prior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const outside = (event: MouseEvent) => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (
        event.clientX < r.left ||
        event.clientX > r.right ||
        event.clientY < r.top ||
        event.clientY > r.bottom
      )
        onClose();
    };
    dialog.addEventListener('click', outside);
    return () => {
      dialog.removeEventListener('click', outside);
      dialog.close();
      document.body.style.overflow = prior;
    };
  }, [onClose]);
  useEffect(() => {
    if (!skin) return;
    const controller = new AbortController();
    void fetch('/api/lol-patches/skin-video?' + new URLSearchParams({ title: skin.title }), {
      signal: controller.signal,
    })
      .then((r) => readJsonResponse<SkinVideo>(r))
      .then((data) => {
        if (!controller.signal.aborted) setVideo(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [skin]);
  const search =
    video?.searchUrl ??
    'https://www.youtube.com/@SkinSpotlights/search?query=' +
      encodeURIComponent((skin?.title ?? '') + ' Skin Spotlight');
  return (
    <dialog
      ref={ref}
      className="patch-media-dialog"
      aria-labelledby="patch-dialog-title"
      onCancel={onClose}
    >
      <div className="patch-dialog-heading">
        <h3 id="patch-dialog-title">{skin?.title ?? 'Los platos fuertes de la versión'}</h3>
        <button type="button" className="button outline small" onClick={onClose}>
          ✕ Cerrar
        </button>
      </div>
      {loading ? (
        <p className="skeleton" role="status">
          Sintonizando @SkinSpotlights…
        </p>
      ) : null}
      {video?.embedUrl ? (
        <>
          <iframe
            src={video.embedUrl}
            title={video.videoTitle ?? 'Skin Spotlight'}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
          <p>{video.videoTitle}</p>
        </>
      ) : null}
      {!loading && skin && !video?.embedUrl ? (
        <p className="muted">
          No se pudo resolver un video disponible. Busca el aspecto en el canal oficial.
        </p>
      ) : null}
      <PatchImage src={skin?.imageUrl ?? image} className="patch-modal-art" />
      {skin ? (
        <div className="filter-buttons">
          {video?.youtubeUrl ? (
            <a
              className="button outline small"
              href={video.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              ↗ Abrir video
            </a>
          ) : null}
          <a
            className="button outline small"
            href={search}
            target="_blank"
            rel="noopener noreferrer"
          >
            ↗ Buscar en @SkinSpotlights
          </a>
        </div>
      ) : null}
    </dialog>
  );
}
export function LolPatchNotesHub({
  index,
  error,
  onRetry,
}: {
  index: LolPatchIndex | null;
  error: string;
  onRetry: () => void;
}) {
  const [patch, setPatch] = useState<LolPatchDetail | null>(null),
    [loading, setLoading] = useState(false),
    [detailError, setDetailError] = useState(''),
    [section, setSection] = useState('overview'),
    [skinPage, setSkinPage] = useState(0),
    [media, setMedia] = useState<{ skin: PatchSkin | null; image: string | null } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const closeMedia = useCallback(() => setMedia(null), []);
  useEffect(() => () => controller.current?.abort(), []);
  async function open(slug: string) {
    controller.current?.abort();
    const c = new AbortController();
    controller.current = c;
    setLoading(true);
    setDetailError('');
    try {
      const data = await readJsonResponse<{ patch: LolPatchDetail }>(
        await fetch('/api/lol-patches/' + encodeURIComponent(slug), { signal: c.signal }),
      );
      if (!c.signal.aborted) {
        setPatch(data.patch);
        setSection('overview');
        setSkinPage(0);
      }
    } catch (e) {
      if (!c.signal.aborted)
        setDetailError(e instanceof Error ? e.message : 'No se pudo cargar el parche.');
    } finally {
      if (!c.signal.aborted) setLoading(false);
    }
  }
  if (!index)
    return (
      <div className="patch-panel" role="status">
        {error ? (
          <>
            <p>{error}</p>
            <button className="button outline small" type="button" onClick={onRetry}>
              ↺ Reintentar
            </button>
          </>
        ) : (
          <div className="skeleton">Cargando parches oficiales de 2026…</div>
        )}
      </div>
    );
  const overview = section === 'overview',
    skinPages = Math.max(1, Math.ceil((patch?.skins.length ?? 0) / 4));
  // A focusable scroll region lets keyboard users read the complete corrections list.
  const bugs = patch ? (
    <section className="patch-panel">
      <h3>Corrección de errores y mejoras de calidad</h3>
      <div
        className="patch-bug-scroll"
        role="region"
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        aria-label="Lista de correcciones"
      >
        {patch.bugfixes.length ? (
          <ul>
            {patch.bugfixes.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">No hay correcciones en esta sección.</p>
        )}
      </div>
    </section>
  ) : null;
  const skins = patch ? (
    <section className="patch-panel">
      <h3>Próximos aspectos y chromas</h3>
      <div className="patch-skins-grid">
        {patch.skins.slice(skinPage * 4, (skinPage + 1) * 4).map((s) => (
          <button
            type="button"
            className="patch-skin-card"
            key={s.id}
            onClick={() => setMedia({ skin: s, image: null })}
          >
            <PatchImage src={s.imageUrl} />
            <strong>{s.title}</strong>
            <span>▶ Ver video Spotlight</span>
          </button>
        ))}
      </div>
      {!patch.skins.length ? <p className="muted">No hay aspectos en esta sección.</p> : null}
      {skinPages > 1 ? (
        <div className="filter-buttons">
          <button
            type="button"
            className="button outline small"
            disabled={skinPage === 0}
            onClick={() => setSkinPage((p) => p - 1)}
          >
            ← Anterior
          </button>
          <span aria-live="polite">
            {skinPage + 1} / {skinPages}
          </span>
          <button
            type="button"
            className="button outline small"
            disabled={skinPage >= skinPages - 1}
            onClick={() => setSkinPage((p) => p + 1)}
          >
            Siguiente →
          </button>
        </div>
      ) : null}
    </section>
  ) : null;
  return (
    <div className="lol-patch-hub" aria-busy={loading}>
      {detailError ? <p role="alert">{detailError}</p> : null}
      {loading ? (
        <p className="skeleton" role="status">
          Descifrando los cambios de Riot…
        </p>
      ) : null}
      {!patch ? (
        <div className="patch-index">
          <p className="muted">RIOT GAMES // ARCHIVO DE VERSIONES 2026</p>
          {index.patches.map((p, i) => (
            <article className="patch-index-row" key={p.id}>
              <PatchImage src={p.bannerUrl} />
              <div>
                <span className="patch-version">VERSIÓN {p.version}</span>
                {i === 0 ? <span className="patch-new">NUEVO</span> : null}
                <h3>{p.title}</h3>
                <time dateTime={p.publishedAt}>
                  {new Date(p.publishedAt).toLocaleDateString('es-CL', {
                    timeZone: 'America/Santiago',
                  })}
                </time>
                <p className="muted">{p.description}</p>
              </div>
              <button
                type="button"
                className="button outline small"
                disabled={loading}
                onClick={() => void open(p.id)}
              >
                Ver detalle ↗
              </button>
            </article>
          ))}
        </div>
      ) : (
        <>
          <div className="patch-nav">
            <button
              type="button"
              className="button outline small"
              onClick={() => {
                setPatch(null);
                setDetailError('');
              }}
            >
              ← Volver a parches 2026
            </button>
            <a href={patch.url} target="_blank" rel="noopener noreferrer">
              ↗ Nota oficial de Riot
            </a>
          </div>
          <h3>{patch.title}</h3>
          <div className="filter-buttons patch-tabs" role="group" aria-label="Secciones del parche">
            {[
              ['overview', 'Vista General'],
              ['champions', 'Campeones'],
              ...(patch.aramMayhem ? [['mayhem', 'ARAM: Caos']] : []),
              ...(patch.aram ? [['aram', 'ARAM']] : []),
              ['bugs', 'Corrección de errores y mejoras de calidad'],
              ['skins', 'Próximos aspectos y chromas'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={section === id}
                className={'button small ' + (section === id ? '' : 'outline')}
                onClick={() => setSection(id!)}
              >
                {label}
              </button>
            ))}
          </div>
          {overview ? (
            <div className="patch-dashboard">
              <div>
                <section className="patch-panel">
                  <h3>Los platos fuertes de la versión</h3>
                  <PatchImage
                    src={patch.highlightsImageUrl ?? patch.bannerUrl}
                    className="patch-highlights"
                    onClick={() =>
                      setMedia({ skin: null, image: patch.highlightsImageUrl ?? patch.bannerUrl })
                    }
                  />
                  <p>{patch.highlightsSummary || patch.description}</p>
                </section>
                <Champions rows={patch.champions} />
              </div>
              <aside>
                {bugs}
                {skins}
              </aside>
            </div>
          ) : section === 'champions' ? (
            <Champions rows={patch.champions} />
          ) : section === 'mayhem' && patch.aramMayhem ? (
            <Mode mode={patch.aramMayhem} title="ARAM: Caos" />
          ) : section === 'aram' && patch.aram ? (
            <Mode mode={patch.aram} title="ARAM" />
          ) : section === 'bugs' ? (
            bugs
          ) : (
            skins
          )}
        </>
      )}
      {media ? (
        <PatchMediaDialog skin={media.skin} image={media.image} onClose={closeMedia} />
      ) : null}
    </div>
  );
}
