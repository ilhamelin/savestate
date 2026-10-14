import Link from 'next/link';
import Image from 'next/image';
import { Gamepad2, ArrowUpRight } from 'lucide-react';
import { CommandMenu } from '@/components/command-menu';
import { NotificationBell } from '@/components/notification-bell';
import { HeaderNav } from '@/components/header-nav';
import { currentUser, currentViewerProfile } from '@/lib/session';
export async function Header() {
  const [user, profile] = await Promise.all([currentUser(), currentViewerProfile()]);
  return (
    <header className="site-header">
      <Image
        src="/icons/halloween/telarana-de-halloween.png"
        alt=""
        width={40}
        height={40}
        className="corner-web header-halloween-web"
        unoptimized
      />
      <Link href="/" className="brand brand-halloween" aria-label="Savestate, inicio">
        <Gamepad2 size={27} />
        <span className="brand-halloween-copy">
          <Image
            src="/icons/halloween/sombrero-de-bruja.png"
            alt=""
            width={18}
            height={18}
            className="brand-halloween-hat"
            unoptimized
          />
          SAVE<span className="accent text-halloween-orange">STATE</span>
          <small>SPOOKY CHECKPOINT</small>
        </span>
        <Image
          src="/icons/halloween/calabaza.png"
          alt=""
          width={22}
          height={22}
          className="brand-halloween-pumpkin"
          unoptimized
        />
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
          <Image
            src="/icons/halloween/calabaza.png"
            alt=""
            width={16}
            height={16}
            className="profile-halloween-pumpkin"
            unoptimized
          />
          {user ? 'Mi perfil' : 'Conectar'}
          <ArrowUpRight size={15} />
        </Link>
      </div>
    </header>
  );
}
