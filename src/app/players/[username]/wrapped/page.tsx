import Link from 'next/link';
import { notFound } from 'next/navigation';
import { profileByName } from '@/repositories/player';
import { playerWrapped } from '@/services/wrapped';
import { wrappedYear } from '@/domain/wrapped';
import { WrappedView } from '@/components/wrapped-view';
import { isConfigured } from '@/lib/env';
import { SetupNotice } from '@/components/setup-notice';
export const metadata = { title: 'SaveState Wrapped' };
export default async function WrappedPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  if (!isConfigured()) return <SetupNotice />;
  const { username } = await params;
  if (!/^[A-Za-z0-9_]{3,30}$/.test(username)) notFound();
  const profile = await profileByName(username);
  if (!profile) notFound();
  let year: number;
  try {
    year = wrappedYear((await searchParams).year);
  } catch {
    return (
      <section className="panel">
        <h1>Año inválido.</h1>
        <Link href={`/players/${profile.username}/wrapped`}>Ver el año actual →</Link>
      </section>
    );
  }
  const summary = await playerWrapped(profile.id, year);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR YEAR / YOUR SAVE FILE</p>
          <h1>SaveState Wrapped.</h1>
          <Link href={`/players/${profile.username}`}>← Perfil de @{profile.username}</Link>
        </div>
        <form method="get">
          <label>
            Año del resumen
            <input
              name="year"
              type="number"
              min={2000}
              max={new Date().getUTCFullYear()}
              defaultValue={year}
              required
            />
          </label>
          <button className="button secondary">Ver año</button>
        </form>
      </div>
      {summary ? (
        <WrappedView summary={summary} username={profile.username} userId={profile.id} />
      ) : (
        <section className="empty-state">
          <h2>Resumen visible solo para amigos.</h2>
          <p>El resumen respeta la privacidad de la biblioteca.</p>
        </section>
      )}
    </>
  );
}
