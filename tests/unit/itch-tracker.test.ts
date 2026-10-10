import test from 'node:test';
import assert from 'node:assert/strict';
import {
  itchUrl,
  itchMetadata,
  latestItchDevlog,
  validateItchEdits,
  trackerForDisplay,
  itchUpdateAvailable,
  isReleaseDevlog,
  latestItchRelease,
  itchDownloads,
} from '../../src/domain/itch-tracker.ts';
test('itch news stay visible without release alarms; RSS retains the latest release', () => {
  for (const title of ['Fanart Contest', 'Q&A', 'Feliz San Valentín'])
    assert.equal(isReleaseDevlog(title, null), false);
  for (const title of [
    'Release',
    'Update',
    'Patch',
    'Hotfix',
    'Build',
    'Nueva versión',
    'Actualización',
  ])
    assert.equal(isReleaseDevlog(title, null), true);
  assert.equal(isReleaseDevlog('Anything', '1.8E'), true);
  const rss = `<rss><item><title>Fanart Contest</title><link>${url}/devlog/2/news</link><pubDate>Fri, 09 Oct 2026 10:00:00 GMT</pubDate></item><item><title>Patch 1.8E</title><link>${url}/devlog/1/patch</link><pubDate>Thu, 08 Oct 2026 10:00:00 GMT</pubDate></item></rss>`;
  assert.equal(latestItchDevlog(rss, url)?.title, 'Fanart Contest');
  assert.equal(latestItchRelease(rss, url)?.version, '1.8E');
  assert.equal(
    itchUpdateAvailable({
      currentPlayedVersion: '1.8D',
      latestDetectedVersion: 'Fanart Contest',
      devlog: latestItchDevlog(rss, url),
    }),
    false,
  );
  assert.equal(
    itchUpdateAvailable({
      currentPlayedVersion: '1.8D',
      latestDetectedVersion: '1.8E',
      devlog: latestItchDevlog(rss, url),
      releaseDevlog: latestItchRelease(rss, url),
    }),
    true,
  );
  assert.equal(
    itchUpdateAvailable({
      currentPlayedVersion: '',
      latestDetectedVersion: '',
      devlog: null,
      installerChanged: true,
    }),
    true,
  );
});
test('itch parses public download IDs and sizes without following download actions', () => {
  const html = `<div data-upload_id="99"></div><h2 id="download">Download</h2><div><a data-upload_id="123" href="javascript:void(0)">Download</a><span class="file_size"><span>554 MB</span></span></div><a data-upload_id='124'>Other</a><span class='file_size'>1.5 GB</span><a data-upload_id="123">Duplicate</a><section id="devlog"><a data-upload_id="125">Not a download</a></section>`;
  assert.deepEqual(itchDownloads(html), [
    { uploadId: '123', size: '554 MB' },
    { uploadId: '124', size: '1.5 GB' },
  ]);
  assert.deepEqual(itchDownloads('<p>No downloads</p>'), []);
  assert.deepEqual(
    itchDownloads('<h2 id="download">Download</h2><a data-upload_id="42">File</a>'),
    [{ uploadId: '42', size: null }],
  );
  assert.throws(() => itchDownloads('a'.repeat(1000001)));
});
test('itch update indicator does not call an older detected version a new release', () => {
  const devlog = {
    title: 'Patch 1.8D',
    url: 'https://studio.itch.io/game/devlog/1/patch',
    publishedAt: '2026-10-09T12:00:00Z',
    version: '1.8D',
  };
  assert.equal(
    itchUpdateAvailable({ devlog, latestDetectedVersion: '1.8D', currentPlayedVersion: '1.8E' }),
    false,
  );
  assert.equal(
    itchUpdateAvailable({ devlog, latestDetectedVersion: '1.8D', currentPlayedVersion: 'v1.8C' }),
    true,
  );
  assert.equal(
    itchUpdateAvailable({ devlog, latestDetectedVersion: '1.8D', currentPlayedVersion: '' }),
    false,
  );
});
const url = 'https://studio.itch.io/game';
test('itch URLs restrict upstream requests to canonical HTTPS creator game pages', () => {
  assert.equal(itchUrl(`${url}/?utm_source=test#download`), url);
  for (const input of [
    'http://studio.itch.io/game',
    'https://studio.itch.io.evil.test/game',
    'https://user@studio.itch.io/game',
    'https://studio.itch.io:444/game',
    'https://itch.io/games',
    'https://studio.itch.io/game/devlog',
    'https://127.0.0.1/game',
    'https://studio.itch.io\\@evil.test/game',
  ])
    assert.throws(() => itchUrl(input));
});
test('itch metadata filters image origins and tolerates absent optional fields', () => {
  const metadata = itchMetadata(
    {
      id: 123,
      title: 'Indie',
      authors: [{ name: 'Studio' }],
      cover_image: 'https://img.itch.zone/cover.png',
      tags: ['rpg', null],
      screenshots: ['https://img.itch.zone/shot.png', 'https://evil.test/shot.png'],
    },
    url,
  );
  assert.equal(metadata.author, 'Studio');
  assert.equal(metadata.screenshots.length, 1);
  assert.deepEqual(metadata.tags, ['rpg']);
  assert.equal(
    itchMetadata({ id: 1, title: 'Indie', cover_image: 'javascript:evil()' }, url).coverImage,
    null,
  );
  assert.throws(() => itchMetadata({ id: 'invalid', title: 'Indie' }, url));
});
test('RSS selects the newest valid devlog and does not invent version numbers', () => {
  const item = (title: string, date: string, link: string) =>
    `<item><title><![CDATA[${title}]]></title><link>${link}</link><pubDate>${date}</pubDate></item>`;
  const rss = `<rss><channel>${item('Version 1.8E &amp; patch', 'Thu, 08 Oct 2026 10:00:00 GMT', `${url}/devlog/2/update`)}${item('Old 1.7', 'Wed, 07 Oct 2026 10:00:00 GMT', `${url}/devlog/1/old`)}${item('Fake 9.0', 'Fri, 09 Oct 2026 10:00:00 GMT', 'https://evil.test/game/devlog/3/fake')}</channel></rss>`;
  assert.equal(latestItchDevlog(rss, url)?.version, '1.8E');
  assert.equal(latestItchDevlog(rss, url)?.title, 'Version 1.8E & patch');
  assert.equal(
    latestItchDevlog(
      `<rss>${item('Developer diary', 'Thu, 08 Oct 2026 10:00:00 GMT', `${url}/devlog/2/diary`)}</rss>`,
      url,
    )?.version,
    null,
  );
  assert.equal(latestItchDevlog('<rss><channel/></rss>', url), null);
  assert.throws(() => latestItchDevlog('<!DOCTYPE rss><rss/>', url));
});
test('itch edits enforce private note and milestone limits and display stored state', () => {
  const id = '00000000-0000-4000-8000-000000000000';
  const edits = {
    currentPlayedVersion: '1.7',
    status: 'playing',
    privateNotes: 'private checkpoint',
    milestones: [{ id, title: 'Explore', completed: true }],
  };
  assert.equal(validateItchEdits(edits).private_notes, 'private checkpoint');
  assert.throws(() =>
    validateItchEdits({ ...edits, milestones: [edits.milestones[0], edits.milestones[0]] }),
  );
  assert.throws(() => validateItchEdits({ ...edits, privateNotes: 'a'.repeat(5001) }));
  assert.throws(() => validateItchEdits({ ...edits, status: 'invalid' }));
  const displayed = trackerForDisplay({
    id,
    user_id: id,
    url,
    metadata: {
      ...itchMetadata({ id: 1, title: 'Indie' }, url),
      devlog: null,
      devlogAvailable: true,
    },
    ...validateItchEdits(edits),
    last_checked_at: '2026-10-09T12:00:00Z',
  });
  assert.equal(displayed.id, id);
  assert.equal(displayed.itchId, '1');
  assert.equal(displayed.latestDetectedVersion, '');
});
