import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import {
  getAchievementTier,
  getTierLabel,
  cleanText,
  sanitizeSteamImageUrl,
  calculateAchievementSummary,
} from '../../src/domain/game-achievements.ts';
import type {
  AchievementTier,
  GameAchievementItem,
  GameAchievementsReport,
} from '../../src/domain/game-achievements.ts';

test('getAchievementTier categorizes achievements by unlock percentage and master flag', () => {
  assert.equal(getAchievementTier(5.2), 'platino');
  assert.equal(getAchievementTier(9.9), 'platino');
  assert.equal(getAchievementTier(10.0), 'oro');
  assert.equal(getAchievementTier(24.9), 'oro');
  assert.equal(getAchievementTier(25.0), 'plata');
  assert.equal(getAchievementTier(49.9), 'plata');
  assert.equal(getAchievementTier(50.0), 'bronce');
  assert.equal(getAchievementTier(88.4), 'bronce');

  // Master flag forces platino even if percentage is higher
  assert.equal(getAchievementTier(35.0, true), 'platino');
});

test('getTierLabel returns Spanish descriptors for every tier', () => {
  assert.equal(getTierLabel('platino'), 'Platino (Ultra Raro)');
  assert.equal(getTierLabel('oro'), 'Oro (Muy Raro)');
  assert.equal(getTierLabel('plata'), 'Plata (Raro)');
  assert.equal(getTierLabel('bronce'), 'Bronce (Común)');
});

test('cleanText removes HTML tags and trims whitespace', () => {
  assert.equal(cleanText('<b>Gran Cazador</b>'), 'Gran Cazador');
  assert.equal(cleanText('  Vence a todos los jefes.\n\n  '), 'Vence a todos los jefes.');
  assert.equal(cleanText(null), '');
  assert.equal(cleanText(undefined), '');
  assert.equal(cleanText(123), '');
});

test('sanitizeSteamImageUrl validates official Steam CDN hosts and rejects untrusted sources', () => {
  assert.equal(
    sanitizeSteamImageUrl(
      'https://shared.fastly.steamstatic.com/community_assets/images/apps/1245620/icon.jpg',
    ),
    'https://shared.fastly.steamstatic.com/community_assets/images/apps/1245620/icon.jpg',
  );
  assert.equal(
    sanitizeSteamImageUrl(
      'https://shared.akamai.steamstatic.com/community_assets/images/apps/1245620/icon.jpg',
    ),
    'https://shared.akamai.steamstatic.com/community_assets/images/apps/1245620/icon.jpg',
  );

  assert.equal(sanitizeSteamImageUrl('http://shared.fastly.steamstatic.com/icon.jpg'), '');
  assert.equal(sanitizeSteamImageUrl('javascript:alert(1)'), '');
  assert.equal(sanitizeSteamImageUrl('https://evil.attacker.com/malicious.jpg'), '');
  assert.equal(sanitizeSteamImageUrl(''), '');
  assert.equal(sanitizeSteamImageUrl(null), '');
});

test('calculateAchievementSummary calculates counts, average unlock rate and identifies rarest', () => {
  const sampleItems: GameAchievementItem[] = [
    {
      id: '1',
      apiName: 'ACH01',
      name: 'Círculo de Elden',
      description: 'Has conseguido todos los logros',
      hidden: false,
      iconUrl: 'https://shared.fastly.steamstatic.com/icon1.jpg',
      unlockedPercentage: 10.5,
      tier: 'platino',
    },
    {
      id: '2',
      apiName: 'ACH02',
      name: 'Señor del Círculo',
      description: 'Final alternativo',
      hidden: true,
      iconUrl: 'https://shared.fastly.steamstatic.com/icon2.jpg',
      unlockedPercentage: 22.0,
      tier: 'oro',
    },
    {
      id: '3',
      apiName: 'ACH03',
      name: 'Márgit superado',
      description: 'Has derrotado a Márgit',
      hidden: false,
      iconUrl: 'https://shared.fastly.steamstatic.com/icon3.jpg',
      unlockedPercentage: 75.0,
      tier: 'bronce',
    },
  ];

  const summary = calculateAchievementSummary(sampleItems);
  assert.equal(summary.total, 3);
  assert.equal(summary.platinoCount, 1);
  assert.equal(summary.oroCount, 1);
  assert.equal(summary.plataCount, 0);
  assert.equal(summary.bronceCount, 1);
  assert.equal(summary.hiddenCount, 1);
  assert.equal(summary.averageUnlockRate, 35.8);
  assert.equal(summary.rarestAchievement?.apiName, 'ACH01');

  const emptySummary = calculateAchievementSummary([]);
  assert.equal(emptySummary.total, 0);
  assert.equal(emptySummary.averageUnlockRate, 0);
  assert.equal(emptySummary.rarestAchievement, null);
});

const fixture =
  'data:text/javascript,' +
  encodeURIComponent(`
  export const state = { cache:new Map(), options:[] };
  export function unstable_cache(fn,key,options){
    state.options.push({key,options});
    return async (...args)=>{
      const k=JSON.stringify([key,args]);
      if(!state.cache.has(k))state.cache.set(k,fn(...args));
      return state.cache.get(k);
    };
  }
`);

const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only' || specifier.endsWith('.css'))
      return { url: 'data:text/javascript,export {};', shortCircuit: true };
    if (specifier === 'next/cache') return { url: fixture, shortCircuit: true };
    if (specifier.startsWith('@/')) {
      const file = resolve('src', specifier.slice(2));
      return {
        url: pathToFileURL(existsSync(file + '.tsx') ? file + '.tsx' : file + '.ts').href,
        shortCircuit: true,
      };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('file:') && /\.tsx?$/.test(url) && !url.includes('node_modules'))
      return {
        format: 'module',
        source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
            jsx: ts.JsxEmit.ReactJSX,
          },
        }).outputText,
        shortCircuit: true,
      };
    return next(url, context);
  },
});

const originalFetch = globalThis.fetch;

after(() => {
  globalThis.fetch = originalFetch;
  hooks.deregister();
});

const { fetchGameAchievements } = await import('../../src/services/game-achievements-service.ts');
const { GameAchievementsView } = await import('../../src/components/game-achievements.tsx');

function setupMock(scenario: { hasAchievements?: boolean; notFound?: boolean } = {}) {
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (url.includes('/storesearch/')) {
      if (scenario.notFound) return Response.json({ items: [] });
      return Response.json({ items: [{ id: 1245620, name: 'Elden Ring', type: 'app' }] });
    }

    if (url.includes('steamcommunity.com/stats/')) {
      if (scenario.hasAchievements === false) {
        return new Response('Not found', { status: 404 });
      }

      const mockValveSsr = {
        renderContext: {
          queryData: JSON.stringify({
            queries: [
              {
                queryKey: ['achievements', 1245620, 'schema'],
                state: {
                  data: {
                    groups: [
                      {
                        achievements: [
                          {
                            internal_key: 101,
                            api_name: 'ACH_CIRCLE',
                            name: 'Círculo de Elden',
                            description: 'Has conseguido todos los logros',
                            hidden: false,
                            icon_achieved:
                              'https://shared.fastly.steamstatic.com/community_assets/images/apps/1245620/icon1.jpg',
                          },
                          {
                            internal_key: 102,
                            api_name: 'ACH_MALENIA',
                            name: 'Portadora Malenia',
                            description: 'Vence a Malenia',
                            hidden: true,
                            icon_achieved:
                              'https://shared.fastly.steamstatic.com/community_assets/images/apps/1245620/icon2.jpg',
                          },
                          {
                            internal_key: 103,
                            api_name: 'ACH_MARGIT',
                            name: 'Derrota a Margit',
                            description: 'Vence a Margit el Augurio',
                            hidden: false,
                            icon_achieved:
                              'https://shared.fastly.steamstatic.com/community_assets/images/apps/1245620/icon3.jpg',
                          },
                        ],
                      },
                    ],
                  },
                },
              },
              {
                queryKey: ['achievements', 1245620, 'globalpercentages'],
                state: {
                  data: {
                    percentages: {
                      '101': 10.5,
                      '102': 34.2,
                      '103': 75.8,
                    },
                  },
                },
              },
            ],
          }),
        },
      };

      const html = `<html><head><script type="application/json" id="valve-ssr-data">${JSON.stringify(mockValveSsr)}</script></head><body></body></html>`;
      return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }

    if (url.includes('/appdetails?')) {
      return Response.json({
        '1245620': {
          success: true,
          data: {
            achievements: {
              total: 1,
              highlighted: [
                {
                  name: 'Logro Destacado',
                  path: 'https://shared.fastly.steamstatic.com/icon.jpg',
                },
              ],
            },
          },
        },
      });
    }

    if (url.includes('GetGlobalAchievementPercentagesForApp')) {
      return Response.json({
        achievementpercentages: {
          achievements: [{ name: 'Logro Destacado', percent: 45.0 }],
        },
      });
    }

    throw new Error('Unexpected URL: ' + url);
  };
}

test('Service retrieves achievements and global rarity from Steam Community SSR', async () => {
  setupMock();
  const report = await fetchGameAchievements('Elden Ring');

  assert.equal(report.hasAchievements, true);
  assert.equal(report.totalAchievements, 3);
  assert.equal(report.achievements.length, 3);

  // Sorted by unlock percentage ascending
  assert.equal(report.achievements[0]?.apiName, 'ACH_CIRCLE');
  assert.equal(report.achievements[0]?.unlockedPercentage, 10.5);
  assert.equal(report.achievements[0]?.tier, 'platino'); // Master achievement flag

  assert.equal(report.achievements[1]?.apiName, 'ACH_MALENIA');
  assert.equal(report.achievements[1]?.unlockedPercentage, 34.2);
  assert.equal(report.achievements[1]?.tier, 'plata');
  assert.equal(report.achievements[1]?.hidden, true);

  assert.equal(report.achievements[2]?.apiName, 'ACH_MARGIT');
  assert.equal(report.achievements[2]?.unlockedPercentage, 75.8);
  assert.equal(report.achievements[2]?.tier, 'bronce');

  assert.equal(report.summary.total, 3);
  assert.equal(report.summary.platinoCount, 1);
  assert.equal(report.summary.plataCount, 1);
  assert.equal(report.summary.bronceCount, 1);
});

test('Service returns empty report when game is not found on Steam', async () => {
  setupMock({ notFound: true });
  const report = await fetchGameAchievements('Zelda Breath of the Wild');

  assert.equal(report.hasAchievements, false);
  assert.equal(report.totalAchievements, 0);
  assert.deepEqual(report.achievements, []);
});

test('GameAchievementsView renders trophy hall, statistics summary, badges and progressive disclosure', () => {
  const mockReport: GameAchievementsReport = {
    appId: 1245620,
    communityUrl: 'https://steamcommunity.com/stats/1245620/achievements',
    hasAchievements: true,
    totalAchievements: 14,
    summary: {
      total: 14,
      platinoCount: 2,
      oroCount: 3,
      plataCount: 4,
      bronceCount: 5,
      hiddenCount: 3,
      averageUnlockRate: 38.4,
      rarestAchievement: null,
    },
    achievements: Array.from({ length: 14 }, (_, i) => ({
      id: String(i + 1),
      apiName: `ACH_${i + 1}`,
      name: `Trofeo ${i + 1}`,
      description: `Descripción del trofeo ${i + 1}`,
      hidden: i === 2,
      iconUrl: 'https://shared.fastly.steamstatic.com/icon.jpg',
      unlockedPercentage: 10 + i * 5,
      tier: (i === 0 ? 'platino' : i < 3 ? 'oro' : i < 6 ? 'plata' : 'bronce') as AchievementTier,
    })),
  };

  const html = renderToStaticMarkup(createElement(GameAchievementsView, { report: mockReport }));
  const $ = load(html);

  assert.ok($('.achievements-hub-section').length > 0);
  assert.ok(html.includes('SALÓN DE TROFEOS // STEAM'));
  assert.ok(html.includes('Logros y Rareza Global'));
  assert.ok(html.includes('Ver en Steam Community'));

  // Stat summary checks
  assert.equal($('.achievement-stat-card').length, 6);
  assert.equal($('.stat-platino .stat-card-value').text(), '2');
  assert.equal($('.stat-oro .stat-card-value').text(), '3');
  assert.equal($('.stat-plata .stat-card-value').text(), '4');
  assert.equal($('.stat-bronce .stat-card-value').text(), '5');
  assert.ok(html.includes('38.4%'));

  // Cards and progressive disclosure
  assert.equal($('.achievement-card').length, 14);
  assert.ok($('.achievements-disclosure').length > 0);
  assert.ok(html.includes('Explorar los 2 logros restantes'));
  assert.ok(html.includes('🔒 Logro Secreto'));

  // When report has no achievements, view renders null
  const emptyHtml = renderToStaticMarkup(
    createElement(GameAchievementsView, {
      report: {
        appId: null,
        communityUrl: null,
        hasAchievements: false,
        totalAchievements: 0,
        summary: {
          total: 0,
          platinoCount: 0,
          oroCount: 0,
          plataCount: 0,
          bronceCount: 0,
          hiddenCount: 0,
          averageUnlockRate: 0,
          rarestAchievement: null,
        },
        achievements: [],
      },
    }),
  );
  assert.equal(emptyHtml, '');
});
