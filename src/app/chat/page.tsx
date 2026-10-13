import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { DiscordChat } from '@/components/discord-chat';
import { discordInvite } from '@/domain/discord-client';
export const metadata = { title: 'Chat Global · Centro de Mando Comunitario' };
export default async function ChatPage() {
  if (!(await currentUser())) redirect('/login?next=/chat');
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">COMMUNITY SIGNAL // CENTRO DE MANDO</p>
          <h1>Chat Global</h1>
        </div>
      </div>
      <div className="discord-ticker">
        <span>
          ⚡ FRECUENCIA DE COMUNIDAD // Sincronización en vivo con el servidor oficial de Discord
        </span>
      </div>
      <DiscordChat
        inviteUrl={discordInvite(process.env.DISCORD_INVITE_URL || 'https://discord.gg/532ZQzVXCp')}
      />
    </>
  );
}
