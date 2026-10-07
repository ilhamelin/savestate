import { Explore } from '@/components/explore';
import { SuggestGame } from '@/components/community-forms';
import { currentUser } from '@/lib/session';
export const metadata = { title: 'Explorar videojuegos' };
export default async function ExplorePage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">GLOBAL GAME DATABASE</p>
          <h1>Encuentra tu próxima partida.</h1>
          <p>Desde clásicos de 8 bits hasta nuevos mundos. Busca por título, estudio o saga.</p>
        </div>
      </div>
      <Explore />
      {(await currentUser()) ? <SuggestGame /> : null}
    </>
  );
}
