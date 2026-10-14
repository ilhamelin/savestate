import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import { ArrowUpRight, Gamepad2 } from 'lucide-react';
import { SetupNotice } from '@/components/setup-notice';
import { getRecentGamingNews } from '@/services/gaming-news';
import { RecentNewsSection } from '@/components/recent-news-section';
import { getActiveFreebies } from '@/services/freebies';
import { FreebiesTracker } from '@/components/freebies-tracker';
import { Gta6Countdown } from '@/components/gta6-countdown';
async function NewsStream() {
  return <RecentNewsSection news={await getRecentGamingNews()} />;
}
async function FreebiesStream() {
  return <FreebiesTracker freebies={await getActiveFreebies()} />;
}
export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="halloween-hero-chip">
            <Image src="/icons/halloween/calabaza.png" alt="" width={16} height={16} unoptimized />
            <span>SPOOKY CHECKPOINT // EDICIÓN NOCHE DE BRUJAS</span>
          </div>
          <h1 className="halloween-glow-text">
            CADA JUEGO.
            <br />
            CADA PARTIDA.
            <br />
            <span className="accent text-halloween-orange">TU HISTORIA EMBRUJADA.</span>
          </h1>
          <p className="hero-description">
            Tu diario de a bordo para una odisea gamer. Organiza lo que juegas, registra lo que
            completas y encuentra tu próximo checkpoint.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/explore">
              Explorar catálogo <ArrowUpRight size={18} />
            </Link>
            <Link className="text-link" href="/library">
              Abrir mi biblioteca →
            </Link>
          </div>
          <div className="hero-caption">DESDE LOS 8 BITS HASTA TU PRÓXIMA AVENTURA.</div>
        </div>
        <div className="hero-terminal" aria-label="Los seis estados de tu biblioteca">
          <Image
            src="/icons/halloween/telarana-de-halloween.png"
            alt=""
            width={56}
            height={56}
            className="corner-web pointer-events-none"
            unoptimized
          />
          <div className="terminal-bar">
            <span>savestate://player/logbook</span>
            <span className="accent">● ONLINE JOURNAL</span>
          </div>
          <div className="terminal-art" aria-hidden="true">
            <div className="pixel-orbit" />
            <Gamepad2 strokeWidth={1} size={110} />
            <span className="art-label">
              SAVE YOUR
              <br />
              <strong>PROGRESS</strong>
            </span>
          </div>
          <div className="terminal-bottom">
            <span className="muted">$ choose_your_state</span>
            <div className="status-grid">
              {['Playing', 'Backlog', 'Cleared', '100% / Platinum', 'Dropped', 'Wishlist'].map(
                (label, i) => (
                  <span key={label} className={`state-${i}`}>
                    [{label}]
                  </span>
                ),
              )}
            </div>
            <p className="muted">
              Un checkpoint. Todas tus rejugadas.
              <span className="cursor" />
            </p>
          </div>
        </div>
      </section>
      <SetupNotice />
      <Gta6Countdown />
      <Suspense
        fallback={
          <div className="panel skeleton" aria-busy="true">
            Cargando noticias…
          </div>
        }
      >
        <NewsStream />
      </Suspense>
      <Suspense
        fallback={
          <div className="panel skeleton" aria-busy="true">
            Cargando juegos gratis…
          </div>
        }
      >
        <FreebiesStream />
      </Suspense>
    </>
  );
}
