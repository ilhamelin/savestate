import Link from 'next/link';
import { isConfigured } from '@/lib/env';
import { currentUser } from '@/lib/session';
import { SetupNotice } from '@/components/setup-notice';
import { forumDirectory } from '@/services/forum';
import { ForumCreate } from '@/components/forum-create';
import { ForumThreadList } from '@/components/forum-thread-list';
export const metadata = { title: 'SaveState Boards' };
export default async function ForumPage() {
  if (!isConfigured()) return <SetupNotice />;
  const [data, user] = await Promise.all([forumDirectory(), currentUser()]);
  const icons: Record<string, string> = {
    'gamepad-2': '🎮',
    flame: '🔥',
    map: '🗺️',
    sparkles: '✨',
    coffee: '☕',
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">SAVESTATE BOARDS</p>
          <h1>Una comunidad. Mil conversaciones.</h1>
          <p className="muted">De la taberna retro a tu próximo descubrimiento.</p>
        </div>
      </div>
      {user ? (
        <ForumCreate categories={data.categories} />
      ) : (
        <Link className="button" href="/login?next=/forum">
          Conectar para crear un hilo
        </Link>
      )}
      <section className="forum-channels" aria-label="Canales del foro">
        {data.categories.map((category) => {
          const stats = data.stats.find((s) => s.category_id === category.id);
          return (
            <Link className="panel forum-channel" key={category.id} href={`/forum/${category.id}`}>
              <span className="forum-icon" aria-hidden="true">
                {icons[category.icon] ?? '💬'}
              </span>
              <h2>{category.name}</h2>
              <p className="muted">{category.description}</p>
              <p>
                {stats?.threads ?? 0} hilos · {stats?.messages ?? 0} mensajes
              </p>
              <small>
                Última actividad:{' '}
                {stats?.last_activity
                  ? stats.last_activity.slice(0, 16).replace('T', ' ') + ' UTC'
                  : 'Sin actividad todavía'}
              </small>
            </Link>
          );
        })}
      </section>
      <h2>Conversaciones recientes.</h2>
      <ForumThreadList threads={data.hot} />
    </>
  );
}
