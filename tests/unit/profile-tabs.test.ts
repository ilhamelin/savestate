import test from 'node:test';
import assert from 'node:assert/strict';
import { PROFILE_TAB_ANCHORS, profileTabForHash } from '../../src/domain/profile-tabs.ts';

test('Profile tabs reveal direct links and keep existing showcase notification links valid', () => {
  for (const [tab, anchor] of Object.entries(PROFILE_TAB_ANCHORS)) {
    assert.equal(profileTabForHash(`#${anchor}`), tab);
  }
  assert.equal(profileTabForHash('#player-stats'), 'stats');
  assert.equal(profileTabForHash('#achievements-showcase-heading'), 'showcase');
  for (const hash of ['', '#player-friends', '#player-badges', '#unknown'])
    assert.equal(profileTabForHash(hash), null);
});
