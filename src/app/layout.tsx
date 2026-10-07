import type { Metadata } from 'next';
import { Silkscreen, JetBrains_Mono } from 'next/font/google';
import { Header } from '@/components/header';
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
          <span>
            SAVESTATE <span className="muted">{'// EL PROGRESO ES PERSONAL.'}</span>
          </span>
          <span className="muted">INSERT COIN. KEEP PLAYING.</span>
        </footer>
      </body>
    </html>
  );
}
