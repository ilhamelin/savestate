import { GlobalChatRoom } from '@/components/global-chat-room';
import { currentViewerProfile } from '@/lib/session';
import { isConfigured } from '@/lib/env';
import { listGlobalChatMessages } from '@/services/global-chat';
export const metadata = { title: 'Chat Global · Savestate' };
export const dynamic = 'force-dynamic';
export default async function ChatPage() {
  const [viewer, history] = await Promise.all([
    currentViewerProfile(),
    isConfigured()
      ? listGlobalChatMessages()
          .then((data) => ({ ...data, error: '' }))
          .catch(() => ({
            messages: [],
            nextCursor: null,
            error: 'No se pudo cargar el historial. La conexión volverá a intentarlo.',
          }))
      : Promise.resolve({
          messages: [],
          nextCursor: null,
          error: 'Configura Supabase para activar el chat.',
        }),
  ]);
  return (
    <div className="container">
      <GlobalChatRoom
        initialMessages={history.messages}
        initialCursor={history.nextCursor}
        initialError={history.error}
        viewer={viewer}
      />
    </div>
  );
}
