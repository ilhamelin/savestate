import { currentUser } from '@/lib/session';
import { redirect } from 'next/navigation';
import { ImportHub } from '@/components/import-hub';
import { serverClient } from '@/integrations/supabase/server';
import { dbCheck } from '@/lib/http';
export const metadata = { title: 'Importar biblioteca' };
export default async function SteamImportPage() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/library/import');
  const result = await (
    await serverClient()
  )
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  dbCheck(result.error);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">LIBRARY TRANSFER / MULTIPLATAFORMA</p>
          <h1>Importa tus checkpoints.</h1>
        </div>
      </div>
      <ImportHub
        steamConfigured={Boolean(process.env.STEAM_API_KEY)}
        psnId={result.data?.psn_id ?? null}
        xboxGamertag={result.data?.xbox_gamertag ?? null}
      />
    </>
  );
}
