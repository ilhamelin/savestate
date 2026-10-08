import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { isConfigured } from '@/lib/env';
import { SetupNotice } from '@/components/setup-notice';
import { PartyBoard, PartyComposer } from '@/components/party-board';
import { partyFeed } from '@/services/arcade';
import {
  PARTY_PLATFORMS,
  PARTY_STYLES,
  PARTY_STYLE_LABELS,
  type PartyPlatform,
  type PartyStyle,
} from '@/domain/arcade';
export const metadata = { title: 'Busco compañero de partida' };
export default async function Parties({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isConfigured()) return <SetupNotice />;
  const params = await searchParams;
  const platform =
    typeof params.platform === 'string' && params.platform ? params.platform : undefined;
  const playstyle =
    typeof params.playstyle === 'string' && params.playstyle ? params.playstyle : undefined;
  const page = Number(params.page ?? 1);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > 1000 ||
    (platform && !PARTY_PLATFORMS.includes(platform as PartyPlatform)) ||
    (playstyle && !PARTY_STYLES.includes(playstyle as PartyStyle))
  )
    notFound();
  const [feed, user] = await Promise.all([
    partyFeed({
      page,
      platform: platform as PartyPlatform | undefined,
      playstyle: playstyle as PartyStyle | undefined,
    }),
    currentUser(),
  ]);
  function href(next: number) {
    return `/parties?${new URLSearchParams({ ...(platform ? { platform } : {}), ...(playstyle ? { playstyle } : {}), page: String(next) })}`;
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PARTY FINDER / LFG</p>
          <h1>Tu próxima partida, en compañía.</h1>
          <p className="muted">Convocatorias públicas que caducan a las 48 horas.</p>
        </div>
        {user ? (
          <PartyComposer />
        ) : (
          <Link className="button" href="/login?next=/parties">
            Conecta para convocar
          </Link>
        )}
      </div>
      <form className="panel form-row party-filters" action="/parties" method="get">
        <label>
          Plataforma
          <select name="platform" defaultValue={platform ?? ''}>
            <option value="">Todas</option>
            {PARTY_PLATFORMS.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Estilo
          <select name="playstyle" defaultValue={playstyle ?? ''}>
            <option value="">Todos</option>
            {PARTY_STYLES.map((value) => (
              <option key={value} value={value}>
                {PARTY_STYLE_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <button className="button">Filtrar</button>
      </form>
      <PartyBoard items={feed.items} viewerId={user?.id ?? null} generatedAt={feed.generatedAt} />
      <nav className="inline-actions" aria-label="Páginas de convocatorias">
        {page > 1 ? (
          <Link className="button secondary" href={href(page - 1)}>
            ← Anterior
          </Link>
        ) : null}
        {feed.hasMore ? (
          <Link className="button secondary" href={href(page + 1)}>
            Más convocatorias →
          </Link>
        ) : null}
      </nav>
    </>
  );
}
