import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_VOICE_CHANNELS,
  voiceChannel,
  voiceServerUrl,
  voiceConnectSources,
  voiceMicEnabled,
  voiceAvatar,
} from '../../src/domain/voice.ts';

test('voice restricts channels and secure signalling origins without CSP injection', () => {
  assert.deepEqual(
    DEFAULT_VOICE_CHANNELS.map((channel) => [channel.id, channel.maxParticipants]),
    [
      ['ch-lobby', 16],
      ['ch-squad', 6],
      ['ch-chill', 10],
    ],
  );
  for (const input of [null, {}, 'ch-coop', 'private-room', 'ch-lobby; roomAdmin'])
    assert.throws(() => voiceChannel(input));
  assert.equal(voiceServerUrl('https://radio.livekit.cloud/'), 'wss://radio.livekit.cloud');
  assert.equal(voiceServerUrl('ws://localhost:7880', true), 'ws://localhost:7880');
  for (const input of [
    'ws://localhost:7880',
    'http://radio.livekit.cloud',
    'wss://user:secret@radio.livekit.cloud',
    'wss://radio.livekit.cloud?token=foo',
    'wss://radio.livekit.cloud/path',
    'wss://radio.livekit.cloud; script-src *',
  ])
    assert.equal(voiceServerUrl(input), null);
  assert.equal(
    voiceConnectSources('wss://radio.livekit.cloud'),
    'wss://radio.livekit.cloud https://radio.livekit.cloud wss://*.livekit.cloud https://*.livekit.cloud',
  );
  assert.equal(
    voiceConnectSources('wss://voice.example.test'),
    'wss://voice.example.test https://voice.example.test',
  );
  assert.equal(voiceConnectSources('invalid'), '');
});
test('voice microphone obeys mute, deafen and push-to-talk release', () => {
  for (const muted of [true, false])
    for (const deafened of [true, false])
      for (const mode of ['continuous', 'push-to-talk'] as const)
        for (const held of [true, false]) {
          assert.equal(
            voiceMicEnabled(muted, deafened, mode, held),
            !muted && !deafened && (mode === 'continuous' || held),
          );
        }
  assert.equal(voiceMicEnabled(false, false, 'push-to-talk', false), false);
  assert.equal(voiceMicEnabled(false, true, 'continuous', true), false);
});
test('voice avatars tolerate malformed metadata and never load arbitrary origins', () => {
  const storage = 'https://demo.supabase.co';
  assert.equal(
    voiceAvatar(
      JSON.stringify({ avatarUrl: storage + '/storage/v1/object/public/profiles/avatar.webp' }),
      storage,
    ),
    storage + '/storage/v1/object/public/profiles/avatar.webp',
  );
  assert.equal(
    voiceAvatar(JSON.stringify({ avatarUrl: '/avatars/arcade.svg' }), storage),
    '/avatars/arcade.svg',
  );
  for (const input of [
    undefined,
    '{',
    JSON.stringify(null),
    JSON.stringify({ avatarUrl: 'javascript:alert(1)' }),
    JSON.stringify({ avatarUrl: 'https://evil.test/avatar.png' }),
  ])
    assert.equal(voiceAvatar(input, storage), null);
});
