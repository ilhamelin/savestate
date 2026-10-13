'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Compass,
  Library,
  Radio,
  Sparkles,
  MessageSquare,
  MessageCircle,
  Layers,
  UserCheck,
  Headphones,
  Swords,
  Trophy,
} from 'lucide-react';

const links = [
  { href: '/explore', label: 'Explorar', icon: Compass },
  { href: '/library', label: 'Biblioteca', icon: Library },
  { href: '/feed', label: 'Transmisión', icon: Radio },
  { href: '/highlights', label: 'Momentos', icon: Sparkles },
  { href: '/forum', label: 'Foro', icon: MessageSquare },
  { href: '/chat', label: 'Chat Global', icon: MessageCircle },
  { href: '/lists', label: 'Listas', icon: Layers },
  { href: '/players', label: 'Jugadores', icon: UserCheck },
  { href: '/community/discord', label: 'Discord', icon: Headphones },
  { href: '/rift', label: 'Rift', icon: Swords },
  { href: '/worlds', label: 'Worlds', icon: Trophy },
];
export function HeaderNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegación principal">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={active ? 'nav-item-active' : undefined}
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
