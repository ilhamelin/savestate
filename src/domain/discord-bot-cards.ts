import type { FreebieItem } from './freebies.ts';
import type { ValorantProfile, GenshinProfile } from './competitive-tracker.ts';
import type { LolProfileData } from './lol-tracker.ts';
import { record } from './game-live-telemetry.ts';
import { getGta6Countdown, shouldAnnounceGta6Countdown } from './gta6-countdown.ts';
import {
  discordCommandMessage,
  discordCommandError,
  type DiscordCommandData,
} from './discord-commands.ts';
function claimUrl(item: FreebieItem) {
  const url = new URL(item.openGiveawayUrl);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'www.gamerpower.com' ||
    !url.pathname.startsWith('/open/') ||
    url.username ||
    url.password ||
    url.port
  )
    throw new Error('Invalid giveaway URL');
  return url.toString();
}
export function discordGta6CountdownMessage(nowMs: number, baseAppUrl: string) {
  const countdown = getGta6Countdown(nowMs);
  const { bucket } = shouldAnnounceGta6Countdown([], nowMs);
  const base = new URL(baseAppUrl).origin;
  return {
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: `🌴⏳ CUENTA REGRESIVA GTA VI · Faltan ${countdown.days} días`,
        description: `Grand Theft Auto VI saldrá oficialmente el **19 de noviembre de 2026** para **PlayStation 5** y **Xbox Series X|S**.\n⏳ ${countdown.days}d ${countdown.hours}h ${countdown.minutes}m · referencia 00:00 UTC`,
        color: 0xff4fd8,
        thumbnail: { url: `${base}/gta6/icon-512.png` },
        image: { url: `${base}/gta6/hero.png` },
        footer: { text: `savestate-gta6-countdown:${bucket} · Aviso automático cada 5 días` },
      },
    ],
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 5, label: '🌐 Ver cuenta regresiva en vivo en SaveState', url: base },
        ],
      },
    ],
  };
}
export function discordFreebieMessage(item: FreebieItem, base: string): DiscordCommandData {
  const response = discordCommandMessage(
    `🎁 ¡JUEGO 100% GRATIS! // ${item.title}`,
    `🎮 Plataforma: ${item.platforms}\n💰 Valor original: ${item.worth}\n${item.endDate ? `⏳ Cierre indicado por GamerPower: ${item.endDate}` : '⏳ Sin fecha de cierre publicada; comprueba la disponibilidad al reclamar.'}\nAbre el enlace y sigue las instrucciones de la oferta para añadirlo a tu cuenta.`,
    `${base}/explore`,
    item.thumbnail,
  ).data;
  response.embeds![0]!.color = 0x39ff14;
  response.embeds![0]!.footer = { text: `SaveState Freebie #${item.id}` };
  response.components![0]!.components.unshift({
    type: 2,
    style: 5,
    label: '🎁 Reclamar Gratis',
    url: claimUrl(item),
  });
  return response;
}
export function unseenDiscordFreebies(items: FreebieItem[], history: unknown): FreebieItem[] {
  const messages = Array.isArray(history) ? history.map(record) : [];
  const seen = new Set<number>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return !messages.some((message) => {
      if (typeof message.content === 'string' && message.content.includes(item.openGiveawayUrl))
        return true;
      const embeds = Array.isArray(message.embeds) ? message.embeds.map(record) : [];
      if (
        embeds.some(
          (embed) =>
            record(embed.footer).text === `SaveState Freebie #${item.id}` ||
            embed.url === item.openGiveawayUrl ||
            (typeof embed.title === 'string' &&
              embed.title
                .replace(/^🎁 ¡JUEGO 100% GRATIS! \/\/ /, '')
                .trim()
                .toLowerCase() === item.title.trim().toLowerCase()),
        )
      )
        return true;
      const rows = Array.isArray(message.components) ? message.components.map(record) : [];
      return rows.some(
        (row) =>
          Array.isArray(row.components) &&
          row.components.some((button) => record(button).url === item.openGiveawayUrl),
      );
    });
  });
}
export function freebiesCommandResponse(
  items: FreebieItem[],
  base: string,
): { type: 4; data: DiscordCommandData } {
  if (!items.length)
    return discordCommandError('No hay juegos gratis disponibles en el radar en este momento.');
  const top = items.slice(0, 3),
    cards = top.map((item) => discordFreebieMessage(item, base));
  return {
    type: 4 as const,
    data: {
      allowed_mentions: { parse: [] },
      embeds: cards.flatMap((card) => card.embeds ?? []),
      components: [
        {
          type: 1,
          components: [
            ...top.map((item) => ({
              type: 2,
              style: 5,
              label: `🎁 ${item.title}`.slice(0, 80),
              url: claimUrl(item),
            })),
            { type: 2, style: 5, label: '🌐 Ver en SaveState', url: `${base}/explore` },
          ],
        },
      ],
    },
  };
}
export function valorantCommandResponse(profile: ValorantProfile, base: string) {
  const played = profile.matches.filter((match) => match.won !== null);
  const wins = played.filter((match) => match.won).length;
  const cross = profile.riotCrossProfile;
  const fallback =
    profile.dataSource !== 'henrik_full'
      ? `${cross?.summonerLevel != null ? `\n⚔️ Cuenta Riot activa en LoL: Nivel ${cross.summonerLevel}${cross.tftTier ? ` · TFT ${cross.tftTier}` : ''} (usa /lol para ver su rango)` : ''}\nℹ️ ${profile.valorantStatus === 'no_recent_matches' ? 'Esta cuenta de Riot no registra partidas recientes en Valorant (juega 1 partida en Valorant para sincronizar Nivel y Rango).' : 'No se pudieron obtener datos recientes de Valorant. Revisa la región o la disponibilidad del proveedor.'}`
      : '';
  return discordCommandMessage(
    `🎯 VALORANT // ${profile.gameName}#${profile.tagLine}`,
    `✦ Nivel: ${profile.accountLevel ?? 'No disponible'}\n🎖️ Rango: ${profile.currentRank ?? 'No disponible'}${profile.rankingInTier === null ? '' : ` · ${profile.rankingInTier} RR`}\n${played.length ? `📊 Historial reciente: ${wins} V / ${played.length - wins} D · ${Math.round((wins / played.length) * 100)}% WR (${played.length} partidas con resultado)` : '📊 Historial reciente no disponible.'}\nFuente: ${profile.dataSource === 'henrik_full' ? 'Henrik / Riot' : 'Riot oficial; datos de rango sujetos a disponibilidad'}${fallback}`,
    `${base}/rift`,
    profile.rankIconUrl ?? profile.cardWideUrl ?? profile.cardSmallUrl ?? undefined,
  );
}
export function lolCommandResponse(profile: LolProfileData, base: string) {
  const rank = profile.soloQueue;
  return discordCommandMessage(
    `⚔️ LEAGUE OF LEGENDS // ${profile.gameName}#${profile.tagLine}`,
    `✦ Nivel: ${profile.summonerLevel}\n${rank ? `🎖️ Solo/Dúo: ${rank.tier} ${rank.rank} · ${rank.leaguePoints} LP\n📊 ${rank.wins} Victorias / ${rank.losses} Derrotas · ${rank.winrate}% WR` : profile.rankStatus === 'available' ? '🎖️ Sin clasificación Solo/Dúo disponible.' : '🎖️ Rango Solo/Dúo no disponible.'}`,
    `${base}/rift?${new URLSearchParams({ riotId: `${profile.gameName}#${profile.tagLine}`, platform: profile.platform })}`,
  );
}
export function genshinCommandResponse(profile: GenshinProfile, base: string) {
  return discordCommandMessage(
    `🌟 GENSHIN IMPACT // ${profile.nickname}`,
    `UID: ${profile.uid}\n✦ Adventure Rank: ${profile.level} · Mundo ${profile.worldLevel}\n🌀 Abismo Espiral: ${profile.abyss}\n🎭 Escaparate público:\n${
      profile.showcase.length
        ? profile.showcase
            .slice(0, 8)
            .map((character) => `• ${character.name} · Nivel ${character.level}`)
            .join('\n')
        : 'Sin personajes públicos; activa el escaparate en el juego.'
    }`,
    `${base}/rift`,
  );
}
