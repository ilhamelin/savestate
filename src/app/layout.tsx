import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Silkscreen, JetBrains_Mono } from 'next/font/google';
import { Header } from '@/components/header';
import { HalloweenBats } from '@/components/halloween/halloween-bats';
import Image from 'next/image';
import Link from 'next/link';
import { SystemBroadcastBanner } from '@/components/system-broadcast-banner';
import { getActiveSystemBroadcast, getSystemSwitches } from '@/services/system-state';
import { currentUser } from '@/lib/session';
import { OperatorSignalsListener } from '@/components/operator-signals-listener';
import { effectiveSeasonalTheme } from '@/domain/seasonal-theme';
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
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = (await headers()).get('x-pathname') ?? '';
  const userPromise = currentUser();
  const standalone =
    pathname === '/gatekeeper' || pathname === '/guardian' || pathname.startsWith('/guardian/');
  const [switches, broadcast] = standalone
    ? [null, null]
    : await Promise.all([
        getSystemSwitches().catch(() => null),
        getActiveSystemBroadcast().catch(() => null),
      ]);
  const user = await userPromise;
  const seasonalTheme = effectiveSeasonalTheme(switches?.seasonal_theme);
  const isHalloween = seasonalTheme === 'halloween';
  return (
    <html
      lang="es"
      data-seasonal-theme={seasonalTheme}
      data-double-xp={switches?.double_xp ? 'true' : 'false'}
      className={`${pixel.variable} ${mono.variable}`}
    >
      <body>
        <OperatorSignalsListener userId={user?.id ?? null} />
        {standalone ? (
          <main id="main" className="guardian-standalone-main">
            {children}
          </main>
        ) : (
          <>
            {isHalloween && <HalloweenBats />}
            <a href="#main" className="skip-link">
              Saltar al contenido
            </a>
            <SystemBroadcastBanner
              initial={broadcast}
              initialDoubleXp={switches?.double_xp ?? false}
            />
            <Header />
            <main id="main" className="container">
              {children}
            </main>
            <footer className="site-footer">
              <div className="footer-brand">
                <Link href="/" className="footer-logo">
                  SAVE<span className="accent text-halloween-orange">STATE</span>
                </Link>
                <p className="muted">Tu diario de a bordo para cada partida, logro y colección.</p>
                <span className="footer-status">● SYSTEM ONLINE // V.3.0 FINAL</span>
              </div>
              <div className="footer-links">
                <nav aria-label="Explorar desde el pie de página">
                  <h2>Explorar</h2>
                  <Link href="/explore">Catálogo</Link>
                  <Link href="/screen">Screen (Cine y Series)</Link>
                  <Link href="/hoyo">HoYo Hub</Link>
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
                <nav aria-label="Legal y Privacidad">
                  <h2>Legal</h2>
                  <Link href="/terms">Términos de Servicio</Link>
                  <Link href="/privacy">Política de Privacidad</Link>
                </nav>
              </div>
              <div className="footer-controls">
                <div className="halloween-footer-motto">
                  {isHalloween && (
                    <Image
                      src="/icons/halloween/calabaza.png"
                      alt=""
                      width={32}
                      height={32}
                      className="brand-halloween-pumpkin footer-halloween-pumpkin"
                      unoptimized
                    />
                  )}
                  <p>INSERT COIN · KEEP PLAYING</p>
                  {isHalloween && (
                    <Image
                      src="/icons/halloween/calabaza.png"
                      alt=""
                      width={32}
                      height={32}
                      className="brand-halloween-pumpkin footer-halloween-pumpkin"
                      unoptimized
                    />
                  )}
                </div>
                <a href="#main" className="button outline small">
                  ↑ Volver arriba
                </a>
              </div>
              <div className="footer-legal-bar">
                <p className="footer-disclaimer">
                  SaveState isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or
                  opinions of Riot Games or anyone officially involved in producing or managing Riot
                  Games properties. Riot Games and all associated properties are trademarks or
                  registered trademarks of Riot Games, Inc.
                </p>
                <p className="footer-disclaimer">
                  Steam y el logotipo de Steam son marcas comerciales y/o registradas de Valve
                  Corporation en EE. UU. y otros países. SaveState no está afiliado, respaldado ni
                  patrocinado por Valve Corporation. Todas las marcas registradas, logos, carátulas
                  y nombres de franquicias (incluyendo Nintendo, PlayStation, Xbox,
                  Take-Two/Rockstar Games y Disney/Marvel) pertenecen a sus respectivos dueños. Se
                  muestran con fines informativos de identificación nominativa, sujetos a sus
                  licencias y a los límites del uso legítimo (Fair Use) que resulten aplicables.
                </p>
                <div className="footer-legal-links">
                  <Link href="/terms">Términos y Safe Harbor (DMCA / Ley 20.435)</Link>
                  <span aria-hidden="true">·</span>
                  <Link href="/privacy">Política de Privacidad (Ley 19.628 / 21.719)</Link>
                </div>
              </div>
            </footer>
          </>
        )}
      </body>
    </html>
  );
}
