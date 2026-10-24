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
  parseSteamRequirements,
  parseReviewQuotes,
  getCriticTier,
  sanitizeMetacriticUrl,
} from '../../src/domain/game-specs.ts';

test('Requirements parser extracts OS, CPU, RAM, GPU, DirectX and storage from Steam HTML', () => {
  const sample = `<strong>Mínimo:</strong><br><ul class="bb_ul">
    <li>Requiere un procesador y un sistema operativo de 64 bits<br></li>
    <li><strong>SO:</strong> Windows 10 &amp; 11<br></li>
    <li><strong>Procesador:</strong> INTEL CORE I5-8400 or AMD RYZEN 3 3300X<br></li>
    <li><strong>Memoria:</strong> 12 GB de RAM<br></li>
    <li><strong>Gráficos:</strong> NVIDIA GEFORCE GTX 1060 3 GB<br></li>
    <li><strong>DirectX:</strong> Versión 12<br></li>
    <li><strong>Almacenamiento:</strong> 60 GB de espacio disponible<br></li>
  </ul>`;

  const parsed = parseSteamRequirements(sample);
  assert.ok(parsed);
  assert.equal(parsed.os, 'Windows 10 & 11');
  assert.equal(parsed.cpu, 'INTEL CORE I5-8400 or AMD RYZEN 3 3300X');
  assert.equal(parsed.ram, '12 GB de RAM');
  assert.equal(parsed.gpu, 'NVIDIA GEFORCE GTX 1060 3 GB');
  assert.equal(parsed.directx, 'Versión 12');
  assert.equal(parsed.storage, '60 GB de espacio disponible');

  assert.equal(parseSteamRequirements(null), null);
  assert.equal(parseSteamRequirements(''), null);
  assert.equal(parseSteamRequirements('<div>Sin especificaciones claras</div>'), null);
});

test('Quotes parser extracts quotes, scores and attributions, capping at three entries', () => {
  const sample = `“La nueva obra maestra de FromSoftware.”<br>10/10 – IGN<br><br>
    “Elden Ring marcará un antes y un después.”<br>10/10 – Gaming Bible<br><br>
    “Uno de los mejores juegos de la historia.”<br>5/5 – Games Radar<br><br>
    “Impresionante.”<br>9.5/10 – Extra Outlet`;

  const quotes = parseReviewQuotes(sample);
  assert.equal(quotes.length, 3);
  assert.equal(quotes[0]?.quote, 'La nueva obra maestra de FromSoftware.');
  assert.equal(quotes[0]?.score, '10/10');
  assert.equal(quotes[0]?.source, 'IGN');
  assert.equal(quotes[1]?.source, 'Gaming Bible');
  assert.equal(quotes[2]?.score, '5/5');

  assert.deepEqual(parseReviewQuotes(''), []);
  assert.deepEqual(parseReviewQuotes(null), []);
});

test('Critic tier classifier assigns positive, mixed, negative and unknown appropriately', () => {
  assert.equal(getCriticTier(94), 'positive');
  assert.equal(getCriticTier(75), 'positive');
  assert.equal(getCriticTier(74), 'mixed');
  assert.equal(getCriticTier(50), 'mixed');
  assert.equal(getCriticTier(49), 'negative');
  assert.equal(getCriticTier(12), 'negative');
  assert.equal(getCriticTier(0), 'unknown');
  assert.equal(getCriticTier(-5), 'unknown');
  assert.equal(getCriticTier(null), 'unknown');
});

test('Metacritic URL validator accepts official HTTPS urls and rejects hostile schemes or hosts', () => {
  assert.equal(
    sanitizeMetacriticUrl('https://www.metacritic.com/game/pc/elden-ring?ftag=123'),
    'https://www.metacritic.com/game/pc/elden-ring?ftag=123',
  );
  assert.equal(
    sanitizeMetacriticUrl('https://metacritic.com/game/hollow-knight'),
    'https://metacritic.com/game/hollow-knight',
  );
  for (const hostile of [
    null,
    undefined,
    '',
    'http://www.metacritic.com/game/pc',
    'javascript:alert(1)',
    'https://evil.test/?url=https://www.metacritic.com',
    'https://user:pass@www.metacritic.com/game',
  ]) {
    assert.equal(sanitizeMetacriticUrl(hostile), null);
  }
});

const fixture =
  'data:text/javascript,' +
  encodeURIComponent(`
  export const state = { cache:new Map(), options:[], quota:true, cacheFailure:false };
  export function unstable_cache(fn,key,options){
    state.options.push({key,options});
    return async (...args)=>{
      if(state.cacheFailure)throw Error('Cache unavailable');
      const k=JSON.stringify([key,args]);
      if(!state.cache.has(k))state.cache.set(k,fn(...args));
      return state.cache.get(k);
    };
  }
  export const twitchAccessToken=async()=> 'unit-test-token';
  export const catalogueAdmin=()=>({rpc:()=>({abortSignal:async()=>({data:state.quota,error:null})})});
`);

const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only' || specifier.endsWith('.css'))
      return { url: 'data:text/javascript,export {};', shortCircuit: true };
    if (
      ['next/cache', '@/integrations/igdb/server', '@/integrations/supabase/admin'].includes(
        specifier,
      )
    )
      return { url: fixture, shortCircuit: true };
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
const names = ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'SUPABASE_SERVICE_ROLE_KEY'];
const previous = names.map((name) => process.env[name]);

after(() => {
  globalThis.fetch = originalFetch;
  hooks.deregister();
  names.forEach((name, i) => {
    if (previous[i] === undefined) delete process.env[name];
    else process.env[name] = previous[i];
  });
});

const { fetchGameCriticAndSpecs } = await import('../../src/services/game-specs-service.ts');
const { GameCriticAndSpecsHub, GameSpecsView } =
  await import('../../src/components/game-critic-and-specs.tsx');
const { state } = await import(fixture);

type Scenario = {
  steamFound?: boolean;
  hasMetacritic?: boolean;
  hasQuotes?: boolean;
  pcAvailable?: boolean;
  failSteam?: boolean;
  failIgdb?: boolean;
};

function setupMock(scenario: Scenario = {}) {
  names.forEach((name) => (process.env[name] = 'unit-only'));
  state.cache.clear();
  state.quota = true;
  state.cacheFailure = false;

  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    if (scenario.failSteam && url.includes('steampowered.com')) {
      throw new TypeError('Steam network error');
    }
    if (scenario.failIgdb && url.includes('api.igdb.com')) {
      throw new TypeError('IGDB network error');
    }

    if (url.includes('/storesearch/')) {
      if (scenario.steamFound === false) return Response.json({ items: [] });
      return Response.json({ items: [{ id: 1245620, name: 'Elden Ring', type: 'app' }] });
    }

    if (url.includes('/appdetails?')) {
      const isPc = scenario.pcAvailable !== false;
      return Response.json({
        '1245620': {
          success: true,
          data: {
            platforms: { windows: isPc, linux: false, mac: false },
            pc_requirements: isPc
              ? {
                  minimum:
                    '<strong>SO:</strong> Windows 10<br><strong>Procesador:</strong> i5-8400<br><strong>Memoria:</strong> 12 GB RAM<br>',
                  recommended:
                    '<strong>SO:</strong> Windows 11<br><strong>Procesador:</strong> i7-8700K<br><strong>Memoria:</strong> 16 GB RAM<br>',
                }
              : {},
            metacritic:
              scenario.hasMetacritic !== false
                ? { score: 94, url: 'https://www.metacritic.com/game/pc/elden-ring' }
                : null,
            reviews: scenario.hasQuotes !== false ? '“Obra maestra.”<br>10/10 – IGN' : null,
          },
        },
      });
    }

    if (url.includes('api.igdb.com/v4/games')) {
      const body = String(options.body ?? '');
      if (body.includes('search')) {
        return Response.json([{ id: 119133, name: 'Elden Ring' }]);
      }
      return Response.json([{ id: 119133, aggregated_rating: 95.8, aggregated_rating_count: 52 }]);
    }

    throw new Error('Unexpected URL: ' + url);
  };
}

test('Service retrieves Steam requirements, Metascore and reviews for PC game', async () => {
  setupMock();
  const result = await fetchGameCriticAndSpecs('Elden Ring');

  assert.ok(result.critic);
  assert.equal(result.critic.score, 94);
  assert.equal(result.critic.tier, 'positive');
  assert.equal(result.critic.provider, 'metacritic');
  assert.equal(result.critic.url, 'https://www.metacritic.com/game/pc/elden-ring');
  assert.equal(result.critic.reviewQuotes.length, 1);
  assert.equal(result.critic.reviewQuotes[0]?.source, 'IGN');

  assert.ok(result.hardware);
  assert.equal(result.hardware.isPcAvailable, true);
  assert.equal(result.hardware.minimum?.os, 'Windows 10');
  assert.equal(result.hardware.minimum?.cpu, 'i5-8400');
  assert.equal(result.hardware.recommended?.os, 'Windows 11');
});

test('Service falls back to IGDB aggregated rating when Steam has no Metacritic', async () => {
  setupMock({ hasMetacritic: false, hasQuotes: false });
  const result = await fetchGameCriticAndSpecs('Elden Ring');

  assert.ok(result.critic);
  assert.equal(result.critic.score, 96);
  assert.equal(result.critic.provider, 'igdb');
  assert.equal(result.critic.tier, 'positive');
  assert.equal(result.hardware?.isPcAvailable, true);
});

test('Non-PC game reports isPcAvailable as false', async () => {
  setupMock({ pcAvailable: false, hasMetacritic: true });
  const result = await fetchGameCriticAndSpecs('Elden Ring');

  assert.ok(result.critic);
  assert.ok(result.hardware);
  assert.equal(result.hardware.isPcAvailable, false);
});

test('GameSpecsView and Hub render critic score, quotes, PC hardware specs and console banner', async () => {
  setupMock();
  const data = await fetchGameCriticAndSpecs('Elden Ring');
  const $ = load(renderToStaticMarkup(createElement(GameSpecsView, { title: 'Elden Ring', data })));

  assert.equal($('.critic-score-badge').text().includes('94'), true);
  assert.equal($('.critic-score-badge').attr('data-tier'), 'positive');
  assert.match($('.critic-quote-text').text(), /Obra maestra/);
  assert.match($('.specs-component-list').text(), /Windows 10/);
  assert.equal(
    $('a.game-specs-link').attr('href'),
    'https://www.metacritic.com/game/pc/elden-ring',
  );
  assert.equal($('a.game-specs-link').attr('target'), '_blank');
  assert.equal($('a.game-specs-link').attr('rel'), 'noopener noreferrer');

  // Console game
  const consoleData = {
    ...data,
    hardware: { minimum: null, recommended: null, isPcAvailable: false },
  };
  const consoleHtml = load(
    renderToStaticMarkup(
      createElement(GameSpecsView, { title: 'Console Game', data: consoleData }),
    ),
  );
  assert.match(consoleHtml('.specs-console-notice').text(), /Título de Consola/);

  // Empty data returns null
  assert.equal(GameSpecsView({ title: 'Empty', data: { critic: null, hardware: null } }), null);

  // Hub handles failure gracefully
  state.cacheFailure = true;
  assert.equal(await GameCriticAndSpecsHub({ title: 'Elden Ring' }), null);
});
