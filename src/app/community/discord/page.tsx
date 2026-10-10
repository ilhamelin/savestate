import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { DiscordChat } from '@/components/discord-chat';
import { discordInvite } from '@/domain/discord';
import { appUrl } from '@/lib/env';
export const metadata = { title: 'Discord Bridge' };
export default async function DiscordPage() {
  if (!(await currentUser())) redirect('/login?next=/community/discord');
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">COMMUNITY SIGNAL</p>
          <h1>Conecta con tu comunidad.</h1>
        </div>
      </div>
      <DiscordChat
        inviteUrl={discordInvite(process.env.DISCORD_INVITE_URL || 'https://discord.gg/532ZQzVXCp')}
        siteUrl={appUrl()}
      />
    </>
  );
}
