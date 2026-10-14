import { screenAirDate, screenId, screenType } from './screen.ts';
import { safeChatMediaUrl } from './global-chat.ts';
import { ValidationError } from './validation.ts';
export interface ScreenAnnouncement {
  tmdbId: number;
  mediaType: string;
  title: string;
  nextAirDate: string;
  season?: number;
  episode?: number;
  providerName?: string;
  posterUrl?: string;
}
export function screenAnnouncementMessage(item: ScreenAnnouncement, base: string) {
  const id = screenId(item.tmdbId),
    type = screenType(item.mediaType),
    date = screenAirDate(item.nextAirDate);
  if (!date || !item.title.trim()) throw new ValidationError('Estreno inválido.');
  if (
    type === 'tv' &&
    (!Number.isInteger(item.season) ||
      !Number.isInteger(item.episode) ||
      (item.season ?? 0) < 1 ||
      (item.episode ?? 0) < 1)
  )
    throw new ValidationError('Episodio inválido.');
  const marker = `savestate-screen:${type}:${id}:${date}:${item.season ?? 0}:${item.episode ?? 0}`;
  const seconds = Date.parse(date + 'T00:00:00.000Z') / 1000;
  const poster = safeChatMediaUrl(item.posterUrl);
  return {
    marker,
    payload: {
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: '📢 PRÓXIMO ESTRENO // SaveState Screen',
          color: 0x00f0ff,
          url: `${base}/screen?select=${id}&type=${type}`,
          fields: [
            { name: 'Título', value: `🍿 ${item.title.slice(0, 300)}` },
            {
              name: 'Episodio / Estreno',
              value:
                type === 'tv'
                  ? `Temporada ${item.season} · Episodio ${item.episode}`
                  : 'Estreno de película',
              inline: true,
            },
            {
              name: 'Fecha de emisión',
              value: `${date} · <t:${seconds}:R>\nReferencia 00:00 UTC; hora de emisión no confirmada.`,
            },
            {
              name: 'Dónde ver',
              value:
                item.providerName?.slice(0, 200) ||
                (type === 'movie' ? 'CINES · Consulta disponibilidad regional' : 'Por confirmar'),
              inline: true,
            },
          ],
          ...(poster && new URL(poster).hostname === 'image.tmdb.org'
            ? { thumbnail: { url: poster } }
            : {}),
          footer: { text: marker },
        },
      ],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: 'Ver en SaveState',
              url: `${base}/screen?select=${id}&type=${type}`,
            },
          ],
        },
      ],
    },
  };
}
