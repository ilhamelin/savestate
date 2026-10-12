import { discordCoverUrl } from './discord-client.ts';
type DiscordSlashCommand = {
  name: string;
  description: string;
  type: 1;
  options?: {
    name: string;
    description: string;
    type: 3;
    required?: boolean;
    autocomplete?: boolean;
    min_length?: number;
    max_length?: number;
    choices?: { name: string; value: string }[];
  }[];
};
export const DISCORD_SLASH_COMMANDS: DiscordSlashCommand[] = [
  { name: 'web', description: 'Abre SaveState.', type: 1 },
  { name: 'savestate', description: 'Tu próximo checkpoint en SaveState.', type: 1 },
  { name: 'gratis', description: 'Tres juegos gratis activos para reclamar hoy.', type: 1 },
  {
    name: 'valorant',
    description: 'Consulta un Riot ID en el tracker de Valorant.',
    type: 1,
    options: [
      {
        name: 'usuario',
        description: 'Riot ID: Nombre#TAG',
        type: 3,
        required: true,
        min_length: 5,
        max_length: 80,
      },
      {
        name: 'region',
        description: 'Región (por defecto: latam)',
        type: 3,
        choices: ['latam', 'br', 'na', 'eu'].map((value) => ({ name: value, value })),
      },
    ],
  },
  {
    name: 'lol',
    description: 'Rango y estadísticas de League of Legends.',
    type: 1,
    options: [
      {
        name: 'usuario',
        description: 'Riot ID: Nombre#LAS',
        type: 3,
        required: true,
        min_length: 7,
        max_length: 22,
      },
      {
        name: 'region',
        description: 'Servidor (por defecto: la2 / LAS)',
        type: 3,
        choices: ['la1', 'la2', 'na1', 'br1', 'euw1'].map((value) => ({ name: value, value })),
      },
    ],
  },
  {
    name: 'genshin',
    description: 'Escaparate público y progreso de Genshin Impact.',
    type: 1,
    options: [
      {
        name: 'uid',
        description: 'UID de Genshin (9 dígitos)',
        type: 3,
        required: true,
        min_length: 9,
        max_length: 9,
      },
    ],
  },
  {
    name: 'perfil',
    description: 'Busca un perfil público de SaveState.',
    type: 1,
    options: [
      {
        name: 'usuario',
        description: 'Nombre de usuario de SaveState.',
        type: 3,
        required: true,
        autocomplete: true,
        min_length: 3,
        max_length: 31,
      },
    ],
  },
  {
    name: 'juego',
    description: 'Busca una ficha del catálogo de SaveState.',
    type: 1,
    options: [
      {
        name: 'titulo',
        description: 'Título del juego.',
        type: 3,
        required: true,
        autocomplete: true,
        min_length: 2,
        max_length: 100,
      },
    ],
  },
];
export type DiscordCommandData = {
  content?: string;
  embeds?: {
    title: string;
    description: string;
    color: number;
    thumbnail?: { url: string };
    footer?: { text: string };
  }[];
  components?: {
    type: number;
    components: { type: number; style: number; label: string; url: string }[];
  }[];
  allowed_mentions: { parse: string[] };
  flags?: number;
};
export function discordCommandMessage(
  title: string,
  description: string,
  url: string,
  cover?: string | null,
): { type: 4; data: DiscordCommandData } {
  const thumbnail = discordCoverUrl(cover);
  return {
    type: 4,
    data: {
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: title.slice(0, 256),
          description: description.slice(0, 4000),
          color: 0x00f0ff,
          ...(thumbnail ? { thumbnail: { url: thumbnail } } : {}),
        },
      ],
      components: [
        { type: 1, components: [{ type: 2, style: 5, label: '🌐 Ver en SaveState', url }] },
      ],
    },
  };
}
export function discordCommandError(message: string): { type: 4; data: DiscordCommandData } {
  return { type: 4, data: { content: message, flags: 64, allowed_mentions: { parse: [] } } };
}
export function profileCommandResponse(
  base: string,
  profile: {
    username: string;
    level: number;
    equipped_title: string;
    library_private: boolean;
    terminal_status?: string | null;
  },
  count: number | null,
  details?: { cleared: number | null; platinum: number | null; favorites: string[] },
) {
  const lines = [`✦ Nivel ${profile.level} · ${profile.equipped_title}`];
  if (profile.library_private) {
    lines.push('Biblioteca privada: sus juegos no se muestran en Discord.');
  } else {
    lines.push(
      count === null
        ? 'Conteo público no disponible.'
        : `📚 ${count} Juegos · 🏁 ${details?.cleared ?? '—'} Terminados · 🏆 ${details?.platinum ?? '—'} Platinos`,
    );
    if (details?.favorites.length)
      lines.push(`⭐ Top 4: ${details.favorites.slice(0, 4).join(' · ')}`);
  }
  if (profile.terminal_status) lines.push(`> _${profile.terminal_status}_`);
  return discordCommandMessage(
    `@${profile.username}`,
    lines.join('\n'),
    `${base}/players/${encodeURIComponent(profile.username)}`,
  );
}
export function gameCommandResponse(
  base: string,
  game: {
    title: string;
    slug: string;
    cover_url: string | null;
    release_year: number | null;
    genres?: string[] | null;
    platforms?: string[] | null;
  },
  players: number | null = null,
) {
  return discordCommandMessage(
    game.title,
    [
      `GAME DATA TERMINAL // ${game.release_year ?? 'Sin fecha'}`,
      `🎭 Géneros: ${game.genres?.filter(Boolean).slice(0, 5).join(' · ') || 'Sin datos'}`,
      `🎮 Plataformas: ${game.platforms?.filter(Boolean).slice(0, 5).join(' · ') || 'Sin datos'}`,
      players === null
        ? '👥 Conteo público no disponible.'
        : `👥 ${players} jugadores lo registraron en bibliotecas públicas de SaveState.`,
      'Explora la ficha, sus reseñas y momentos en SaveState.',
    ].join('\n'),
    `${base}/games/${encodeURIComponent(game.slug)}`,
    game.cover_url,
  );
}
