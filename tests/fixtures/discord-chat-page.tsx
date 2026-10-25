// CI-only fixture copied into the disposable runner; never a production route.
import { DiscordChat } from '@/components/discord-chat';
export default function ChatDesignQa() {
  return (
    <div className="discord-chat-page">
      <div className="page-heading discord-page-heading">
        <h1>Chat Global</h1>
      </div>
      <div className="discord-terminal-ticker">
        <span>⚡ FRECUENCIA DE COMUNIDAD // GATEWAY ACTIVO</span>
        <a href="https://discord.gg/532ZQzVXCp">Servidor de Discord ↗</a>
      </div>
      <DiscordChat inviteUrl="https://discord.gg/532ZQzVXCp" />
    </div>
  );
}
