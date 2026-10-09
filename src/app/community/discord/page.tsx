import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { DiscordChat } from '@/components/discord-chat';
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
      <DiscordChat />
    </>
  );
}
