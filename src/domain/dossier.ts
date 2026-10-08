import { GAME_STATUSES, type UserGame, type PlayLog } from './model.ts';
export type DossierEntry = Pick<UserGame, 'id' | 'status'>;
export type DossierLog = Pick<
  PlayLog,
  'user_game_id' | 'hours_played' | 'platform_played' | 'play_method' | 'start_date' | 'finish_date'
>;
export function profileDossier(entries: DossierEntry[], logs: DossierLog[]) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const started = new Set(
    entries
      .filter((entry) => ['playing', 'cleared', 'platinum', 'dropped'].includes(entry.status))
      .map((entry) => entry.id),
  );
  const completed = entries.filter((entry) =>
    ['cleared', 'platinum'].includes(entry.status),
  ).length;
  const counts = Object.fromEntries(
    GAME_STATUSES.map((status) => [
      status,
      entries.filter((entry) => entry.status === status).length,
    ]),
  );
  const methods = {
    hardware: { count: 0, hours: 0 },
    emulator: { count: 0, hours: 0 },
    other: { count: 0, hours: 0 },
  };
  const platforms = new Map<string, number>();
  let cents = 0,
    completedCents = 0;
  for (const log of logs) {
    const entry = byId.get(log.user_game_id);
    if (!entry) continue;
    const amount = Number(log.hours_played);
    if (!Number.isFinite(amount) || amount < 0) continue;
    const rounded = Math.round(amount * 100);
    cents += rounded;
    if (['cleared', 'platinum'].includes(entry.status)) completedCents += rounded;
    if (entry.status === 'backlog' && (amount > 0 || log.start_date || log.finish_date))
      started.add(entry.id);
    const method = methods[log.play_method];
    method.count++;
    method.hours += rounded;
    const platform = log.platform_played.trim() || 'Sin plataforma';
    platforms.set(platform, (platforms.get(platform) ?? 0) + rounded);
  }
  const totalLogs = Object.values(methods).reduce((sum, method) => sum + method.count, 0);
  return {
    total: entries.length,
    completed,
    started: started.size,
    clearRate: started.size ? (completed / started.size) * 100 : 0,
    hours: cents / 100,
    averageCompletedHours: completed ? completedCents / 100 / completed : 0,
    states: GAME_STATUSES.map((status) => ({
      status,
      count: counts[status] ?? 0,
      percent: entries.length ? ((counts[status] ?? 0) / entries.length) * 100 : 0,
    })),
    methods: Object.entries(methods).map(([method, value]) => ({
      method,
      count: value.count,
      hours: value.hours / 100,
      percent: totalLogs ? (value.count / totalLogs) * 100 : 0,
    })),
    platforms: [...platforms]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, value]) => ({
        name,
        hours: value / 100,
        percent: cents ? (value / cents) * 100 : 0,
      })),
  };
}
export type ProfileDossier = ReturnType<typeof profileDossier>;
