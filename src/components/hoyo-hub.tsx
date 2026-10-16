'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Check,
  Copy,
  ExternalLink,
  Maximize2,
  Minimize2,
  Radio,
  Sparkles,
  Ticket,
  CalendarDays,
  Map as MapIcon,
  Trophy,
  ShieldCheck,
} from 'lucide-react';
import {
  HOYO_GAMES,
  hoyoGame,
  hoyoCodeExpired,
  hoyoVersionInNews,
  buildHoyoFrameUrl,
  buildHoyoRedeemUrl,
  type HoyoGame,
  type HoyoNewsItem,
  type HoyoNewsCategory,
  HOYO_QUICK_TOOLS,
  HOYO_CLAIMED_CODES_KEY,
  hoyoClaimedCodeKey,
  parseHoyoClaimedCodes,
  filterHoyoNews,
} from '@/domain/hoyo-hub';
import { soundFx } from '@/lib/sound';
import { HoyoVersionCountdown } from '@/components/hoyo-version-countdown';

const subscribeHost = () => () => {};
const hostSnapshot = () => window.location.hostname;
const serverHost = () => '';
const TOOL_ICONS = { calendar: CalendarDays, map: MapIcon, shield: ShieldCheck, trophy: Trophy };
function newsDate(value: string) {
  return value
    ? new Intl.DateTimeFormat('es-CL', {
        timeZone: 'America/Santiago',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(value))
    : 'Fecha no disponible';
}
export function HoyoHub({ initialNews }: { initialNews: Record<HoyoGame, HoyoNewsItem[]> }) {
  const router = useRouter(),
    params = useSearchParams();
  const activeGame = hoyoGame(params.get('game'));
  const config = HOYO_GAMES[activeGame],
    news = initialNews[activeGame];
  const version = hoyoVersionInNews(news);
  const [selectedCategory, setSelectedCategory] = useState<HoyoNewsCategory>('todas');
  const visibleNews = filterHoyoNews(news, selectedCategory);
  const [claimedCodes, setClaimedCodes] = useState<Set<string>>(() => new Set());
  const [claimsLoaded, setClaimsLoaded] = useState(false);
  const [claimNotice, setClaimNotice] = useState('');
  const hostname = useSyncExternalStore(subscribeHost, hostSnapshot, serverHost);
  const [platform, setPlatform] = useState<'twitch' | 'youtube'>('twitch');
  const [cinemaMode, setCinemaMode] = useState(false);
  const [copied, setCopied] = useState<string | null>(null),
    [copyError, setCopyError] = useState('');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const cinemaButton = useRef<HTMLButtonElement>(null);
  const frameUrl = buildHoyoFrameUrl(activeGame, platform, hostname);
  const streamLink =
    platform === 'twitch'
      ? `https://www.twitch.tv/${config.twitchChannel}`
      : `https://www.youtube.com/${config.youtubeChannel}/live`;
  useEffect(() => {
    const initial = window.setTimeout(() => {
      try {
        setClaimedCodes(parseHoyoClaimedCodes(window.localStorage.getItem(HOYO_CLAIMED_CODES_KEY)));
      } catch {
        /* Preferences remain usable without persistent storage. */
      }
      setClaimsLoaded(true);
    }, 0);
    function onStorage(event: StorageEvent) {
      if (event.key === HOYO_CLAIMED_CODES_KEY || event.key === null)
        setClaimedCodes(parseHoyoClaimedCodes(event.newValue));
    }
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearTimeout(initial);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  function toggleClaimed(code: string) {
    if (!claimsLoaded) return;
    const key = hoyoClaimedCodeKey(activeGame, code),
      next = new Set(claimedCodes);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setClaimedCodes(next);
    try {
      window.localStorage.setItem(HOYO_CLAIMED_CODES_KEY, JSON.stringify([...next]));
      setClaimNotice('Preferencia de canje guardada en este navegador.');
    } catch {
      setClaimNotice('Preferencia aplicada en esta sesión; el navegador no permite guardarla.');
    }
  }
  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (!cinemaMode) return;
    const node = dialog.current;
    node?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      if (node?.open) node.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [cinemaMode]);
  function switchGame(game: HoyoGame) {
    soundFx.click();
    setSelectedCategory('todas');
    const next = new URLSearchParams(params.toString());
    next.set('game', game);
    router.replace(`/hoyo?${next}`, { scroll: false });
  }
  async function copyCode(code: string) {
    setCopyError('');
    try {
      await navigator.clipboard.writeText(code);
      soundFx.click();
      setCopied(code);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopyError('No se pudo copiar. Selecciona el código y cópialo manualmente.');
    }
  }
  function closeCinema() {
    setCinemaMode(false);
  }
  function player(expanded: boolean) {
    return (
      <section
        className={`hoyo-player-container${expanded ? ' is-cinema' : ''}`}
        aria-labelledby={expanded ? 'hoyo-cinema-title' : 'hoyo-player-title'}
      >
        <div className="hoyo-player-header">
          <div>
            <p className="eyebrow">
              <Radio size={14} aria-hidden="true" /> FRECUENCIA OFICIAL
            </p>
            <h2 id={expanded ? 'hoyo-cinema-title' : 'hoyo-player-title'}>
              Programa especial / Directo
            </h2>
          </div>
          <button
            ref={expanded ? undefined : cinemaButton}
            type="button"
            className="hoyo-copy-btn"
            aria-label={expanded ? 'Salir del modo cine' : 'Abrir modo cine'}
            onClick={() => setCinemaMode(!expanded)}
          >
            {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span>{expanded ? 'Cerrar cine' : 'Modo cine'}</span>
          </button>
        </div>
        <div className="hoyo-stream-controls" aria-label="Fuente del directo">
          {(['twitch', 'youtube'] as const).map((source) => (
            <button
              key={source}
              type="button"
              className="hoyo-copy-btn"
              aria-pressed={platform === source}
              onClick={() => setPlatform(source)}
            >
              {source === 'twitch' ? 'Twitch' : 'YouTube'}
            </button>
          ))}
          <a
            href={streamLink}
            target="_blank"
            rel="noopener noreferrer"
            className="hoyo-external-link"
          >
            Abrir canal <ExternalLink size={14} />
          </a>
        </div>
        <div className="hoyo-player-iframe-box">
          {frameUrl ? (
            <iframe
              key={`${activeGame}-${platform}`}
              src={frameUrl}
              title={`Directo oficial de ${config.title} en ${platform}`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : (
            <p className="muted" aria-live="polite">
              Preparando el reproductor…
            </p>
          )}
        </div>
        <p className="hoyo-player-help muted">
          La señal depende del horario del canal. Si no hay emisión o la incrustación no está
          disponible, abre el canal oficial. {expanded && 'Pulsa Escape para salir.'}
        </p>
      </section>
    );
  }
  return (
    <div
      className="hoyo-root"
      data-game={activeGame}
      style={{ '--hoyo-accent': config.accentColor } as React.CSSProperties}
    >
      <section className="hoyo-hero">
        <Image
          src={config.wallpaper}
          alt=""
          fill
          priority
          sizes="(max-width: 1200px) 100vw, 1200px"
          className="hoyo-hero-bg"
        />
        <div className="hoyo-hero-content">
          <p className="eyebrow">
            <Sparkles size={14} aria-hidden="true" /> HOYO HUB // COMUNICACIONES OFICIALES
          </p>
          <h1>
            <Image src={config.icon} alt="" width={40} height={40} unoptimized />
            {config.title}
          </h1>
          <p className="muted">{config.subtitle}</p>
          <p className="hoyo-version-note">
            {version
              ? `Última versión mencionada en los anuncios: ${version}`
              : 'Consulta la versión y el próximo programa en los anuncios oficiales.'}
          </p>
          <div className="hoyo-game-selector" aria-label="Juego de HoYo Hub">
            {(['genshin', 'hsr'] as const).map((game) => (
              <button
                type="button"
                key={game}
                className="hoyo-tab-btn"
                data-active={activeGame === game}
                data-game={game}
                aria-pressed={activeGame === game}
                onClick={() => switchGame(game)}
              >
                <Image src={HOYO_GAMES[game].icon} alt="" width={22} height={22} unoptimized />
                {HOYO_GAMES[game].title}
              </button>
            ))}
          </div>
        </div>
      </section>
      <HoyoVersionCountdown game={activeGame} />
      <section aria-labelledby="hoyo-tools-title">
        <h2 id="hoyo-tools-title">Herramientas diarias</h2>
        <div className="hoyo-tools-grid">
          {HOYO_QUICK_TOOLS[activeGame].map((tool) => {
            const Icon = TOOL_ICONS[tool.iconName];
            const content = (
              <>
                <Icon size={24} aria-hidden="true" />
                <span>
                  <strong>{tool.label}</strong>
                  <small className="muted">{tool.description}</small>
                </span>
                {tool.url.startsWith('https:') && <ExternalLink size={14} aria-hidden="true" />}
              </>
            );
            return tool.url.startsWith('/') ? (
              <Link key={tool.id} className="hoyo-tool-item" href={tool.url}>
                {content}
              </Link>
            ) : (
              <a
                key={tool.id}
                className="hoyo-tool-item"
                href={tool.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {content}
              </a>
            );
          })}
        </div>
      </section>
      <div className="hoyo-grid">
        {!cinemaMode ? (
          player(false)
        ) : (
          <div className="hoyo-player-placeholder muted">Reproductor abierto en modo cine.</div>
        )}
        <aside className="hoyo-codes-card" aria-labelledby="hoyo-codes-title">
          <div>
            <p className="eyebrow">
              <Ticket size={14} aria-hidden="true" /> RECOMPENSAS // CANJE OFICIAL
            </p>
            <h2 id="hoyo-codes-title">Códigos de recompensa</h2>
            <p className="muted">
              {activeGame === 'genshin' ? 'Protogemas' : 'Jades estelares'} y materiales para tu
              próxima aventura.
            </p>
          </div>
          {config.featuredCodes.map((code) => {
            const expired = hoyoCodeExpired(code);
            const claimed = claimedCodes.has(hoyoClaimedCodeKey(activeGame, code.code));
            return (
              <article
                key={code.code}
                className={`hoyo-code-item${expired ? ' is-expired' : ''}${claimed ? ' hoyo-code-claimed' : ''}`}
              >
                <div className="hoyo-code-header">
                  <code className="hoyo-code-text">{code.code}</code>
                  <span className="hoyo-tag">{expired ? 'Caducado' : 'Código de referencia'}</span>
                </div>
                <p className="muted">{code.rewards}</p>
                <div className="hoyo-code-actions">
                  <button
                    type="button"
                    className="hoyo-copy-btn"
                    aria-pressed={claimed}
                    disabled={!claimsLoaded}
                    title={claimed ? 'Desmarcar como canjeado' : 'Marcar como canjeado'}
                    onClick={() => toggleClaimed(code.code)}
                  >
                    {claimed ? '✓ Canjeado' : 'Ya lo canjeé'}
                  </button>
                  <button
                    type="button"
                    className="hoyo-copy-btn"
                    disabled={expired}
                    onClick={() => void copyCode(code.code)}
                  >
                    {copied === code.code ? <Check size={14} /> : <Copy size={14} />}{' '}
                    {copied === code.code ? '¡Copiado!' : 'Copiar'}
                  </button>
                  {!expired && (
                    <a
                      className="hoyo-copy-btn"
                      href={buildHoyoRedeemUrl(activeGame, code.code)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Canjear <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
          <p className="hoyo-code-help muted">
            Vigencia por confirmar: el sitio oficial valida la disponibilidad y si tu cuenta ya usó
            el código. Los códigos temporales de programas especiales deben consultarse en sus
            anuncios; no se garantiza un pack activo de 300 recompensas.
          </p>
          <p role="status" className="hoyo-copy-status">
            {copyError || (copied ? `Código ${copied} copiado` : '')}
          </p>
          <Link href={`/rift?game=${config.enkaUrlSlug}`} className="button outline small">
            Ver mi vitrina en Rift ↗
          </Link>
          <p role="status" className="hoyo-claim-status muted">
            {claimNotice}
          </p>
        </aside>
      </div>
      <section className="hoyo-news-section" aria-labelledby="hoyo-news-title">
        <div className="hoyo-news-header">
          <div>
            <p className="eyebrow">HOYOLAB // FEED EN ESPAÑOL</p>
            <h2 id="hoyo-news-title">Notas de parche y anuncios oficiales</h2>
          </div>
          <a
            href={`https://www.hoyolab.com/home?game_id=${activeGame === 'genshin' ? 2 : 6}`}
            className="hoyo-external-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            HoYoLAB <ExternalLink size={14} />
          </a>
        </div>
        <div className="hoyo-filter-bar" aria-label="Filtrar noticias">
          {(
            [
              ['todas', 'Todas'],
              ['actualizacion', 'Actualizaciones'],
              ['evento', 'Eventos'],
              ['aviso', 'Avisos'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="hoyo-filter-btn"
              data-active={selectedCategory === id}
              aria-pressed={selectedCategory === id}
              onClick={() => setSelectedCategory(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {visibleNews.length ? (
          <div className="hoyo-news-grid">
            {visibleNews.map((item) => (
              <a
                key={item.id}
                href={item.postUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hoyo-news-card"
              >
                <div className="hoyo-news-thumb">
                  {item.coverUrl ? (
                    <Image
                      src={item.coverUrl}
                      alt=""
                      width={640}
                      height={360}
                      unoptimized
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Image
                      src={config.icon}
                      alt=""
                      width={48}
                      height={48}
                      unoptimized
                      className="hoyo-news-placeholder"
                    />
                  )}
                </div>
                <div className="hoyo-news-body">
                  <div className="hoyo-news-meta">
                    <span className={`hoyo-tag tag-${item.category}`}>
                      {item.category === 'actualizacion'
                        ? 'Actualización'
                        : item.category === 'evento'
                          ? 'Evento'
                          : 'Aviso'}
                    </span>
                    <time dateTime={item.publishedAt || undefined}>
                      {newsDate(item.publishedAt)}
                    </time>
                  </div>
                  <h3>{item.title}</h3>
                  {item.summary && <p className="muted">{item.summary}</p>}
                  <span className="hoyo-read-more">Leer en HoYoLAB ↗</span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="panel hoyo-news-empty">
            <p>
              {news.length
                ? 'No hay noticias de esta categoría.'
                : `No fue posible cargar las comunicaciones de ${config.title} en este momento.`}
            </p>
            <p className="muted">
              {news.length
                ? 'Prueba otra categoría para ver más noticias.'
                : 'Puedes abrir HoYoLAB desde el enlace superior.'}
            </p>
          </div>
        )}
      </section>
      <p className="hoyo-attribution muted">
        SaveState es un sitio independiente. Genshin Impact, Honkai: Star Rail y sus recursos
        pertenecen a HoYoverse. Noticias y transmisiones enlazan a sus canales oficiales.
      </p>
      <dialog
        ref={dialog}
        className="hoyo-cinema-dialog"
        aria-label={`Directo de ${config.title} · Modo cine`}
        onCancel={closeCinema}
        onClose={() => {
          closeCinema();
          requestAnimationFrame(() => cinemaButton.current?.focus());
        }}
        closedby="any"
      >
        {cinemaMode && player(true)}
      </dialog>
    </div>
  );
}
