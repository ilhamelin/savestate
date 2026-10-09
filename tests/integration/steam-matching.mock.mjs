// Explicit local-only Steam fixture. IGDB and Supabase remain real.
if (process.env.TEST_STEAM_MATCH_MOCK === '1') {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    if (url.hostname === 'api.steampowered.com' && url.pathname.includes('/GetOwnedGames/'))
      return Response.json({
        response: {
          games: [
            { appid: 10, name: 'Stellar Blade™', playtime_forever: 120 },
            { appid: 20, name: 'The Witcher® 3: Wild Hunt [GOTY]', playtime_forever: 180 },
            { appid: 30, name: 'GTA V', playtime_forever: 240 },
          ],
        },
      });
    return original(input, init);
  };
}
