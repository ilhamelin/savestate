import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { DiscordChat } from '@/components/discord-chat';
import { discordInvite } from '@/domain/discord-client';
export const metadata = { title: 'Chat Global · Centro de Mando Comunitario' };
export default async function ChatPage() {
  if (!(await currentUser())) redirect('/login?next=/chat');
  const inviteUrl = discordInvite(
    process.env.DISCORD_INVITE_URL || 'https://discord.gg/532ZQzVXCp',
  );
  return (
    <div className="discord-chat-page">
      <div className="page-heading discord-page-heading">
        <div>
          <p className="eyebrow">COMMUNITY SIGNAL // CENTRO DE MANDO</p>
          <h1>Chat Global</h1>
        </div>
      </div>
      <div className="discord-terminal-ticker">
        <span>⚡ FRECUENCIA DE COMUNIDAD // GATEWAY ACTIVO</span>
        {inviteUrl && (
          <a href={inviteUrl} target="_blank" rel="noopener noreferrer">
            Servidor de Discord ↗
          </a>
        )}
      </div>
      <DiscordChat inviteUrl={inviteUrl} />
    </div>
  );
}
