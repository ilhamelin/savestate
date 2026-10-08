import Image from 'next/image';
import { Gamepad2 } from 'lucide-react';
import type { Game } from '@/domain/model';
type CoverGame = Pick<Game, 'id' | 'title' | 'cover_url'>;
export function ListCover({ games, title }: { games: (CoverGame | null)[]; title: string }) {
  return (
    <div className="list-cover" role="img" aria-label={`Portada compuesta de ${title}`}>
      {Array.from({ length: 4 }, (_, index) => {
        const game = games[index];
        return (
          <div className="list-cover-cell" key={index}>
            {game?.cover_url ? (
              <Image src={game.cover_url} alt="" fill sizes="(max-width: 600px) 60px, 100px" />
            ) : (
              <Gamepad2 size={24} aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
}
