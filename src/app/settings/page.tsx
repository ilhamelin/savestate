import { currentUser } from '@/lib/session';
import { serverClient } from '@/integrations/supabase/server';
import { isConfigured } from '@/lib/env';
import { SetupNotice } from '@/components/setup-notice';
import { Settings } from '@/components/settings';
import { SocialControls } from '@/components/social-controls';
import { dbCheck } from '@/lib/http';
import { redirect } from 'next/navigation';
import Link from 'next/link';
export const metadata = { title: 'Ajustes del jugador' };
export default async function SettingsPage() {
  if (!isConfigured()) return <SetupNotice />;
  const user = await currentUser();
  if (!user) redirect('/login?next=/settings');
  const db = await serverClient();
  const [profileResult, friendsResult] = await Promise.all([
    db.from('profiles').select('*').eq('id', user.id).single(),
    db
      .from('friendships')
      .select('*')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false }),
  ]);
  dbCheck(profileResult.error);
  dbCheck(friendsResult.error);
  if (!profileResult.data) throw new Error('No se encontró el perfil.');
  const friends = friendsResult.data ?? [];
  const ids = friends.map((f) => (f.sender_id === user.id ? f.receiver_id : f.sender_id));
  const { data: players, error } = ids.length
    ? await db.from('profiles').select('*').in('id', ids)
    : { data: [], error: null };
  dbCheck(error);
  const { data: claims } = await db.auth.getClaims();
  const moderator = ['admin', 'moderator'].includes(claims?.claims.app_metadata?.role);
  return (
    <div className="narrow">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PLAYER CONFIGURATION</p>
          <h1>Ajusta tu checkpoint.</h1>
        </div>
      </div>
      <Settings key={profileResult.data.username} profile={profileResult.data} />
      <section className="panel">
        <h2>Biblioteca de Steam</h2>
        <p>Revisa títulos y horas antes de añadirlos a SaveState.</p>
        <Link className="button secondary" href="/library/import">
          Importar desde Steam →
        </Link>
      </section>
      <section className="panel">
        <h2>Amistades y solicitudes</h2>
        {friends.map((friend) => {
          const target = friend.sender_id === user.id ? friend.receiver_id : friend.sender_id;
          const name = players?.find((p) => p.id === target)?.username ?? 'Jugador';
          return (
            <div className="player-row" key={friend.id}>
              <Link className="accent" href={`/players/${name}`}>
                @{name} ·{' '}
                {friend.status === 'pending'
                  ? 'Pendiente'
                  : friend.status === 'accepted'
                    ? 'Amigos'
                    : 'Rechazada'}
              </Link>
              <SocialControls
                targetId={target}
                viewerId={user.id}
                following={false}
                friendship={friend}
              />
            </div>
          );
        })}
        {!friends.length ? (
          <Link className="accent" href="/players">
            Busca jugadores para formar tu grupo →
          </Link>
        ) : null}
      </section>
      <Link className="button secondary" href="/notifications">
        Notificaciones
      </Link>
      {moderator ? (
        <Link className="button secondary" href="/moderation">
          Moderación
        </Link>
      ) : null}
    </div>
  );
}
