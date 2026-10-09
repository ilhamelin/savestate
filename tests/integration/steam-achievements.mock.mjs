// Local opt-in fixture; application code never imports this module.
if (process.env.TEST_STEAM_ACHIEVEMENTS_MOCK === '1') {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    if (
      url.hostname === 'api.steampowered.com' &&
      url.pathname.includes('/GetPlayerAchievements/')
    ) {
      if (url.searchParams.get('steamid') !== '76561198000000000')
        throw new Error('Unexpected fixture account');
      const appid = url.searchParams.get('appid');
      if (appid === '20')
        return Response.json({ playerstats: { success: false } }, { status: 400 });
      if (appid === '30') return new Response(null, { status: 500 });
      return Response.json({
        playerstats: {
          success: true,
          achievements: [{ achieved: 1 }, { achieved: 0 }, { achieved: 1 }],
        },
      });
    }
    return original(input, init);
  };
}
