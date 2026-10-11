import type { ReactNode } from 'react';
import { ROOM_THEMES, type RoomTheme } from '@/domain/arcade';
export function GamerRoom({ theme, children }: { theme: RoomTheme; children: ReactNode }) {
  const safeTheme = ROOM_THEMES.includes(theme) ? theme : 'crt_terminal';
  const marques = {
    arcade_cabinet: 'INSERT COIN // 1UP ARCADE',
    cyber_deck: 'SYS.DECK // ONLINE',
    vaporwave_shrine: 'NEON SUNSET // VAPORWAVE SANCTUARY',
    halloween_crypt: '🎃 SPOOKY CHECKPOINT // HALLOWEEN NIGHT 🦇',
    christmas_lodge: '🎄 HOLIDAY CHECKPOINT // WINTER FEST ❄️',
  };
  return (
    <div className={`gamer-room room-${safeTheme}`}>
      {safeTheme in marques ? (
        <div className="room-marquee" aria-hidden="true">
          {marques[safeTheme as keyof typeof marques]}
        </div>
      ) : null}
      {safeTheme === 'handheld_console' ? (
        <div className="room-console-brand" aria-hidden="true">
          SAVE STATE / PORTABLE
        </div>
      ) : null}
      <div className="room-screen">{children}</div>
      {safeTheme === 'handheld_console' ? (
        <div className="room-console-controls" aria-hidden="true">
          <span className="room-dpad">✚</span>
          <span className="room-speaker">▦ ▦ ▦</span>
          <span className="room-buttons">● ●</span>
        </div>
      ) : null}
    </div>
  );
}
