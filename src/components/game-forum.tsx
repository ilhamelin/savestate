import { gameForumThreads } from '@/services/forum';
import { ForumThreadList } from './forum-thread-list';
export async function GameForum({ gameId }: { gameId: string }) {
  const threads = await gameForumThreads(gameId);
  return (
    <section>
      <h2>Conversaciones de este juego.</h2>
      <ForumThreadList threads={threads} />
    </section>
  );
}
