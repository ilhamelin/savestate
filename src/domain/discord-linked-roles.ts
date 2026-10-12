export const DISCORD_ROLE_METADATA = [
  {
    key: 'level',
    type: 2,
    name: 'Nivel SaveState',
    description: 'Nivel verificado del jugador en SaveState.',
  },
  {
    key: 'completed_games',
    type: 2,
    name: 'Juegos Terminados',
    description: 'Juegos terminados o platinados registrados en SaveState.',
  },
  {
    key: 'platinum_games',
    type: 2,
    name: 'Juegos Platinados',
    description: 'Juegos con estado Platinum registrados en SaveState.',
  },
] as const;
export type DiscordRoleStats = { level: number; completed_games: number; platinum_games: number };
export function roleConnectionPayload(username: string, stats: DiscordRoleStats) {
  if (
    !/^[a-zA-Z0-9_]{3,30}$/.test(username) ||
    Object.values(stats).some((value) => !Number.isSafeInteger(value) || value < 0)
  )
    throw new Error('Estadísticas de rol inválidas.');
  return {
    platform_name: 'SaveState',
    platform_username: `@${username}`,
    metadata: {
      level: String(stats.level),
      completed_games: String(stats.completed_games),
      platinum_games: String(stats.platinum_games),
    },
  };
}
