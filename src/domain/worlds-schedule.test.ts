import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseWorldsTeamRoster,
  parseWorldsGameTelemetry,
  FALLBACK_WORLDS_2026_ROSTERS,
  parseWorldsScheduleEvents,
  worldsImageUrl,
  groupWorldsEventsByStage,
  pickDefaultWorldsMatch,
  parseWorldsMatchDetail,
  describeWorldsMatch,
  isPlaceholderTeam,
} from './worlds-schedule.ts';
const team = (name = 'Cloud9 Kia', code = 'C9') => ({
  id: code,
  name,
  code,
  image: `http://static.lolesports.com/teams/${code}.png`,
  result: { gameWins: 0 },
});
test('Worlds rosters normalize roles and photos, keep rotation players and reject unknown or placeholder teams', () => {
  const roster = parseWorldsTeamRoster({
    id: '123',
    name: 'Team',
    code: 'team',
    homeLeague: { name: 'LCS' },
    players: [
      {
        id: '1',
        summonerName: ' Jungler ',
        role: 'JNG',
        image: 'http://static.lolesports.com/players/photo.png',
      },
      {
        id: '2',
        summonerName: 'Top',
        role: 'top',
        image: 'https://static.lolesports.com/players/default-headshot.png',
      },
      { id: '3', summonerName: 'Rotation', role: 'jungle' },
      { id: '4', summonerName: 'Coach', role: 'coach' },
    ],
  });
  assert.equal(roster?.code, 'TEAM');
  assert.equal(roster?.homeLeague, 'LCS');
  assert.deepEqual(
    roster?.players.map((player) => player.role),
    ['top', 'jungle', 'jungle'],
  );
  assert.equal(roster?.players[0]?.imageUrl, null);
  assert.equal(roster?.players[1]?.imageUrl, 'https://static.lolesports.com/players/photo.png');
  assert.equal(parseWorldsTeamRoster({ id: '1', name: 'TBD', code: 'TBD' }), null);
  assert.deepEqual(
    FALLBACK_WORLDS_2026_ROSTERS.C9?.players
      .filter((p) => p.role === 'bottom')
      .map((p) => p.summonerName),
    ['Zven', 'Tactical'],
  );
  assert.equal(Object.keys(FALLBACK_WORLDS_2026_ROSTERS).length, 4);
});
test('Worlds telemetry computes duration, objectives, KDA, KP and gold shares with one estimated MVP', () => {
  const meta = {
    patchVersion: '16.17',
    blueTeamMetadata: {
      participantMetadata: [
        { participantId: 1, summonerName: 'Top', role: 'top', championId: 'Renekton' },
        { participantId: 2, summonerName: 'Jungle', role: 'jungle', championId: 'Vi' },
      ],
    },
    redTeamMetadata: {
      participantMetadata: [
        { participantId: 6, summonerName: 'Enemy', role: 'top', championId: 'Aurora' },
      ],
    },
  };
  const last = {
    gameState: 'finished',
    rfc460Timestamp: '2026-10-15T12:40:00Z',
    blueTeam: {
      totalGold: 75000,
      totalKills: 22,
      towers: 11,
      barons: 2,
      inhibitors: 1,
      dragons: ['hextech', 'infernal'],
      participants: [
        {
          participantId: 1,
          level: 18,
          kills: 4,
          deaths: 3,
          assists: 8,
          creepScore: 342,
          totalGold: 15000,
        },
        {
          participantId: 2,
          level: 18,
          kills: 6,
          deaths: 1,
          assists: 14,
          creepScore: 250,
          totalGold: 20000,
        },
      ],
    },
    redTeam: {
      totalGold: 55000,
      totalKills: 8,
      towers: 1,
      barons: 0,
      inhibitors: 0,
      dragons: ['mountain'],
      participants: [
        { participantId: 6, level: 17, kills: 8, deaths: 0, assists: 7, totalGold: 15000 },
      ],
    },
  };
  const telemetry = parseWorldsGameTelemetry(
    '123',
    1,
    { gameMetadata: meta, frames: [last] },
    '2026-10-15T12:00:00Z',
  );
  assert.equal(telemetry?.durationSeconds, 2400);
  assert.equal(telemetry?.gameState, 'finished');
  assert.equal(telemetry?.blueTeam.barons, 2);
  assert.deepEqual(telemetry?.blueTeam.dragons, ['hextech', 'infernal']);
  const player = telemetry?.bluePlayers[0];
  assert.equal(player?.kdaRatio, 4);
  assert.equal(player?.killParticipationPct, 55);
  assert.equal(player?.goldSharePct, 20);
  assert.equal(player?.creepScore, 342);
  assert.match(player?.championIconUrl ?? '', /16\.17\.1\/img\/champion\/Renekton\.png$/);
  assert.equal(telemetry?.bluePlayers.find((p) => p.isMvp)?.participantId, 2);
  assert.equal(telemetry?.redPlayers[0]?.kdaRatio, 15);
  assert.equal(telemetry?.redPlayers[0]?.isMvp, false);
  assert.equal(
    parseWorldsGameTelemetry('123', 1, {
      frames: [
        {
          rfc460Timestamp: '2026-10-15T12:00:00Z',
          gameState: 'unstarted',
          blueTeam: { totalGold: 0, totalKills: 0 },
          redTeam: { totalGold: 0, totalKills: 0 },
        },
      ],
    }),
    null,
  );
  assert.equal(parseWorldsGameTelemetry('../bad', 1, {}), null);
  assert.equal(parseWorldsGameTelemetry('123', 1, { frames: [] }), null);
});
const event = (
  id = '1',
  blockName = 'Play-ins',
  startTime = '2026-10-15T18:00:00Z',
  state = 'unstarted',
  teams = [team(), team('Karmine Corp', 'KC')],
) => ({
  startTime,
  state,
  blockName,
  league: { slug: 'worlds' },
  match: { id, teams, strategy: { count: 5 } },
});
test('Worlds preserves real teams and HTTPS logos, hides every unresolved matchup and unsafe image', () => {
  const rows = parseWorldsScheduleEvents([
    event(),
    event('2', 'Swiss', '2026-10-23T18:00:00Z', 'unstarted', [team(), team('TBD', 'TBD')]),
  ]);
  assert.equal(rows[0]?.hasConfirmedTeams, true);
  assert.equal(rows[0]?.teams?.[0].name, 'Cloud9 Kia');
  assert.equal(rows[0]?.teams?.[1].imageUrl, 'https://static.lolesports.com/teams/KC.png');
  assert.equal(rows[1]?.hasConfirmedTeams, false);
  assert.equal(rows[1]?.teams, null);
  assert.equal(worldsImageUrl('https://static.lolesports.com/teams/team-tbd.png'), null);
  assert.equal(worldsImageUrl('https://static.lolesports.com.evil.example/logo.png'), null);
  assert.equal(worldsImageUrl('javascript:alert(1)'), null);
  for (const value of [{}, team('tbd', 'C9'), team('Por definir', 'C9'), team('C9', ' tBd ')])
    assert.ok(isPlaceholderTeam(value));
});
test('Worlds filters year/league/malformed events, groups five stages and prioritizes live, future and last completed', () => {
  const rows = parseWorldsScheduleEvents([
    event('5', 'Final', '2026-11-14T19:00:00Z'),
    event('1'),
    event('2', 'Swiss', '2026-10-23T18:00:00Z'),
    event('3', 'Cuartos de final', '2026-11-03T18:00:00Z'),
    event('4', 'Semifinales', '2026-11-07T18:00:00Z'),
    event('old', 'Swiss', '2025-10-23T18:00:00Z'),
    { ...event('6'), league: { slug: 'lck' } },
    event('bad'),
    event('7', 'Other'),
  ]);
  assert.equal(rows.length, 5);
  assert.deepEqual(
    groupWorldsEventsByStage(rows).map((s) => s.slug),
    ['play-ins', 'swiss', 'quarterfinals', 'semifinals', 'final'],
  );
  assert.equal(pickDefaultWorldsMatch(rows, Date.parse('2026-10-16'))?.id, '2');
  assert.equal(
    pickDefaultWorldsMatch(
      rows.map((e) => (e.id === '4' ? { ...e, state: 'inProgress' } : e)),
      Date.parse('2026-10-16'),
    )?.id,
    '4',
  );
  assert.equal(
    pickDefaultWorldsMatch(
      rows.map((e) => ({ ...e, state: 'completed' })),
      Date.parse('2026-12-01'),
    )?.id,
    '5',
  );
  assert.equal(pickDefaultWorldsMatch([]), null);
});
test('Worlds details preserve map sides and validate official VOD ids without exposing pending teams', () => {
  const detail = parseWorldsMatchDetail({
    id: '1',
    league: { slug: 'worlds' },
    match: {
      teams: [team(), team('Karmine Corp', 'KC')],
      games: [
        {
          number: 1,
          state: 'completed',
          teams: [
            { id: 'C9', side: 'blue' },
            { id: 'KC', side: 'red' },
          ],
          vods: [
            { provider: 'youtube', parameter: 'abcdefghijk', locale: 'es-ES' },
            { provider: 'youtube', parameter: '../../evil' },
          ],
        },
      ],
    },
  });
  assert.equal(detail?.games[0]?.blueTeamId, 'C9');
  assert.equal(detail?.games[0]?.vods.length, 1);
  const match = parseWorldsScheduleEvents([event()])[0]!;
  assert.match(describeWorldsMatch(match, detail).description, /Cloud9 Kia y Karmine Corp/);
  const pending = { ...match, teams: null, hasConfirmedTeams: false };
  assert.equal(describeWorldsMatch(pending, detail).teams, null);
  assert.doesNotMatch(describeWorldsMatch(pending, detail).description, /TBD/);
  assert.equal(parseWorldsMatchDetail({ id: '1', league: { slug: 'lck' } }), null);
});
