import Link from 'next/link';
import { Gamepad2, ArrowUpRight } from 'lucide-react';
import { CommandMenu } from '@/components/command-menu';
import { NotificationBell } from '@/components/notification-bell';
import { currentUser } from '@/lib/session';
import { serverClient } from '@/integrations/supabase/server';
export async function Header() {
  const user = await currentUser();
  const profile = user
    ? (
        await (
          await serverClient()
        )
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .maybeSingle()
      ).data
    : null;
  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="Savestate, inicio">
        <Gamepad2 size={27} />
        <span>
          SAVE<span className="accent">STATE</span>
          <small>YOUR NEXT CHECKPOINT</small>
        </span>
      </Link>
      <nav aria-label="Navegación principal">
        <Link href="/explore">Explorar</Link>
        <Link href="/library">Biblioteca</Link>
        <Link href="/feed">Transmisión</Link>
        <Link href="/highlights">Momentos</Link>
        <Link href="/forum">Foro</Link>
        <Link href="/parties">Compañeros</Link>
        <Link href="/lists">Listas</Link>
        <Link href="/players">Jugadores</Link>
        <Link href="/community/discord">Discord</Link>
      </nav>
      <div className="header-actions">
        <CommandMenu
          authenticated={Boolean(user)}
          username={profile?.username ?? null}
          userId={user?.id ?? null}
        />
        {user ? <NotificationBell key={user.id} userId={user.id} /> : null}
        <Link
          className="button small"
          href={
            user
              ? profile?.username
                ? `/players/${encodeURIComponent(profile.username)}`
                : '/settings'
              : '/login'
          }
        >
          {user ? 'Mi perfil' : 'Conectar'}
          <ArrowUpRight size={15} />
        </Link>
      </div>
    </header>
  );
}
