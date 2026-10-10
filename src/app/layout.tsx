import type { Metadata, Viewport } from 'next';
import { Silkscreen, JetBrains_Mono } from 'next/font/google';
import { Header } from '@/components/header';
import { VoiceProvider } from '@/contexts/voice-context';
import { VoiceDock } from '@/components/voice-dock';
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
        <VoiceProvider>
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
          <VoiceDock />
        </VoiceProvider>
      </body>
    </html>
  );
}
