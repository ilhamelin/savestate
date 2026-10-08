import type { WrappedSummary } from '@/domain/wrapped';
export async function exportWrapped(summary: WrappedSummary, username: string) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Este navegador no admite exportación Canvas.');
  const root = getComputedStyle(document.documentElement),
    pixel = root.getPropertyValue('--font-pixel').trim() || 'monospace',
    mono = root.getPropertyValue('--font-mono').trim() || 'monospace';
  ctx.fillStyle = '#08080c';
  ctx.fillRect(0, 0, 1080, 1920);
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, 1000, 1840);
  const line = (value: string, y: number, size = 32, color = '#f2f4f8', maxLines = 2) => {
    ctx.fillStyle = color;
    ctx.font = `${size}px ${size >= 40 ? pixel : mono}`;
    const words = value.split(/\s+/);
    let row = '',
      count = 0;
    for (let index = 0; index < words.length; index++) {
      const word = words[index]!;
      const candidate = row ? `${row} ${word}` : word;
      if (ctx.measureText(candidate).width > 880 && row) {
        ctx.fillText(row, 100, y);
        y += size * 1.5;
        row = word;
        if (++count >= maxLines - 1) {
          row = words.slice(index).join(' ');
          const clipped = ctx.measureText(row).width > 880;
          while (ctx.measureText(`${row}${clipped ? '…' : ''}`).width > 880) row = row.slice(0, -1);
          ctx.fillText(`${row}${clipped ? '…' : ''}`, 100, y);
          return;
        }
      } else row = candidate;
    }
    while (ctx.measureText(row).width > 880) row = row.slice(0, -1);
    ctx.fillText(row, 100, y);
  };
  line('SAVESTATE WRAPPED', 150, 42, '#00f0ff');
  line(String(summary.year), 275, 88);
  line(`@${username}`, 350, 30);
  line(`${summary.registered} registrados`, 490, 36);
  line(`${summary.played} jugados`, 555, 36);
  line(`${summary.completed} completados`, 620, 36);
  line(`${summary.hours.toFixed(1)} h registradas`, 685, 36);
  line('TU JUEGO DEL AÑO', 825, 28, '#00f0ff');
  line(summary.goty?.title ?? 'Aún sin GOTY', 895, 40, undefined, 2);
  line(
    summary.goty?.rating !== null && summary.goty
      ? `Nota: ${summary.goty.rating}/10`
      : 'Fija un favorito o puntúa una partida.',
    1025,
    26,
  );
  line('TU ADN GAMER', 1150, 28, '#00f0ff');
  summary.genres
    .slice(0, 4)
    .forEach((genre, index) => line(`${genre.percent}% ${genre.name}`, 1210 + index * 55, 26));
  line('MOMENTO MÁS ÉPICO', 1500, 28, '#00f0ff');
  line(summary.moment?.title ?? 'Tu próximo momento está por llegar.', 1560, 30, undefined, 2);
  line(`${summary.moment?.reactions ?? 0} reacciones`, 1670, 26);
  const month =
    summary.peakMonth === null
      ? 'Sin finalizaciones'
      : new Intl.DateTimeFormat('es', { month: 'long', timeZone: 'UTC' }).format(
          new Date(Date.UTC(summary.year, summary.peakMonth, 1)),
        );
  line(`Mes destacado: ${month}`, 1780, 26);
  line('EL PROGRESO ES PERSONAL. KEEP PLAYING.', 1840, 20, '#00f0ff');
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('No se pudo generar la imagen.'))),
      'image/png',
    ),
  );
  const url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = `savestate-wrapped-${username}-${summary.year}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
