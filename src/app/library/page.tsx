import { currentUser } from '@/lib/session';
import { isConfigured } from '@/lib/env';
import { SetupNotice } from '@/components/setup-notice';
import { libraryFor } from '@/repositories/player';
import { Library } from '@/components/library';
import { redirect } from 'next/navigation';
import Link from 'next/link';
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
  const library = await libraryFor(user.id);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PLAYER LIBRARY / {library.count} JUEGOS</p>
          <h1>Tu colección de checkpoints.</h1>
          <p>Cada estado tiene una historia. Guarda la tuya.</p>
        </div>
      </div>
      {library.count > 500 ? (
        <p className="notice">Se muestran los 500 juegos actualizados más recientemente.</p>
      ) : null}
      <p>
        <Link className="button secondary" href="/library/import">
          Importar biblioteca de Steam →
        </Link>
      </p>
      <Library {...library} editable />
    </>
  );
}
