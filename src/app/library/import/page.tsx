import { currentUser } from '@/lib/session';
import { redirect } from 'next/navigation';
import { SteamImporter } from '@/components/steam-importer';
export const metadata = { title: 'Importar desde Steam' };
export default async function SteamImportPage() {
  if (!(await currentUser())) redirect('/login?next=/library/import');
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">LIBRARY TRANSFER / STEAM</p>
          <h1>Importa tus checkpoints.</h1>
        </div>
      </div>
      <SteamImporter configured={Boolean(process.env.STEAM_API_KEY)} />
    </>
  );
}
