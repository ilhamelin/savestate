// Opt-in local UI fixture. Never imported by application code or a production start.
if (process.env.TEST_STEAM_MOCK !== '1')
  throw new Error('Explicit local Steam fixture opt-in required.');
const realFetch = globalThis.fetch;
process.env.STEAM_API_KEY = 'local-fixture-not-a-real-key';
globalThis.fetch = async (input, options) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname !== 'api.steampowered.com') return realFetch(input, options);
  if (url.pathname.includes('ResolveVanityURL'))
    return Response.json({ response: { success: 1, steamid: '76561198000000001' } });
  if (url.pathname.includes('GetOwnedGames'))
    return Response.json({
      response: {
        game_count: 300,
        games: Array.from({ length: 300 }, (_, index) => ({
          appid: index + 10000,
          name: index === 0 ? 'The Orange Box' : `Fixture Steam ${index}`,
          playtime_forever: index === 0 ? 120 : 0,
        })),
      },
    });
  throw new Error('Unexpected Steam fixture endpoint');
};
