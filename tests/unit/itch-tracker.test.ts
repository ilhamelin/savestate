import test from 'node:test';
import assert from 'node:assert/strict';
import {
  itchUrl,
  itchMetadata,
  latestItchDevlog,
  validateItchEdits,
  trackerForDisplay,
  itchUpdateAvailable,
} from '../../src/domain/itch-tracker.ts';
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
