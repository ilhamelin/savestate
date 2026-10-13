import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseLolPatchList,
  parseLolPatchDetail,
  normalizeSkinSearch,
  parseSpotlightVideos,
  patchImage,
} from '../domain/lol-patch-notes.ts';
const document = (blades: unknown[]) =>
  '<script type="application/json" id="__NEXT_DATA__">' +
  JSON.stringify({ props: { pageProps: { page: { blades } } } }) +
  '</script>';
test('Patch index keeps LoL 2026, excludes TFT, unsafe URLs and sorts newest first', () => {
  const item = (title: string, url: string, date: string) => ({
    title,
    publishedAt: date,
    action: { payload: { url } },
    media: { url: 'https://cmsassets.rgpub.io/cover.jpg' },
    description: { body: '<p>Resumen seguro</p>' },
  });
  const html = document([
    {
      type: 'articleCardGrid',
      items: [
        item(
          'Notas 26.19',
          '/es-es/news/game-updates/league-of-legends-patch-26-19-notes',
          '2026-09-20T00:00:00Z',
        ),
        item(
          'Notas 26.20',
          '/es-es/news/game-updates/league-of-legends-patch-26-20-notes',
          '2026-10-06T00:00:00Z',
        ),
        item(
          'Teamfight Tactics 26.20',
          '/es-es/news/game-updates/teamfight-tactics-patch-26-20',
          '2026-10-06T00:00:00Z',
        ),
        item('TFT 26.20', '/es-es/news/game-updates/tft-patch', '2026-10-06T00:00:00Z'),
        item('Notas 25.24', '/es-es/news/game-updates/patch-25-24', '2025-12-01T00:00:00Z'),
        item(
          'Notas 26.20',
          'https://www.leagueoflegends.com.evil.example/es-es/news/game-updates/patch-26-20',
          '2026-10-06T00:00:00Z',
        ),
      ],
    },
  ]);
  const rows = parseLolPatchList(html);
  assert.deepEqual(
    rows.map((r) => r.version),
    ['26.20', '26.19'],
  );
  assert.equal(rows[0]?.description, 'Resumen seguro');
  assert.equal(rows[0]?.slugPath, '/es-es/news/game-updates/league-of-legends-patch-26-20-notes');
  assert.equal(patchImage('https://cmsassets.rgpub.io.evil.example/a.png'), null);
});
test('Patch detail parses nested champion blocks, ability deltas, both ARAM modes, fixes and skins', () => {
  const body = `<div><h2 id="patch-patch-highlights">Los platos fuertes de la versión</h2><p>Resumen</p><img src="https://cmsassets.rgpub.io/highlights.png"><h2 id="patch-champions">Campeones</h2><div class="patch-change-block"><div><a class="reference-link"><img src="https://ddragon.leagueoflegends.com/Ahri.png"></a><h3 class="change-title">Ahri</h3><blockquote>Contexto &amp; mejora</blockquote><h4 class="change-detail-title"><img src="https://ddragon.leagueoflegends.com/Q.png">Q - Orbe</h4><ul><li><strong>Daño</strong>: 10 ⇒ 20</li></ul><hr><h4>Estadísticas básicas</h4><ul><li>Vida: 500 ⇒ 550</li></ul></div></div><h2 id="patch-aram:-mayhem">ARAM: Caos</h2><blockquote>Caos</blockquote><p><strong>Ahri</strong></p><ul><li>Daño +5%</li></ul><h2 id="patch-aram">ARAM</h2><h4>Sett</h4><ul><li>Daño -5%</li></ul><h2 id="patch-bugfixes-and-qol-changes">Corrección de errores</h2><ul><li>Error resuelto</li></ul><h2 id="patch-upcoming-skins-and-chromas">Próximos aspectos</h2><div class="skin-box"><a class="skins" href="https://cmsassets.rgpub.io/sett.jpg"><img src="https://cmsassets.rgpub.io/sett-small.jpg"></a><h4 class="skin-title">Sett de prestigio</h4></div></div>`;
  const patch = parseLolPatchDetail(
    document([
      {
        type: 'articleMasthead',
        title: 'Notas 26.20',
        publishDate: '2026-10-06T00:00:00Z',
        banner: { url: 'https://cmsassets.rgpub.io/banner.jpg' },
      },
      {
        type: 'patchNotesRichText',
        richText: {
          body: body.replace(/(<h2[^>]*>.*?<\/h2>)/g, '<header class="header-primary">$1</header>'),
        },
      },
    ]),
    'league-of-legends-patch-26-20-notes',
  );
  assert.equal(patch.highlightsImageUrl, 'https://cmsassets.rgpub.io/highlights.png');
  assert.equal(patch.highlightsSummary, 'Resumen');
  assert.equal(patch.champions[0]?.name, 'Ahri');
  assert.deepEqual(
    patch.champions[0]?.abilities.map((a) => a.changes),
    [['Daño: 10 ⇒ 20'], ['Vida: 500 ⇒ 550']],
  );
  assert.equal(patch.aramMayhem?.changes[0]?.title, 'Ahri');
  assert.equal(patch.aram?.changes[0]?.title, 'Sett');
  assert.deepEqual(patch.bugfixes, ['Error resuelto']);
  assert.equal(patch.skins[0]?.imageUrl, 'https://cmsassets.rgpub.io/sett.jpg');
});
test('Spotlight search translates Spanish skin lines and selects official matching videos', () => {
  assert.equal(
    normalizeSkinSearch('Ahri elegida del lobo de prestigio'),
    'Ahri Chosen of the Wolf Prestige',
  );
  assert.equal(normalizeSkinSearch('Lux guardiana de las estrellas'), 'Lux Star Guardian');
  const video = (id: string, title: string, owner = 'SkinSpotlights') => ({
    videoRenderer: {
      videoId: id,
      title: { runs: [{ text: title }] },
      ownerText: { runs: [{ text: owner }] },
    },
  });
  const html =
    'var ytInitialData = ' +
    JSON.stringify({
      contents: [
        video('12345678901', 'Ahri Chosen of the Wolf Skin Spotlight - Pre-Release'),
        video('abcdefghijk', 'Ahri Chosen of the Wolf Skin Spotlight'),
        video('abcdefghij2', 'Ahri Chosen of the Wolf Skin Spotlight', 'Impostor'),
      ],
    }) +
    ';';
  assert.equal(parseSpotlightVideos(html, 'Ahri elegida del lobo')?.videoId, 'abcdefghijk');
  assert.equal(parseSpotlightVideos(html, 'Sett de prestigio'), null);
  assert.equal(parseSpotlightVideos('consent page', 'Ahri'), null);
});
