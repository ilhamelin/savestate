// Explicit local-only preload. Never imported by application code or normal startup.
if (process.env.TEST_CONSOLE_SYNC_MOCK === '1') {
  process.env.PSN_NPSSO = 'fixture-npsso';
  process.env.XBL_API_KEY = 'fixture-xbox-key';
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    if (url.hostname === 'ca.account.sony.com') {
      if (url.pathname.endsWith('/authorize'))
        return new Response(null, {
          status: 302,
          headers: { location: 'com.scee.psxandroid.scecompcall://redirect/?code=fixture-code' },
        });
      if (url.pathname.endsWith('/token'))
        return Response.json({ access_token: 'fixture-token', expires_in: 3600 });
    }
    if (url.hostname === 'm.np.playstation.com') {
      if (url.pathname.endsWith('/universalSearch')) {
        const body = JSON.parse(String(init?.body));
        return Response.json({
          domainResponses: [
            {
              results:
                body.searchTerm === 'Missing'
                  ? [{ socialMetadata: { onlineId: 'Other', accountId: '9' } }]
                  : [
                      {
                        socialMetadata: {
                          onlineId: body.searchTerm,
                          accountId: body.searchTerm === 'Private' ? '2' : '1',
                        },
                      },
                    ],
            },
          ],
        });
      }
      if (url.pathname.includes('/users/2/'))
        return Response.json({ error: { code: 2240560, message: 'private fixture-token' } });
      if (url.pathname.endsWith('/trophyTitles'))
        return Response.json({
          trophyTitles: [
            {
              trophyTitleName: 'PSN Fixture',
              trophyTitlePlatform: 'PS4',
              progress: 100,
              earnedTrophies: { platinum: 1 },
            },
          ],
        });
      throw new Error('Unexpected PSN fixture request');
    }
    if (url.hostname === 'api.xbl.io') {
      if (new Headers(init?.headers).get('Accept-Language') !== 'en-US')
        return new Response(null, { status: 400 });
      if (url.pathname.endsWith('/friends/search')) {
        const tag = url.searchParams.get('gt');
        if (tag === 'Broken') return new Response('fixture-xbox-key', { status: 500 });
        return Response.json({
          content: {
            profileUsers: [
              {
                settings: [{ id: 'Gamertag', value: tag === 'Missing' ? 'Other' : tag }],
                id: tag === 'Private' ? '2' : '1',
              },
            ],
          },
        });
      }
      if (url.pathname.endsWith('/player/2')) return new Response(null, { status: 403 });
      if (url.pathname.endsWith('/player/1'))
        return Response.json({
          content: {
            titles: [
              {
                name: 'Xbox Fixture',
                devices: ['PC'],
                achievement: { currentGamerscore: 500, totalGamerscore: 1000 },
              },
            ],
          },
        });
      throw new Error('Unexpected Xbox fixture request');
    }
    return original(input, init);
  };
}
