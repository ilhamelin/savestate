'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
export function HeaderSearch() {
  const router = useRouter(),
    path = usePathname();
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'k' &&
        path !== '/explore'
      ) {
        event.preventDefault();
        router.push('/explore?focus=search');
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [path, router]);
  return (
    <button
      type="button"
      className="crt-toggle"
      aria-label="Buscar juegos, Control o Comando K"
      onClick={() => router.push('/explore?focus=search')}
    >
      <Search size={16} />
      <span>Ctrl K</span>
    </button>
  );
}
