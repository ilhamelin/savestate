import { redirect } from 'next/navigation';
import { currentUser, currentAdmin } from '@/lib/session';
import { GuardianConsole } from '@/components/guardian/guardian-console';
export const metadata = {
  title: 'SaveState Guardian',
  manifest: '/guardian-assets/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Guardian', statusBarStyle: 'black-translucent' as const },
  robots: { index: false, follow: false },
};
export default async function GuardianPage() {
  if (!(await currentUser())) redirect('/login?next=/guardian');
  const admin = await currentAdmin();
  if (!admin)
    return (
      <section className="panel">
        <h1>Acceso restringido</h1>
        <p>Esta consola está reservada al operador supremo.</p>
      </section>
    );
  return <GuardianConsole username={admin.username} adminId={admin.id} />;
}
