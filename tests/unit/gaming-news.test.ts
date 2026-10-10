import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newsText,
  newsAge,
  parseGamingRss,
  combineGamingNews,
  extractNewsImage,
} from '../../src/domain/gaming-news.ts';

const now = Date.parse('2026-10-10T18:00:00Z');
const item = (title: string, url: string, date = 'Sat, 10 Oct 2026 17:45:00 GMT') =>
  `<item><title><![CDATA[${title}]]></title><link>${url}</link><pubDate>${date}</pubDate><description>&lt;p&gt;Una &quot;aventura&quot; &amp; un parche.&lt;/p&gt;</description></item>`;
test('Gaming RSS strips HTML, decodes entities and ignores unsafe or incomplete entries', () => {
  assert.equal(
    newsText('&lt;b&gt;Pok&#233;mon &amp;amp; &apos;juegos&apos;&lt;/b&gt;'),
    "Pokémon & 'juegos'",
  );
  assert.equal(newsText('<script>alert(1)</script><p>Texto&nbsp;seguro</p>'), 'Texto seguro');
  const rss =
    '<rss><channel>' +
    item('Acción &amp; aventura', 'https://vandal.elespanol.com/noticia/1/?a=1&amp;b=2') +
    item('Peligro', 'javascript:alert(1)') +
    item('Host falso', 'https://vandal.elespanol.com.evil.example/news') +
    item('Credenciales', 'https://user:password@vandal.elespanol.com/news') +
    item('Sin fecha', 'https://vandal.elespanol.com/news', 'invalid') +
    '</channel></rss>';
  const result = parseGamingRss(rss, 'vandal', now);
  assert.equal(result.length, 1);
  assert.equal(result[0]?.title, 'Acción & aventura');
  assert.equal(result[0]?.description, 'Una "aventura" & un parche.');
  assert.equal(result[0]?.relativeTime, 'HACE 15M');
  assert.equal(result[0]?.url, 'https://vandal.elespanol.com/noticia/1/?a=1&b=2');
  assert.deepEqual(parseGamingRss('<html>Error</html>', 'ign', now), []);
});
test('Gaming news sorts across sources, deduplicates links and caps the wire at thirty', () => {
  const rows = Array.from(
    { length: 35 },
    (_, i) =>
      parseGamingRss(
        item(
          `Noticia ${i}`,
          `https://es.ign.com/news/${i}`,
          new Date(now - i * 3600000).toUTCString(),
        ),
        'ign',
        now,
      )[0]!,
  );
  const result = combineGamingNews([rows.slice(0, 10), rows.slice(8)]);
  assert.equal(result.length, 30);
  assert.equal(result[0]?.title, 'Noticia 0');
  assert.equal(result.at(-1)?.title, 'Noticia 29');
  assert.equal(newsAge('2026-10-10T16:00:00Z', now), 'HACE 2H');
  assert.equal(newsAge('2026-10-09T18:00:00Z', now), 'HACE 1D');
  assert.equal(newsAge('2026-10-10T19:00:00Z', now), 'AHORA');
  assert.equal(newsAge('invalid', now), '');
  assert.deepEqual(combineGamingNews([]), []);
});

test('Gaming thumbnails prefer enclosures, decode escaped image tags and reject unsafe origins', () => {
  const image = 'https://sm.ign.com/news/cover.jpg';
  assert.equal(
    extractNewsImage(
      '<img src="https://media.vandal.net/second.png"/><enclosure url="' + image + '"/>',
    ),
    image,
  );
  assert.equal(
    extractNewsImage('<media:thumbnail url="https://media.vandal.net/game.webp"/>'),
    'https://media.vandal.net/game.webp',
  );
  assert.equal(
    extractNewsImage('<img src="https://videos.vandalimg.com/game.jpg"/>'),
    'https://videos.vandalimg.com/game.jpg',
  );
  assert.equal(
    extractNewsImage(
      '&lt;img src=&quot;https://sm.ign.com/game.jpg?width=88&amp;height=50&quot;&gt;',
    ),
    'https://sm.ign.com/game.jpg?width=88&height=50',
  );
  assert.equal(
    extractNewsImage('&lt;img src=&#34;https://media.vandal.net/game.png&#34;&gt;'),
    'https://media.vandal.net/game.png',
  );
  assert.equal(
    extractNewsImage('<description><![CDATA[https://media.vandal.net/game.avif]]></description>'),
    'https://media.vandal.net/game.avif',
  );
  assert.equal(
    extractNewsImage('<enclosure url="https://sm.ign.com/video.mp4"/><img src="' + image + '"/>'),
    image,
  );
  assert.equal(extractNewsImage('<img src="javascript:alert(1)"/>'), null);
  assert.equal(extractNewsImage('<img src="https://sm.ign.com.evil.example/game.jpg"/>'), null);
  assert.equal(extractNewsImage('<img src="https://user:password@sm.ign.com/game.jpg"/>'), null);
  assert.equal(extractNewsImage('Sin imagen'), null);
  const row = parseGamingRss(
    item('Juego', 'https://es.ign.com/news/1').replace(
      '</item>',
      '<enclosure url="' + image + '"/></item>',
    ),
    'ign',
    now,
  );
  assert.equal(row[0]?.imageUrl, image);
});
test('Gaming RSS buffer only processes twenty entries per source', () => {
  const xml = Array.from({ length: 25 }, (_, i) =>
    item(`Noticia ${i}`, `https://es.ign.com/news/${i}`),
  ).join('');
  assert.equal(parseGamingRss(xml, 'ign', now).length, 20);
});

test('Anime RSS accepts official article and image hosts and merges chronologically with gaming news', () => {
  const xml = item('Anime &amp; manga', 'https://areajugones.sport.es/anime/estreno').replace(
    '</item>',
    '<media:thumbnail url="https://areajugones.sport.es/wp-content/uploads/cover.jpg"/></item>',
  );
  const anime = parseGamingRss(xml, 'anime', now);
  assert.equal(anime[0]?.source, 'anime');
  assert.equal(anime[0]?.title, 'Anime & manga');
  assert.equal(anime[0]?.imageUrl, 'https://areajugones.sport.es/wp-content/uploads/cover.jpg');
  const ign = parseGamingRss(
    item('Juego', 'https://es.ign.com/news/1', 'Sat, 10 Oct 2026 16:00:00 GMT'),
    'ign',
    now,
  );
  assert.deepEqual(
    combineGamingNews([ign, anime]).map((row) => row.source),
    ['anime', 'ign'],
  );
  assert.deepEqual(
    parseGamingRss(
      item('Host falso', 'https://areajugones.sport.es.evil.example/anime/a'),
      'anime',
      now,
    ),
    [],
  );
  assert.deepEqual(
    parseGamingRss(item('Otra fuente', 'https://es.ign.com/anime/a'), 'anime', now),
    [],
  );
});
