import 'server-only';
import { AppError } from '@/lib/http';
import {
  exactPsnAccount,
  exactXboxAccount,
  psnTitleRows,
  xboxTitleRows,
} from '@/domain/console-sync';
import { consoleIdentity, type ConsoleRow } from '@/domain/console-import';
function providerError(provider: string, status: number): AppError {
  if (status === 404 || status === 403)
    return new AppError(
      `No se encontró un perfil público de ${provider} accesible con ese identificador.`,
      404,
    );
  if (status === 401)
    return new AppError(
      `La credencial de ${provider} expiró o no es válida. El administrador debe renovarla. Puedes usar la importación manual.`,
      503,
    );
  if (status === 429)
    return new AppError(`${provider} alcanzó su límite de consultas. Inténtalo más tarde.`, 503);
  return new AppError(
    `No se pudo consultar ${provider}. Inténtalo de nuevo o usa la importación manual.`,
    502,
  );
}
function psnResponse(input: unknown) {
  if (!input || typeof input !== 'object') throw providerError('PSN', 502);
  if ('error' in input) {
    const error = input.error;
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code === '2240560' || code === '2113633') throw providerError('PSN', 403);
    throw providerError('PSN', 502);
  }
}
async function bounded<T>(work: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new AppError(
                'PSN tardó demasiado en responder. Reintenta o usa la importación manual.',
                502,
              ),
            ),
          20000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export async function fetchPsnTitles(onlineId: string): Promise<ConsoleRow[]> {
  const identity = consoleIdentity(onlineId);
  if (!identity) throw new AppError('Ingresa tu PSN Online ID.', 400);
  const npsso = process.env.PSN_NPSSO;
  if (!npsso)
    throw new AppError(
      'La sincronización PSN requiere PSN_NPSSO en el servidor. Puedes usar la importación manual.',
      503,
    );
  try {
    return await bounded(async () => {
      const {
        exchangeNpssoForAccessCode,
        exchangeAccessCodeForAuthTokens,
        makeUniversalSearch,
        getUserTitles,
      } = await import('psn-api');
      const accessCode = await exchangeNpssoForAccessCode(npsso);
      const auth = await exchangeAccessCodeForAuthTokens(accessCode);
      if (!auth.accessToken) throw providerError('PSN', 401);
      const search = await makeUniversalSearch(auth, identity, 'SocialAllAccounts');
      psnResponse(search);
      const accountId = exactPsnAccount(search, identity);
      if (!accountId) throw providerError('PSN', 404);
      const titles: unknown[] = [];
      for (const offset of [0, 100]) {
        const page = await getUserTitles(auth, accountId, { limit: 100, offset });
        psnResponse(page);
        if (!Array.isArray(page.trophyTitles)) throw providerError('PSN', 502);
        titles.push(...page.trophyTitles);
        if (page.trophyTitles.length < 100) break;
      }
      const rows = psnTitleRows(titles);
      if (!rows.length) throw providerError('PSN', 404);
      return rows;
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof Error && error.message.includes('problem retrieving your PSN access code'))
      throw providerError('PSN', 401);
    // Provider errors may contain credentials; never expose their raw message.
    throw providerError('PSN', 502);
  }
}
async function xboxRequest(path: string, key: string): Promise<unknown> {
  const response = await fetch(`https://api.xbl.io/v2/${path}`, {
    headers: { 'X-Authorization': key, Accept: 'application/json' },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw providerError('Xbox', response.status);
  return response.json();
}
export async function fetchXboxTitles(gamertag: string): Promise<ConsoleRow[]> {
  const identity = consoleIdentity(gamertag);
  if (!identity) throw new AppError('Ingresa tu Xbox Gamertag.', 400);
  const key = process.env.XBL_API_KEY;
  if (!key)
    throw new AppError(
      'La sincronización Xbox requiere XBL_API_KEY de OpenXBL en el servidor. Puedes usar la importación manual.',
      503,
    );
  try {
    const search = await xboxRequest(`friends/search/${encodeURIComponent(identity)}`, key);
    const xuid = exactXboxAccount(search, identity);
    if (!xuid) throw providerError('Xbox', 404);
    const titles = await xboxRequest(`achievements/player/${xuid}`, key);
    if (!titles || typeof titles !== 'object' || !('titles' in titles))
      throw providerError('Xbox', 502);
    const rows = xboxTitleRows(titles.titles);
    if (!rows.length) throw providerError('Xbox', 404);
    return rows;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw providerError('Xbox', 502);
  }
}
