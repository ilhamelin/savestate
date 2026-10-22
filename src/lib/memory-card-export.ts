import type { Profile, Game } from '@/domain/model';
import { CARD_SHELLS, type CardShellSkin, type CardQrCode } from '@/domain/memory-card';
export type MemoryCardData = {
  profile: Pick<Profile, 'username' | 'avatar_url' | 'terminal_status' | 'owned_platforms'>;
  qrCode?: CardQrCode;
  clearRate: number;
  hours: number;
  favorites: Pick<Game, 'id' | 'title' | 'cover_url'>[];
};
async function image(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return null;
  return new Promise((resolve) => {
    const picture = new Image();
    const finish = (result: HTMLImageElement | null) => {
      clearTimeout(timer);
      picture.onload = null;
      picture.onerror = null;
      if (!result) picture.src = '';
      resolve(result);
    };
    const timer = setTimeout(() => finish(null), 4000);
    // Anonymous CORS prevents a remote cover from tainting the export canvas.
    picture.crossOrigin = 'anonymous';
    picture.onload = () => finish(picture);
    picture.onerror = () => finish(null);
    picture.src = url;
  });
}
export async function renderMemoryCard(
  data: MemoryCardData,
  skin: CardShellSkin = 'ps1_memory_card',
) {
  const favorites = data.favorites.slice(0, 4);
  const [pictures] = await Promise.all([
    Promise.all([
      image(data.profile.avatar_url),
      ...favorites.map((game) => image(game.cover_url)),
    ]),
    document.fonts.ready,
  ]);
  const [avatar, ...covers] = pictures;
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Este navegador no admite exportación Canvas.');
  const root = getComputedStyle(document.documentElement);
  const shell = CARD_SHELLS[skin];
  const accent =
    skin === 'atomic_purple' ? '#d8b4fe' : root.getPropertyValue('--accent').trim() || '#00f0ff';
  const mono = root.getPropertyValue('--font-mono').trim() || 'monospace';
  const pixel = root.getPropertyValue('--font-pixel').trim() || 'monospace';
  function text(
    value: string,
    x: number,
    y: number,
    width: number,
    size = 26,
    color = '#f2f4f8',
    display = false,
  ) {
    ctx!.font = `${size}px ${display ? pixel : mono}`;
    ctx!.fillStyle = color;
    const letters = Array.from(value);
    let clipped = false;
    while (
      letters.length &&
      ctx!.measureText(letters.join('') + (clipped ? '…' : '')).width > width
    ) {
      letters.pop();
      clipped = true;
    }
    ctx!.fillText(letters.join('') + (clipped ? '…' : ''), x, y);
  }
  function cover(
    picture: HTMLImageElement | null | undefined,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    ctx!.fillStyle = '#1a1e27';
    ctx!.fillRect(x, y, w, h);
    if (picture) {
      const scale = Math.max(w / picture.naturalWidth, h / picture.naturalHeight);
      ctx!.save();
      ctx!.beginPath();
      ctx!.rect(x, y, w, h);
      ctx!.clip();
      ctx!.drawImage(
        picture,
        x + (w - picture.naturalWidth * scale) / 2,
        y + (h - picture.naturalHeight * scale) / 2,
        picture.naturalWidth * scale,
        picture.naturalHeight * scale,
      );
      ctx!.restore();
    } else text('▣', x + w / 3, y + h / 2 + 20, w / 2, 58, accent);
    ctx!.strokeStyle = accent;
    ctx!.lineWidth = 2;
    ctx!.strokeRect(x, y, w, h);
  }
  ctx.fillStyle = '#08080c';
  ctx.fillRect(0, 0, 1080, 1350);
  ctx.fillStyle = shell.plastic;
  ctx.fillRect(28, 28, 1024, 1294);
  // Molded ridges and cartridge notch stay outside the readable identity sticker.
  if (skin !== 'ps1_memory_card') {
    ctx.fillStyle = '#08080c';
    ctx.fillRect(980, 28, 72, 66);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#00000040';
      ctx.fillRect(80, 52 + i * 12, 800, 4);
    }
  }
  ctx.fillStyle = '#111319';
  ctx.fillRect(58, 155, 964, 1084);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(58, 155, 964, 1084);
  text(
    skin === 'ps1_memory_card' ? 'SAVESTATE MEMORY CARD' : 'SAVESTATE GAME PAK',
    80,
    115,
    920,
    38,
    shell.ink,
    true,
  );
  text(shell.label.toUpperCase() + ' // PLAYER SAVE', 80, 142, 920, 20, shell.ink);
  cover(avatar, 80, 175, 148, 148);
  text(`@${data.profile.username}`, 260, 225, 740, 38);
  const status = data.profile.terminal_status || 'Ready to play';
  text(status, 260, 275, 740, 24, '#a3aab9');
  text('YOUR NEXT CHECKPOINT', 260, 313, 740, 18, accent);
  ctx.fillStyle = '#08080c';
  ctx.fillRect(80, 355, 920, 130);
  text('CLEAR RATE', 110, 394, 420, 20, accent);
  text(`${data.clearRate.toFixed(1)}%`, 110, 451, 420, 48);
  text('HORAS REGISTRADAS', 570, 394, 400, 20, accent);
  text(`${data.hours.toFixed(1)} h`, 570, 451, 400, 36);
  text('HARDWARE INVENTORY', 80, 533, 920, 24, accent, true);
  const hardware = data.profile.owned_platforms.slice(0, 16);
  if (!hardware.length) text('Sin plataformas declaradas', 80, 584, 920, 24, '#a3aab9');
  hardware.forEach((name, index) => {
    const x = 80 + (index % 4) * 235,
      y = 557 + Math.floor(index / 4) * 48;
    ctx.strokeStyle = '#465064';
    ctx.strokeRect(x, y, 215, 38);
    text(name, x + 10, y + 26, 195, 17);
  });
  text('TOP 4  //  FAVORITE CHECKPOINTS', 80, 785, 920, 24, accent, true);
  for (let i = 0; i < 4; i++) {
    const x = 80 + i * 235;
    cover(covers[i], x, 812, 215, 280);
    text(
      favorites[i]?.title ?? 'Bloque libre',
      x,
      1132,
      215,
      20,
      favorites[i] ? '#f2f4f8' : '#a3aab9',
    );
    text(`SLOT ${String(i + 1).padStart(2, '0')}`, x, 1170, 215, 16, accent);
  }
  text(
    data.qrCode?.url ?? `${location.origin}/players/${encodeURIComponent(data.profile.username)}`,
    80,
    1225,
    920,
    18,
    '#a3aab9',
  );
  for (let i = 0; i < 15; i++) {
    ctx.fillStyle = i < favorites.length ? accent : '#292e38';
    ctx.fillRect(80 + i * 61, 1250, 48, 18);
  }
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('No se pudo generar la Memory Card.'))),
      'image/png',
    ),
  );
  return {
    blob,
    missingImages: Boolean(
      (data.profile.avatar_url && !avatar) ||
      favorites.some((game, index) => game.cover_url && !covers[index]),
    ),
  };
}
export function downloadMemoryCard(
  blob: Blob,
  username: string,
  skin: CardShellSkin = 'ps1_memory_card',
) {
  const url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = `savestate-${skin}-${username}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
