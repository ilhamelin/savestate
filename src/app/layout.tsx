import type { Metadata, Viewport } from 'next';
import { Silkscreen, JetBrains_Mono } from 'next/font/google';
import { Header } from '@/components/header';
import Link from 'next/link';
import './globals.css';
const pixel = Silkscreen({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-pixel',
  display: 'swap',
});
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
export const metadata: Metadata = {
  title: { default: 'Savestate — Tu diario gamer', template: '%s | Savestate' },
  description: 'Explora videojuegos, registra tus partidas y comparte tu odisea gamer.',
  applicationName: 'SaveState',
  appleWebApp: { capable: true, title: 'SaveState', statusBarStyle: 'black-translucent' },
  other: { 'apple-mobile-web-app-capable': 'yes' },
  icons: {
    icon: '/icons/icon-192.png',
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#00f0ff',
};
export const dynamic = 'force-dynamic';
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${pixel.variable} ${mono.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          Saltar al contenido
        </a>
        <Header />
        <main id="main" className="container">
          {children}
        </main>
        <footer className="site-footer">
          <div className="footer-brand">
            <Link href="/" className="footer-logo">
              SAVE<span className="accent">STATE</span>
            </Link>
            <p className="muted">Tu diario de a bordo para cada partida, logro y colección.</p>
            <span className="footer-status">● SYSTEM ONLINE // V.2.6</span>
          </div>
          <div className="footer-links">
            <nav aria-label="Explorar desde el pie de página">
              <h2>Explorar</h2>
              <Link href="/explore">Catálogo</Link>
              <Link href="/library">Biblioteca</Link>
              <Link href="/lists">Listas</Link>
              <Link href="/highlights">Momentos</Link>
            </nav>
            <nav aria-label="Comunidad desde el pie de página">
              <h2>Comunidad</h2>
              <Link href="/feed">Transmisión</Link>
              <Link href="/forum">Foro</Link>
              <Link href="/chat">Chat Global</Link>
              <Link href="/players">Jugadores</Link>
            </nav>
          </div>
          <div className="footer-controls">
            <p>INSERT COIN · KEEP PLAYING</p>
            <a href="#main" className="button outline small">
              ↑ Volver arriba
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
