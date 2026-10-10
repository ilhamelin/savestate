import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newsText,
  newsAge,
  parseGamingRss,
  combineGamingNews,
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
test('Gaming news sorts across sources, deduplicates links and caps the wire at twelve', () => {
  const rows = Array.from(
    { length: 15 },
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
  assert.equal(result.length, 12);
  assert.equal(result[0]?.title, 'Noticia 0');
  assert.equal(result.at(-1)?.title, 'Noticia 11');
  assert.equal(newsAge('2026-10-10T16:00:00Z', now), 'HACE 2H');
  assert.equal(newsAge('2026-10-09T18:00:00Z', now), 'HACE 1D');
  assert.equal(newsAge('2026-10-10T19:00:00Z', now), 'AHORA');
  assert.equal(newsAge('invalid', now), '');
  assert.deepEqual(combineGamingNews([]), []);
});
