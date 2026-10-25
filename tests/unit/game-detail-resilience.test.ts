import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import {
  safeFormatIsoDate,
  safeGameDomId,
  normalizeUnlockPercentage,
  achievementPercentageForKey,
} from '../../src/domain/game-detail-resilience.ts';

test('Speedrun dates accept valid UTC values and omit missing, non-string and unparseable values', () => {
  assert.equal(
    safeFormatIsoDate('2026-10-24T23:00:00.000Z'),
    new Date('2026-10-24T23:00:00Z').toLocaleDateString('es-CL', { timeZone: 'UTC' }),
  );
  for (const value of [null, undefined, '', ' ', 'not-a-date', '2026-99-99', {}])
    assert.equal(safeFormatIsoDate(value as string), null);
});
test('Hardware IDs collapse punctuation and repeated hyphens and always have a stable fallback', () => {
  for (const [input, expected] of [
    ['God of War--1', 'god-of-war-1'],
    [' --- God!! of War --- ', 'god-of-war'],
    ['!!!', 'game'],
    ['', 'game'],
    [null, 'game'],
    [{}, 'game'],
  ]) {
    assert.equal(safeGameDomId(input), expected);
    assert.doesNotMatch(safeGameDomId(input), /--|[^a-z0-9-]|^-|-$/);
  }
});
test('Achievement percentage lookup handles numeric/alphanumeric own keys, zero and invalid values', () => {
  const map = {
    256: 6.59,
    ACH_ALPHA: '23.55',
    ZERO: 0,
    HIGH: 999,
    LOW: -10,
    BAD: 'bad',
    INF: Infinity,
  };
  assert.equal(achievementPercentageForKey(map, 256), 6.6);
  assert.equal(achievementPercentageForKey(map, '256'), 6.6);
  assert.equal(achievementPercentageForKey(map, 'ACH_ALPHA'), 23.6);
  assert.equal(achievementPercentageForKey(map, 'ZERO'), 0);
  assert.equal(achievementPercentageForKey(map, 'HIGH'), 100);
  assert.equal(achievementPercentageForKey(map, 'LOW'), 0);
  for (const key of ['BAD', 'INF', 'MISSING', '__proto__', 'constructor'])
    assert.equal(achievementPercentageForKey(map, key), 0);
  for (const value of [null, undefined, NaN, Infinity, {}, ''])
    assert.equal(normalizeUnlockPercentage(value), 0);
  assert.equal(achievementPercentageForKey(Object.create({ ACH_ALPHA: 80 }), 'ACH_ALPHA'), 0);
});

const fixture =
  'data:text/javascript,' +
  encodeURIComponent(`
 import React from '${import.meta.resolve('react')}';
 export * from '${import.meta.resolve('react')}';
 export default React;
 export const useEffect=()=>{};
 export const state={reports:0};
 export function reportClientError(){state.reports++;}
 export const unstable_cache=fn=>fn;
 export const catchError=()=>function StreamBoundary(props){return props.children;};
`);
const linkFixture =
  'data:text/javascript,' +
  encodeURIComponent(`
 import React from '${import.meta.resolve('react')}';
 export default function Link({children,...props}){return React.createElement('a',props,children);}
`);
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (
      (specifier === 'react' && context.parentURL?.includes('/src/')) ||
      specifier === 'next/error' ||
      specifier === 'next/cache' ||
      specifier === '@/lib/client-error-report'
    )
      return { url: fixture, shortCircuit: true };
    if (specifier === 'next/link') return { url: linkFixture, shortCircuit: true };
    if (specifier === 'server-only' || specifier.endsWith('.css'))
      return { url: 'data:text/javascript,export {};', shortCircuit: true };
    if (
      specifier === '@/services/game-meta-service' ||
      specifier === '@/services/game-specs-service'
    )
      return {
        url: 'data:text/javascript,export const fetchGameMeta=async()=>null;export const fetchGameCriticAndSpecs=async()=>null;',
        shortCircuit: true,
      };
    if (specifier.startsWith('@/')) {
      const path = resolve('src', specifier.slice(2));
      return {
        url: pathToFileURL(existsSync(path + '.tsx') ? path + '.tsx' : path + '.ts').href,
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
after(() => hooks.deregister());

test('Meta rendering omits invalid time elements and accepts malformed optional category/tier values safely', async () => {
  const { GameMetaView } = await import('../../src/components/game-meta-hub.tsx');

  for (const date of [null, '', 'not-a-date']) {
    const data = {
      duration: null,
      proton: { tier: null, totalReports: null },
      speedrun: {
        dateIso: date,
        categoryName: { bad: true },
        runnerName: null,
        timeFormatted: null,
        videoUrl: null,
      },
    };
    const html = renderToStaticMarkup(
      createElement(GameMetaView, { title: 'God of War--1', data: data as never }),
    );
    const $ = load(html);
    assert.equal($('time').length, 0);
    assert.match(html, /PENDING/);
    assert.doesNotMatch(html, /Invalid Date|NaN|undefined/);
  }
});
test('Hardware radio labels and names remain paired for punctuation-heavy titles', async () => {
  const { GameSpecsView } = await import('../../src/components/game-critic-and-specs.tsx');

  const data = {
    critic: null,
    hardware: {
      isPcAvailable: true,
      minimum: { os: 'Windows', cpu: 'CPU' },
      recommended: { os: 'Windows' },
    },
  };
  const $ = load(
    renderToStaticMarkup(
      createElement(GameSpecsView, { title: 'God of War--1', data: data as never }),
    ),
  );
  assert.equal($('input[type="radio"]').length, 2);
  for (const input of $('input').toArray()) {
    const id = $(input).attr('id')!;
    assert.doesNotMatch(id, /--/);
    assert.equal($('label[for="' + id + '"]').length, 1);
  }
  assert.equal($('input').first().attr('name'), 'specs-tab-god-of-war-1');
});

test('Steam SSR maps mixed achievement keys and produces finite clamped rarity with deterministic missing IDs', async () => {
  const { GameAchievementsView } = await import('../../src/components/game-achievements.tsx');
  const { fetchCommunityAchievements } =
  await import('../../src/services/game-achievements-service.ts');

  const previous = globalThis.fetch;
  const ssr = {
    renderContext: {
      queryData: JSON.stringify({
        queries: [
          {
            queryKey: ['a', 1, 'schema'],
            state: {
              data: {
                groups: [
                  null,
                  {
                    achievements: [
                      { internal_key: 256, name: 'Numeric' },
                      { internal_key: 'ACH_ALPHA', name: 'Alpha' },
                      { internal_key: 'HIGH', name: 'High' },
                      { name: 'Missing' },
                    ],
                  },
                ],
              },
            },
          },
          {
            queryKey: ['a', 1, 'globalpercentages'],
            state: { data: { percentages: { 256: 6.59, ACH_ALPHA: '23.55', HIGH: 999 } } },
          },
        ],
      }),
    },
  };
  globalThis.fetch = async () =>
    new Response(
      '<script type="application/json" id="valve-ssr-data">' + JSON.stringify(ssr) + '</script>',
    );
  try {
    const items = await fetchCommunityAchievements(1593500);
    assert.deepEqual(
      items?.map((item) => item.unlockedPercentage),
      [6.6, 23.6, 100, 0],
    );
    assert.equal(items?.at(-1)?.id, 'achievement-4');
    assert.equal((await fetchCommunityAchievements(1593500))?.at(-1)?.id, 'achievement-4');
    const report = {
      hasAchievements: true,
      achievements: items!.map((item) => ({ ...item, unlockedPercentage: NaN })),
      summary: {},
      totalAchievements: items!.length,
    };
    const $ = load(
      renderToStaticMarkup(createElement(GameAchievementsView, { report: report as never })),
    );
    assert.equal($('.achievement-card').length, 4);
    assert.doesNotMatch($.html(), /NaN|undefined|Infinity/);
    for (const bar of $('.achievement-bar-fill').toArray())
      assert.equal($(bar).attr('style'), 'width:4%');
  } finally {
    globalThis.fetch = previous;
  }
});
test('Optional server loader failures are contained and successful siblings remain renderable', async () => {
  const { ResilientServerWidget } = await import('../../src/components/resilient-server-widget.tsx');

  const warn = console.warn;
  console.warn = () => {};
  try {
    for (const load of [
      () => {
        throw Error('sync');
      },
      async () => {
        throw Error('async');
      },
    ])
      assert.equal(await ResilientServerWidget({ load, widgetName: 'fixture' }), null);
    const child = createElement('p', null, 'Healthy sibling');
    assert.equal(
      await ResilientServerWidget({ load: async () => child, widgetName: 'healthy' }),
      child,
    );
  } finally {
    console.warn = warn;
  }
});
test('Runtime boundary derives failure state and renders only its explicit fallback or null', async () => {
  const { ResilientWidgetBoundary } =
  await import('../../src/components/resilient-widget-boundary.tsx');

  const error = Error('private debug message');
  const boundary = new ResilientWidgetBoundary({
    children: 'healthy',
    fallback: createElement('p', null, 'Local fallback'),
  });
  assert.equal(boundary.state.hasError, false);
  boundary.state = ResilientWidgetBoundary.getDerivedStateFromError(error);
  assert.equal(
    renderToStaticMarkup(boundary.render() as React.ReactElement),
    '<p>Local fallback</p>',
  );
  const silent = new ResilientWidgetBoundary({ children: 'healthy' });
  silent.state = ResilientWidgetBoundary.getDerivedStateFromError(error);
  assert.equal(silent.render(), null);
  assert.doesNotThrow(() => silent.componentDidCatch(error));
});

type Node = { type: unknown; props: Record<string, unknown> };
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object' || !('props' in value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}
test('Segment fallback confines its message, displays only digest and supports reset plus RSC retry', async () => {
  const { default: GameSegmentError } = await import('../../src/app/games/[slug]/error.tsx');

  let reset = 0,
    retry = 0;
  const error = Object.assign(Error('secret upstream failure'), { digest: '3411904829' });
  const view = GameSegmentError({ error, reset: () => reset++ });
  const html = renderToStaticMarkup(view);
  const $ = load(html);
  assert.match(html, /SEÑAL DEL JUEGO INTERRUMPIDA/);
  assert.match(html, /Código de error: \[3411904829\]/);
  assert.doesNotMatch(html, /secret upstream failure|ERROR CRÍTICO/);
  assert.equal($('a').attr('href'), '/explore');
  (nodes(view).find((n) => n.type === 'button')!.props.onClick as () => void)();
  assert.equal(reset, 1);
  const next = GameSegmentError({ error, reset: () => reset++, retry: () => retry++ });
  (nodes(next).find((n) => n.type === 'button')!.props.onClick as () => void)();
  assert.equal(retry, 1);
  assert.equal(reset, 1);
  const noDigest = renderToStaticMarkup(
    GameSegmentError({ error: Error('private'), reset: () => {} }),
  );
  assert.doesNotMatch(noDigest, /Código de error/);
});
test('All five optional widgets have independent RSC loaders and boundaries keyed by game; core notFound stays outside', () => {
  const source = readFileSync('src/app/games/[slug]/page.tsx', 'utf8');
  const ast = ts.createSourceFile(
    'page.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const counts = { ResilientWidgetBoundary: 0, ResilientServerWidget: 0 };
  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = node.tagName.getText(ast);
      if (name in counts) counts[name as keyof typeof counts]++;
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.deepEqual(counts, { ResilientWidgetBoundary: 5, ResilientServerWidget: 5 });
  for (const name of [
    'GameLiveRadar',
    'GameMetaHub',
    'GameCriticAndSpecsHub',
    'GameAchievementsHub',
    'GameForum',
  ])
    assert.ok(source.includes('widgetName="' + name + '"'));
  assert.match(source, /if \(!game\) notFound\(\)/);
  assert.ok(readFileSync('src/components/achievement-icon.tsx', 'utf8').startsWith("'use client'"));
  assert.doesNotMatch(readFileSync('src/components/game-achievements.tsx', 'utf8'), /onError=/);
});
