import test from 'node:test';
import assert from 'node:assert/strict';
import { trackerUid, socialLinks, splitSocialAndTrackerLinks } from '../validation.ts';
import { profileDraft, profileChanged } from '../profile-studio.ts';
import { recentTrackerUids, trackerLink } from '../tracker-accounts.ts';
test('Tracker UIDs accept only 9-10 digit strings and can be cleared without storing empty keys', () => {
  assert.equal(trackerUid(' 607358180 ', 'UID'), '607358180');
  assert.equal(trackerUid('1000000001', 'UID'), '1000000001');
  for (const input of [undefined, null, '', '   ']) assert.equal(trackerUid(input, 'UID'), null);
  for (const input of [607358180, {}, [], 'abcdefghi', '12345678', '12345678901', '123456789/'])
    assert.throws(() => trackerUid(input, 'UID'), /9 o 10 dígitos/);
  assert.deepEqual(
    socialLinks({
      genshin_uid: '607358180',
      hsr_uid: '1000000001',
      github: 'https://github.com/player',
    }),
    { genshin_uid: '607358180', hsr_uid: '1000000001', github: 'https://github.com/player' },
  );
  assert.deepEqual(socialLinks({ genshin_uid: '', hsr_uid: null }), {});
  assert.throws(() => socialLinks({ hsr_uid: 'not-numeric' }));
  assert.throws(() => socialLinks({ genshin_uid: 607358180 }));
});
test('Social display separates public UIDs from validated HTTPS links and ignores hostile stored data', () => {
  assert.deepEqual(
    splitSocialAndTrackerLinks({
      genshin_uid: '607358180',
      hsr_uid: '1000000001',
      github: 'https://github.com/player',
      x: 'javascript:alert(1)',
      _savestate_appearance: 'private',
      evil: 'https://evil.test',
    }),
    {
      externalLinks: { github: 'https://github.com/player' },
      genshinUid: '607358180',
      hsrUid: '1000000001',
    },
  );
  assert.deepEqual(
    splitSocialAndTrackerLinks({
      genshin_uid: 'https://evil.test',
      hsr_uid: '123',
      steam: 'https://steamcommunity.com.evil.test/id/player',
    }),
    { externalLinks: {}, genshinUid: null, hsrUid: null },
  );
});
test('Profile drafts retain tracker IDs, detect edits/clears and keep saved drafts isolated', () => {
  const saved = profileDraft({
    username: 'player',
    avatar_url: null,
    banner_url: null,
    wallpaper_url: null,
    theme_color: 'cyan',
    room_theme: 'crt_terminal',
    terminal_status: '',
    library_private: false,
    owned_platforms: [],
    social_links: {
      genshin_uid: '607358180',
      hsr_uid: '600000124',
      github: 'https://github.com/player',
    },
  });
  const draft = profileDraft(saved);
  assert.equal(profileChanged(draft, saved), false);
  draft.social_links.genshin_uid = '607358181';
  assert.equal(profileChanged(draft, saved), true);
  assert.equal(saved.social_links.genshin_uid, '607358180');
  assert.equal(
    profileChanged({ ...saved, social_links: { ...saved.social_links, hsr_uid: '' } }, saved),
    true,
  );
  assert.equal(socialLinks(draft.social_links).hsr_uid, '600000124');
});
test('Tracker history is bounded, deduplicated and rejects malformed local storage values', () => {
  assert.deepEqual(recentTrackerUids(null), []);
  assert.deepEqual(recentTrackerUids({}), []);
  assert.deepEqual(recentTrackerUids(['607358180', 'bad', 607358181, '607358180'], '600000124'), [
    '600000124',
    '607358180',
  ]);
  const rows = Array.from({ length: 8 }, (_, index) => String(600000100 + index));
  assert.deepEqual(recentTrackerUids(rows, rows[4]), [rows[4], ...rows.slice(0, 4)]);
});
test('Tracker deep links validate identities and retain the destination through login', () => {
  assert.deepEqual(trackerLink({ game: 'genshin', uid: '607358180' }), {
    tab: 'genshin',
    identity: '607358180',
    error: null,
    next: '/rift?game=genshin&uid=607358180',
  });
  assert.equal(trackerLink({ game: 'hsr', uid: '1000000001' }).identity, '1000000001');
  assert.equal(
    trackerLink({ game: 'rust', uid: '76561198000000001' }).identity,
    '76561198000000001',
  );
  assert.equal(trackerLink({ game: 'valorant', uid: 'Player#TAG' }).identity, 'Player#TAG');
  for (const params of [
    { game: 'hsr', uid: ['1000000001', '600000124'] },
    { game: 'genshin', uid: 'evil' },
    { game: 'rust', uid: 'https://evil.test' },
  ]) {
    const link = trackerLink(params);
    assert.equal(link.identity, undefined);
    assert.ok(link.error);
    assert.ok(!link.next.includes('uid='));
  }
  assert.equal(trackerLink({ game: 'bad' }).tab, 'lol');
});
