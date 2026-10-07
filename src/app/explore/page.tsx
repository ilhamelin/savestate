import { Explore } from '@/components/explore';
import { SuggestGame } from '@/components/community-forms';
import { currentUser } from '@/lib/session';
export const metadata = { title: 'Explorar videojuegos' };
export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initial = Object.fromEntries(
    ['q', 'platform', 'genre', 'year', 'rating', 'sort'].map((key) => [
      key,
      typeof params[key] === 'string' ? params[key] : '',
    ]),
  );
  const user = await currentUser();
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">GLOBAL GAME DATABASE</p>
          <h1>Encuentra tu próxima partida.</h1>
          <p>Desde clásicos de 8 bits hasta nuevos mundos. Busca por título, estudio o saga.</p>
        </div>
      </div>
      <Explore initial={initial} authenticated={!!user} />
      {user ? <SuggestGame /> : null}
    </>
  );
}
