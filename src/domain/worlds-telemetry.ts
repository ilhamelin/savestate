import type { WorldsGameTelemetry } from './worlds-schedule.ts';

export function hasWorldsTelemetryMetrics(value: WorldsGameTelemetry): boolean {
  return (
    (value.durationSeconds ?? 0) > 120 ||
    value.blueTeam.totalGold > 5000 ||
    value.redTeam.totalGold > 5000 ||
    value.blueTeam.totalKills > 0 ||
    value.redTeam.totalKills > 0 ||
    value.gameState === 'finished'
  );
}

export function mergeWorldsTelemetry(
  previous: Record<number, WorldsGameTelemetry>,
  incoming: Record<number, WorldsGameTelemetry>,
): Record<number, WorldsGameTelemetry> {
  const merged = { ...previous };
  for (const value of Object.values(incoming)) {
    if (!value || !hasWorldsTelemetryMetrics(value)) continue;
    const prior = merged[value.gameNumber];
    if (
      prior?.gameId === value.gameId &&
      ((prior.gameState === 'finished' && value.gameState !== 'finished') ||
        (hasWorldsTelemetryMetrics(prior) && !hasWorldsTelemetryMetrics(value)))
    )
      continue;
    merged[value.gameNumber] = value;
  }
  return merged;
}

// localStorage can contain stale or edited JSON. Validate every field used by the scoreboard.
export function readSavedWorldsTelemetry(raw: string | null): Record<number, WorldsGameTelemetry> {
  if (!raw || raw.length > 500_000) return {};
  const record = (value: unknown): Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const number = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const string = (value: unknown) => typeof value === 'string' && value.length <= 500;
  function team(value: unknown) {
    const row = record(value);
    return (
      ['totalGold', 'totalKills', 'towers', 'barons', 'inhibitors'].every((key) =>
        number(row[key]),
      ) &&
      Array.isArray(row.dragons) &&
      row.dragons.length <= 100 &&
      row.dragons.every(string)
    );
  }
  function players(value: unknown) {
    return (
      Array.isArray(value) &&
      value.length <= 10 &&
      value.every((item) => {
        const row = record(item);
        return (
          [
            'participantId',
            'level',
            'kills',
            'deaths',
            'assists',
            'kdaRatio',
            'killParticipationPct',
            'creepScore',
            'totalGold',
            'goldSharePct',
          ].every((key) => number(row[key])) &&
          ['summonerName', 'championId', 'championIconUrl'].every((key) => string(row[key])) &&
          (row.championIconUrl === '' || /^https:\/\//.test(String(row.championIconUrl))) &&
          ['top', 'jungle', 'mid', 'bottom', 'support'].includes(String(row.role)) &&
          typeof row.isMvp === 'boolean'
        );
      })
    );
  }
  try {
    const parsed = record(JSON.parse(raw));
    const saved: Record<number, WorldsGameTelemetry> = {};
    for (const [key, item] of Object.entries(parsed)) {
      const row = record(item);
      if (
        !/^[1-5]$/.test(key) ||
        row.gameNumber !== Number(key) ||
        !/^\d{1,24}$/.test(String(row.gameId)) ||
        typeof row.gameId !== 'string'
      )
        continue;
      if (
        !['unstarted', 'in_game', 'finished'].includes(String(row.gameState)) ||
        !(row.patchVersion === null || string(row.patchVersion)) ||
        !(row.durationSeconds === null || number(row.durationSeconds)) ||
        !team(row.blueTeam) ||
        !team(row.redTeam) ||
        !players(row.bluePlayers) ||
        !players(row.redPlayers)
      )
        continue;
      const value = item as WorldsGameTelemetry;
      if (value.gameState === 'finished' || hasWorldsTelemetryMetrics(value))
        saved[Number(key)] = value;
    }
    return saved;
  } catch {
    return {};
  }
}
