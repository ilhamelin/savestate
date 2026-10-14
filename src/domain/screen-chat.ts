import { safeChatMediaUrl } from './global-chat.ts';
import { screenPercent, type ScreenDetail, type ScreenUserProgress } from './screen.ts';

// Keep shared checkpoints within the unified Discord chat's 500-character limit.
const oneLine = (value: string, limit: number) => {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > limit
    ? text.slice(0, limit - 1).replace(/[\uD800-\uDBFF]$/, '') + '…'
    : text;
};

export function screenChatCheckpoint(detail: ScreenDetail, progress: ScreenUserProgress) {
  const statuses = {
    watching: 'Viendo',
    plan_to_watch: 'Por ver',
    completed: 'Completada',
    dropped: 'Abandonada',
  };
  const season =
    detail.seasons.find((item) => item.number === progress.currentSeason)?.name ||
    `Temporada ${progress.currentSeason}`;
  const advance =
    detail.mediaType === 'tv'
      ? `${oneLine(season, 60)} · ${progress.watchedEpisodes.length} / ${detail.totalEpisodes} episodios vistos (${screenPercent({ ...progress, totalEpisodes: detail.totalEpisodes })}%)`
      : `Película · ${progress.status === 'completed' ? 'Vista (100%)' : 'En bitácora'}`;
  const content = [
    `${detail.mediaType === 'tv' ? '📺' : '🎬'} CHECKPOINT // Screen`,
    `🍿 ${oneLine(detail.title, 160)}`,
    `🏷️ Estado: ${statuses[progress.status]}`,
    `⭐ Tu calificación: ${progress.rating === null ? 'Sin calificación' : `${progress.rating}/10`}`,
    `📊 Avance: ${advance}`,
    `🔗 /screen?select=${detail.tmdbId}&type=${detail.mediaType}`,
  ].join('\n');
  const mediaUrl =
    [detail.backdropUrl, detail.posterUrl].find((url) => {
      const safe = safeChatMediaUrl(url);
      return safe && new URL(safe).hostname === 'image.tmdb.org';
    }) ?? null;
  return { content, mediaUrl };
}
