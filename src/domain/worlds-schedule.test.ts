import test from 'node:test';
import assert from 'node:assert/strict';
import {
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
