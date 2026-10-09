import 'server-only';
import { AppError } from '@/lib/http';
import type { ConsoleRow } from '@/domain/console-import';

export async function fetchPsnTitles(onlineId: string): Promise<ConsoleRow[]> {
  const npsso = process.env.PSN_NPSSO;
  if (!npsso) {
    throw new AppError(
      'La sincronización automática con PlayStation requiere configurar PSN_NPSSO en las variables de entorno del servidor (o archivo .env.local). Puedes usar la importación por lista de títulos mientras tanto.',
      503,
    );
  }

  try {
    const {
      exchangeNpssoForAccessCode,
      exchangeAccessCodeForAuthTokens,
      makeUniversalSearch,
      getUserTitles,
    } = await import('psn-api');

    const accessCode = await exchangeNpssoForAccessCode(npsso);
    const authorization = await exchangeAccessCodeForAuthTokens(accessCode);

    // Buscar la cuenta pública por onlineId
    const searchResponse = await makeUniversalSearch(authorization, onlineId, 'SocialAllAccounts');

    const domainResults = searchResponse.domainResponses?.[0]?.results;
    if (!domainResults || !domainResults.length) {
      throw new AppError(`No se encontró ningún jugador con el PSN ID "${onlineId}".`, 404);
    }

    type SocialAccountItem = {
      socialMetadata?: {
        accountId?: string;
        onlineId?: string;
      };
    };

    const matched =
      (domainResults as SocialAccountItem[]).find(
        (r) => r.socialMetadata?.onlineId?.toLowerCase() === onlineId.toLowerCase(),
      ) || (domainResults[0] as SocialAccountItem);

    const accountId = matched?.socialMetadata?.accountId;
    if (!accountId) {
      throw new AppError(`No se pudo resolver el ID de cuenta para "${onlineId}".`, 404);
    }

    const titlesResponse = await getUserTitles(authorization, accountId, { limit: 100 });
    const trophyTitles = titlesResponse.trophyTitles || [];

    if (!trophyTitles.length) {
      throw new AppError(
        `El perfil "${onlineId}" no tiene juegos públicos o su privacidad de trofeos está en privado.`,
        404,
      );
    }

    return trophyTitles.map((t) => {
      let platform = 'PlayStation 5';
      const raw = t.trophyTitlePlatform?.toUpperCase() || '';
      if (raw.includes('PS5')) platform = 'PlayStation 5';
      else if (raw.includes('PS4')) platform = 'PlayStation 4';
      else if (raw.includes('PS3')) platform = 'PlayStation 3';
      else if (raw.includes('VITA')) platform = 'PlayStation Vita';
      else if (raw.includes('PSP')) platform = 'PSP';

      const isCompleted =
        t.progress === 100 || (t.earnedTrophies?.platinum && t.earnedTrophies.platinum > 0);

      return {
        title: t.trophyTitleName,
        platform,
        hours: 0,
        status: isCompleted ? 'cleared' : 'playing',
      };
    });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('Resource not found') || message.includes('404')) {
      throw new AppError(`No se encontró o no es público el perfil de PSN "${onlineId}".`, 404);
    }
    throw new AppError(`Error conectando con PlayStation Network: ${message}`, 502);
  }
}

export async function fetchXboxTitles(gamertag: string): Promise<ConsoleRow[]> {
  const apiKey = process.env.XBL_API_KEY;
  if (!apiKey) {
    throw new AppError(
      'La sincronización automática con Xbox requiere configurar XBL_API_KEY (de xbl.io) en las variables de entorno del servidor (o archivo .env.local). Puedes usar la importación por lista de títulos mientras tanto.',
      503,
    );
  }

  try {
    const searchRes = await fetch(
      `https://xbl.io/api/v2/friends/search?gt=${encodeURIComponent(gamertag)}`,
      {
        headers: { 'X-Authorization': apiKey },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!searchRes.ok) {
      throw new AppError(`No se encontró el Gamertag "${gamertag}".`, 404);
    }
    type XboxSearchResponse = {
      profileUsers?: Array<{ id?: string }>;
    };
    const searchData = (await searchRes.json()) as XboxSearchResponse;
    const profile = searchData.profileUsers?.[0];
    const xuid = profile?.id;
    if (!xuid) {
      throw new AppError(`No se encontró el Gamertag "${gamertag}".`, 404);
    }

    const titleRes = await fetch(`https://xbl.io/api/v2/achievements/xuid/${xuid}`, {
      headers: { 'X-Authorization': apiKey },
      signal: AbortSignal.timeout(10000),
    });
    if (!titleRes.ok) {
      throw new AppError(`No se pudieron obtener los logros de "${gamertag}".`, 502);
    }
    type XboxTitleItem = {
      name?: string;
      devices?: string[];
      currentGamerscore?: number;
      maxGamerscore?: number;
    };
    type XboxTitlesResponse = {
      titles?: XboxTitleItem[];
    };
    const titleData = (await titleRes.json()) as XboxTitlesResponse;
    const titles = titleData.titles || [];

    return titles.map((t) => {
      let platform = 'Xbox Series X|S';
      const devices = t.devices || [];
      if (devices.includes('Xbox360')) platform = 'Xbox 360';
      else if (devices.includes('XboxOne')) platform = 'Xbox One';
      else if (devices.includes('XboxSeries')) platform = 'Xbox Series X|S';

      const currentScore = t.currentGamerscore || 0;
      const totalScore = t.maxGamerscore || 1000;
      const status = currentScore >= totalScore ? 'cleared' : 'playing';

      return {
        title: t.name || 'Juego de Xbox',
        platform,
        hours: 0,
        status,
      };
    });
  } catch (err: unknown) {
    if (err instanceof AppError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new AppError(`Error conectando con Xbox Live: ${message}`, 502);
  }
}
