import Link from 'next/link';
import { ArrowUpRight, Library, NotebookPen, Users, Gamepad2 } from 'lucide-react';
import { SetupNotice } from '@/components/setup-notice';
export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" /> PLAYER JOURNAL / V.01
          </p>
          <h1>
            Cada juego.
            <br />
            Cada partida.
            <br />
            <span className="accent">Tu historia.</span>
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
      <section className="intro-strip">
        <div>
          <p className="eyebrow">TU PARTIDA, TUS REGLAS</p>
          <h2>Más que una lista de juegos.</h2>
        </div>
        <span className="muted">01 — 03 / PLAYER TOOLS</span>
      </section>
      <section className="feature-grid">
        {[
          {
            icon: Library,
            n: '01',
            title: 'Tu biblioteca',
            text: 'Seis estados para ordenar tus aventuras. Cuatro favoritos para contar quién eres.',
            href: '/library',
          },
          {
            icon: NotebookPen,
            n: '02',
            title: 'Tu diario',
            text: 'Cada rejugada tiene su historia: plataforma, horas, fechas y una nota que evoluciona contigo.',
            href: '/explore',
          },
          {
            icon: Users,
            n: '03',
            title: 'Tu comunidad',
            text: 'Sigue la actividad pública de otros jugadores y comparte tu biblioteca con tus amigos.',
            href: '/players',
          },
        ].map((item) => (
          <Link href={item.href} key={item.n} className="feature-panel">
            <div className="feature-top">
              <item.icon size={24} />
              <span>{item.n}</span>
            </div>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
            <span className="card-link">
              Entrar <ArrowUpRight size={14} />
            </span>
          </Link>
        ))}
      </section>
    </>
  );
}
