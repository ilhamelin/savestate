import type { Activity, Game, PlayLog, UserGame } from './model.ts';
export interface WrappedSummary {
  year: number;
  registered: number;
  played: number;
  completed: number;
  hours: number;
  goty: { title: string; slug: string; rating: number | null } | null;
  genres: { name: string; percent: number }[];
  months: number[];
  peakMonth: number | null;
  moment: { id: string; title: string; reactions: number } | null;
}
export function wrappedYear(input: unknown, current = new Date().getUTCFullYear()) {
  const year = input === undefined ? current : Number(input);
  if (!Number.isInteger(year) || year < 2000 || year > current)
    throw new Error('Elige un año entre 2000 y el actual.');
  return year;
}
export function annualWrapped(
  year: number,
  entries: UserGame[],
  games: Game[],
  logs: PlayLog[],
  activities: Activity[],
): WrappedSummary {
  const inYear = (date: string) => date.slice(0, 4) === String(year);
  const first = new Map<string, string>(),
    played = new Set<string>(),
    completed = new Map<string, string>();
  const byEntry = new Map(entries.map((entry) => [entry.id, entry])),
    byGame = new Map(games.map((game) => [game.id, game]));
  const previous = new Map<string, string>();
  for (const activity of [...activities].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  )) {
    if (activity.event_type !== 'library_updated') continue;
    if (!first.has(activity.target_game_id))
      first.set(activity.target_game_id, activity.created_at);
    const status = String(activity.event_data.status);
    if (inYear(activity.created_at)) {
      if (['playing', 'cleared', 'platinum'].includes(status)) played.add(activity.target_game_id);
      if (
        ['cleared', 'platinum'].includes(status) &&
        !['cleared', 'platinum'].includes(previous.get(activity.target_game_id) ?? '') &&
        !completed.has(activity.target_game_id)
      )
        completed.set(activity.target_game_id, activity.created_at);
    }
    previous.set(activity.target_game_id, status);
  }
  let hours = 0;
  for (const log of logs) {
    const entry = byEntry.get(log.user_game_id);
    if (!entry || log.note.startsWith('[Steam lifetime:')) continue;
    const date = log.finish_date ?? log.start_date ?? log.created_at;
    if (inYear(date)) {
      played.add(entry.game_id);
      hours += Number(log.hours_played);
    }
    if (
      log.finish_date &&
      inYear(log.finish_date) &&
      (!completed.has(entry.game_id) || log.finish_date < completed.get(entry.game_id)!)
    )
      completed.set(entry.game_id, log.finish_date);
  }
  const months = Array.from({ length: 12 }, () => 0);
  for (const date of completed.values()) months[Number(date.slice(5, 7)) - 1]!++;
  const peak = Math.max(...months),
    peakMonth = peak ? months.indexOf(peak) : null;
  const candidates = entries
    .filter((entry) => played.has(entry.game_id) && byGame.has(entry.game_id))
    .sort(
      (a, b) =>
        (b.rating ?? -1) - (a.rating ?? -1) ||
        (a.favorite_position ?? 5) - (b.favorite_position ?? 5) ||
        a.game_id.localeCompare(b.game_id),
    );
  const winner = candidates.find(
    (entry) => entry.rating !== null || entry.favorite_position !== null,
  );
  const genreWeights = new Map<string, number>();
  for (const id of played) {
    const names = [...new Set(byGame.get(id)?.genres ?? [])];
    if (!names.length) names.push('Sin género');
    for (const name of names)
      genreWeights.set(name, (genreWeights.get(name) ?? 0) + 1 / names.length);
  }
  const genres = [...genreWeights]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, weight]) => ({
      name,
      percent: played.size ? Math.floor((weight / played.size) * 100) : 0,
    }));
  // Largest remainders keep percentages at exactly 100, including small libraries.
  if (genres.length) {
    const delta = 100 - genres.reduce((total, genre) => total + genre.percent, 0);
    const remainders = genres
      .map((genre, index) => ({
        index,
        remainder: (genreWeights.get(genre.name)! / played.size) * 100 - genre.percent,
      }))
      .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
    for (let index = 0; index < delta; index++)
      genres[remainders[index % remainders.length]!.index]!.percent++;
  }
  return {
    year,
    registered: [...first.values()].filter(inYear).length,
    played: played.size,
    completed: completed.size,
    hours: Math.round(hours * 100) / 100,
    goty: winner
      ? {
          title: byGame.get(winner.game_id)!.title,
          slug: byGame.get(winner.game_id)!.slug,
          rating: winner.rating,
        }
      : null,
    genres,
    months,
    peakMonth,
    moment: null,
  };
}
