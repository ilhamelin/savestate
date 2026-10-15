import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  WORLDS_ANTHEMS,
  KDA_TRACKS,
  ALL_WORLDS_TRACKS,
  worldsMusicUrl,
  trackThumbnailUrl,
  nextTrackIndex,
  prevTrackIndex,
  worldsViewModeForKey,
  type WorldsViewMode,
  WORLDS_BROADCAST_SIGNALS,
  buildWorldsFrameUrl,
} from '../../src/domain/worlds-features.ts';

test('Worlds soundtrack contains eleven verified official uploads with matching years and titles', () => {
  assert.deepEqual(
    WORLDS_ANTHEMS.map(({ year, title, id }) => [year, title, id]),
    [
      [2026, 'Know My Name', 'mlFxxNsExJc'],
      [2025, 'Sacrifice', 'pzt6SmvGpXk'],
      [2024, 'Heavy Is The Crown', '5FrhtahQiRc'],
      [2023, 'GODS', 'C3GouGa0noM'],
      [2022, "STAR WALKIN'", 'HYsz1hP0BFo'],
      [2021, 'Burn It All Down', '1Z6CHioIn3s'],
      [2020, 'Take Over', 'KbNL9ZyB49c'],
      [2019, 'Phoenix', 'i1IKnWDecwA'],
      [2018, 'RISE', 'fB8TyLTD7EE'],
      [2017, 'Legends Never Die', '4Q46xYqUwZQ'],
      [2014, 'Warriors', 'fmI_Ndrxy14'],
    ],
  );
  assert.equal(WORLDS_ANTHEMS.length, 11);
  assert.equal(new Set(WORLDS_ANTHEMS.map(({ id }) => id)).size, 11);
  assert.equal(new Set(WORLDS_ANTHEMS.map(({ year }) => year)).size, 11);
  for (const track of WORLDS_ANTHEMS) {
    assert.match(track.id, /^[\w-]{11}$/);
    assert.ok(track.artist);
  }
});
test('K/DA catalogue contains six official tracks and the combined catalogue has seventeen unique valid IDs', () => {
  assert.deepEqual(
    KDA_TRACKS.map(({ year, title, id }) => [year, title, id]),
    [
      [2018, 'POP/STARS', 'UOxkGD8qRB4'],
      [2020, 'MORE', '3VTkBuxU4yk'],
      [2020, 'THE BADDEST', 'RkID8_gnTxw'],
      [2020, 'VILLAIN', 'xoWxv2yZXLQ'],
      [2020, 'DRUM GO DUM', 'E_PbH5y70Tc'],
      [2020, "I'LL SHOW YOU", 'WW1BpABbzHs'],
    ],
  );
  assert.equal(KDA_TRACKS.length, 6);
  assert.equal(ALL_WORLDS_TRACKS.length, 17);
  assert.equal(new Set(ALL_WORLDS_TRACKS.map(({ id }) => id)).size, 17);
  assert.deepEqual(ALL_WORLDS_TRACKS, [...WORLDS_ANTHEMS, ...KDA_TRACKS]);
  for (const track of ALL_WORLDS_TRACKS) {
    assert.match(track.id, /^[\w-]{11}$/);
    const url = new URL(worldsMusicUrl(track.id, 'https://savestate.example'));
    assert.equal(url.origin, 'https://www.youtube.com');
    assert.equal(url.pathname, `/embed/${track.id}`);
  }
});
test('Worlds modes toggle exclusively with case-insensitive shortcuts and Escape always restores normal', () => {
  for (const mode of ['normal', 'cinema', 'theater'] as WorldsViewMode[]) {
    assert.equal(worldsViewModeForKey(mode, 'Escape'), 'normal');
    assert.equal(worldsViewModeForKey(mode, 'x'), mode);
    for (const key of ['c', 'C'])
      assert.equal(worldsViewModeForKey(mode, key), mode === 'cinema' ? 'normal' : 'cinema');
    for (const key of ['t', 'T'])
      assert.equal(worldsViewModeForKey(mode, key), mode === 'theater' ? 'normal' : 'theater');
  }
});
test('Worlds embeds use the official YouTube host, bind origin and reject unknown videos', () => {
  const url = new URL(worldsMusicUrl(WORLDS_ANTHEMS[0].id, 'https://savestate.example'));
  assert.equal(url.origin, 'https://www.youtube.com');
  assert.equal(url.searchParams.get('autoplay'), '1');
  assert.equal(url.searchParams.get('enablejsapi'), '1');
  assert.equal(url.searchParams.get('playsinline'), '1');
  assert.equal(url.searchParams.get('rel'), '0');
  assert.equal(url.searchParams.get('origin'), 'https://savestate.example');
  assert.throws(() => worldsMusicUrl('../bad', 'https://savestate.example'));
});
test('Worlds official embed host is permitted in frame-src without removing existing providers', () => {
  const proxy = readFileSync(new URL('../../src/proxy.ts', import.meta.url), 'utf8');
  const frames = proxy.match(/frame-src ([^;]+);/)?.[1]?.split(/\s+/) ?? [];
  assert.ok(frames.includes('https://www.youtube.com'));
  assert.ok(frames.includes('https://www.youtube-nocookie.com'));
  assert.ok(frames.includes('https://player.twitch.tv'));
  assert.ok(frames.includes('https://lolesports.com'));
  assert.ok(!frames.includes('*'));
});

test('Worlds artwork uses official thumbnails and rejects unknown tracks', () => {
  for (const track of ALL_WORLDS_TRACKS)
    assert.equal(trackThumbnailUrl(track.id), `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`);
  assert.throws(() => trackThumbnailUrl('../unknown'));
  const proxy = readFileSync(new URL('../../src/proxy.ts', import.meta.url), 'utf8');
  assert.ok(
    proxy
      .match(/img-src ([^;]+);/)?.[1]
      ?.split(/\s+/)
      .includes('https://i.ytimg.com'),
  );
});
test('Worlds transport wraps in both directions across all tracks and handles an empty catalogue', () => {
  assert.equal(nextTrackIndex(0, 17), 1);
  assert.equal(nextTrackIndex(16, 17), 0);
  assert.equal(prevTrackIndex(0, 17), 16);
  assert.equal(prevTrackIndex(5, 17), 4);
  assert.equal(nextTrackIndex(0, 0), 0);
  assert.equal(prevTrackIndex(0, 0), 0);
  for (let index = 0; index < ALL_WORLDS_TRACKS.length; index++)
    assert.equal(prevTrackIndex(nextTrackIndex(index, 17), 17), index);
});

test('Worlds broadcast signals replace inactive LLA channel with verified YouTube stream and provide Demacia Cup tab', () => {
  const ids = WORLDS_BROADCAST_SIGNALS.map((s) => s.id);
  assert.ok(ids.includes('lvpes'));
  assert.ok(ids.includes('latam-yt'));
  assert.ok(ids.includes('riotgames'));
  assert.ok(ids.includes('demacia-cup'));
  assert.ok(!ids.includes('lla'), 'El canal de Twitch lla ya no debe estar configurado');

  const latam = WORLDS_BROADCAST_SIGNALS.find((s) => s.id === 'latam-yt');
  assert.equal(latam?.kind, 'youtube');
  assert.equal(latam?.videoId, 'iFmz2yFuQbw');
  assert.equal(latam?.href, 'https://www.youtube.com/watch?v=iFmz2yFuQbw');

  const demacia = WORLDS_BROADCAST_SIGNALS.find((s) => s.id === 'demacia-cup');
  assert.equal(demacia?.kind, 'external');
  assert.equal(demacia?.href, 'https://lolesports.com/es-MX/live/demacia_cup/104481098073348078');

  // Verify frame URL builder
  const ytUrl = buildWorldsFrameUrl(latam!, 'localhost');
  assert.equal(ytUrl, 'https://www.youtube-nocookie.com/embed/iFmz2yFuQbw?autoplay=0&rel=0');

  const lvpes = WORLDS_BROADCAST_SIGNALS.find((s) => s.id === 'lvpes')!;
  const twitchUrl = buildWorldsFrameUrl(lvpes, 'savestate.test');
  assert.match(twitchUrl ?? '', /player\.twitch\.tv/);
  assert.match(twitchUrl ?? '', /channel=lvpes/);

  const demaciaUrl = buildWorldsFrameUrl(demacia!, 'savestate.test');
  assert.equal(demaciaUrl, 'https://lolesports.com/es-MX/live/demacia_cup/104481098073348078');

  const vodUrl = buildWorldsFrameUrl(latam!, 'localhost', 'vod12345678');
  assert.equal(vodUrl, 'https://www.youtube-nocookie.com/embed/vod12345678');
});
