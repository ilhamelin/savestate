// Controlled Valve responses for the opt-in local integration/UI test only.
if (process.env.TEST_STEAM_SYNC_MOCK !== '1')
  throw new Error('Explicit local Steam sync fixture opt-in required.');
const realFetch = globalThis.fetch;
process.env.STEAM_API_KEY = 'local-sync-fixture-not-a-real-key';
globalThis.fetch = async (input, options) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname !== 'api.steampowered.com') return realFetch(input, options);
  if (url.pathname.includes('ResolveVanityURL'))
    return Response.json({ response: { success: 1, steamid: '76561198000000001' } });
  if (url.pathname.includes('GetOwnedGames')) {
    if (url.searchParams.get('steamid') === '76561198000000003')
      return Response.json({ error: 'fixture upstream failure' }, { status: 503 });
    return Response.json({
      response: {
        games: [
          { appid: 10000, name: 'Chrono Trigger', playtime_forever: 300 },
          { appid: 10001, name: 'Chrono Cross', playtime_forever: 75 },
          { appid: 10002, name: 'Do not import this fixture', playtime_forever: 240 },
        ],
      },
    });
  }
  throw new Error('Unexpected Steam fixture endpoint');
};
