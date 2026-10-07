import Link from 'next/link';
import { Gamepad2, ArrowUpRight } from 'lucide-react';
import { CrtToggle } from '@/components/ui/crt-toggle';
import { HeaderSearch } from '@/components/header-search';
import { currentUser } from '@/lib/session';
export async function Header() {
  const user = await currentUser();
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
        <Link href="/lists">Listas</Link>
        <Link href="/players">Jugadores</Link>
      </nav>
      <div className="header-actions">
        <HeaderSearch />
        <CrtToggle />
        <Link className="button small" href={user ? '/settings' : '/login'}>
          {user ? 'Mi cuenta' : 'Conectar'}
          <ArrowUpRight size={15} />
        </Link>
      </div>
    </header>
  );
}
