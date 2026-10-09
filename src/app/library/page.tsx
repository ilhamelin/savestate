import { currentUser } from '@/lib/session';
import { isConfigured } from '@/lib/env';
import { SetupNotice } from '@/components/setup-notice';
import { libraryFor, libraryHoursFor } from '@/repositories/player';
import { NumberTicker } from '@/components/ui/number-ticker';
import { Library } from '@/components/library';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SteamQuickSync } from '@/components/steam-quick-sync';
import { steamSyncStatus } from '@/services/steam-sync';
export const metadata = { title: 'Mi biblioteca' };
export default async function LibraryPage() {
  if (!isConfigured())
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">PLAYER LIBRARY</p>
            <h1>Tu colección de checkpoints.</h1>
          </div>
        </div>
        <SetupNotice />
      </>
    );
  const user = await currentUser();
  if (!user) redirect('/login?next=/library');
  const [library, totalHours, steamState] = await Promise.all([
    libraryFor(user.id),
    libraryHoursFor(user.id),
    steamSyncStatus(),
  ]);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PLAYER LIBRARY / {library.count} JUEGOS</p>
          <h1>Tu colección de checkpoints.</h1>
          <p>Cada estado tiene una historia. Guarda la tuya.</p>
          <p className="accent">
            <NumberTicker value={totalHours} decimals={1} /> h acumuladas en tus partidas
          </p>
        </div>
      </div>
      {library.count > 500 ? (
        <p className="notice">Se muestran los 500 juegos actualizados más recientemente.</p>
      ) : null}
      <p>
        <Link className="button secondary" href="/library/import">
          Importar biblioteca: Steam, PSN o Xbox →
        </Link>
      </p>
      <SteamQuickSync initial={steamState} />
      <Library {...library} editable />
    </>
  );
}
