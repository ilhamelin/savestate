import Image from 'next/image';
import Link from 'next/link';
import { Gamepad2, ArrowUpRight } from 'lucide-react';
import type { Game } from '@/domain/model';
export function GameCard({
  game,
  score,
  prefetch,
}: {
  game: Game;
  score?: number | null;
  prefetch?: boolean;
}) {
  return (
    <Link href={`/games/${game.slug}`} className="game-card" prefetch={prefetch}>
      <div className="cover aspect-[3/4]">
        {game.cover_url ? (
          <Image
            src={game.cover_url}
            alt={`Portada de ${game.title}`}
            fill
            sizes="(max-width: 600px) 50vw, (max-width: 1000px) 33vw, 240px"
          />
        ) : (
          <Gamepad2 size={48} aria-hidden="true" />
        )}
      </div>
      <div className="game-card-body">
        <div className="eyebrow">
          {game.release_year ?? 'SIN FECHA'} <span>{score ? `★ ${score}/10` : '—'}</span>
        </div>
        <h3 className="line-clamp-2" title={game.title}>
          {game.title}
        </h3>
        <p className="line-clamp-2">
          {game.platforms.slice(0, 2).join(' / ') || 'Plataforma por confirmar'}
        </p>
        <span className="card-link">
          Ver ficha <ArrowUpRight size={14} />
        </span>
      </div>
    </Link>
  );
}
