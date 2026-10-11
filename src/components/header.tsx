import Link from 'next/link';
import { Gamepad2, ArrowUpRight } from 'lucide-react';
import { CommandMenu } from '@/components/command-menu';
import { NotificationBell } from '@/components/notification-bell';
import { HeaderNav } from '@/components/header-nav';
import { currentUser, currentViewerProfile } from '@/lib/session';
export async function Header() {
  const [user, profile] = await Promise.all([currentUser(), currentViewerProfile()]);
  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="Savestate, inicio">
        <Gamepad2 size={27} />
        <span>
          SAVE<span className="accent">STATE</span>
          <small>YOUR NEXT CHECKPOINT</small>
        </span>
      </Link>
      <HeaderNav />
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
