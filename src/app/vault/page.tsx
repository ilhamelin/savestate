import { redirect } from 'next/navigation';
import { currentViewerProfile } from '@/lib/session';
export const metadata = { title: 'Bóveda // Memory Card' };
export default async function VaultPage() {
  const profile = await currentViewerProfile();
  if (!profile?.username) redirect('/login?next=/vault');
  redirect(`/players/${encodeURIComponent(profile.username)}#player-vault`);
}
