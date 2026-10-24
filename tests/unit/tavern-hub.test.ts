import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, createRequire, stripTypeScriptTypes } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import { legacyTavernHref, tavernTab } from '../../src/domain/tavern.ts';

const require = createRequire(import.meta.url);
const fixtureUrl =
  'data:text/javascript,' +
  encodeURIComponent(`
import {createElement as h} from '${pathToFileURL(require.resolve('react')).href}';
export const state={configured:true,calls:[],active:0,maxActive:0,user:null,duel:null,feed:{items:[],hasMore:false,generatedAt:0},partyProps:null,duelProps:null,postProps:null,createProps:null,highlightFilters:null,posts:[],total:0,pathname:'/tavern'};
async function query(name,args,result){state.calls.push({name,args});state.active++;state.maxActive=Math.max(state.maxActive,state.active);await Promise.resolve();state.active--;return result;}
export function isConfigured(){return state.configured;}
export function currentUser(){return query('user',[],state.user);}
export function duelSummary(){return query('duel',[],state.duel);}
export function partyFeed(filters){return query('parties',[filters],state.feed);}
export function highlightFeed(filters){state.highlightFilters=filters;return query('highlights',[filters],{posts:state.posts,total:state.total});}
export function PostForm(props){state.postProps=props;return h('section',{'data-post-form':'true'},'Publicar momento');}
export function PostCard(props){return h('article',{'data-post-card':props.post.id},props.post.title);}
export function notFound(){throw new Error('NOT_FOUND');}
export function permanentRedirect(href){throw new Error('REDIRECT:'+href);}
export function usePathname(){return state.pathname;}
export function forumDirectory(...args){return query('forum',args,{categories:[{id:'retro-corner',name:'La Taberna Retro',description:'Canal retro',icon:'gamepad-2'}],stats:[],hot:[]});}
export function GameDuelWidget(props){state.duelProps=props;return h('section',{'data-duel':'true'},'Duelo interactivo');}
export function PartyBoard(props){state.partyProps=props;return h('section',{'data-parties':'true'},'Tablero LFG');}
export function SetupNotice(){return state.configured?null:h('aside',null,'Configuración pendiente');}
export function ForumCreate(props){state.createProps=props;return h('section',{'data-create':'true'},props.toolbar,'Crear hilo');}
export function ForumThreadList(){return h('section',{'data-threads':'true'},'Hilos');}
export default function Link({scroll,...props}){return h('a',props,props.children);}
`);
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (
      (context.parentURL?.includes('/app/tavern/page.tsx') || context.parentURL?.includes('/components/header-nav.tsx') || /\/app\/(forum|highlights|arcade|parties)\/page\.tsx$/.test(context.parentURL ?? '')) &&
      [
        'next/link',
        'next/navigation',
        '@/services/highlights',
        '@/components/highlights/post-form',
        '@/components/highlights/post-card',
        '@/lib/env',
        '@/lib/session',
        '@/services/arcade',
        '@/services/forum',
        '@/components/setup-notice',
        '@/components/forum-create',
        '@/components/forum-thread-list',
        '@/components/game-duel-widget',
        '@/components/arcade/party-board',
      ].includes(specifier)
    )
      return { url: fixtureUrl, shortCircuit: true };
    if (specifier.startsWith('@/')) {
      const path = resolve('src', specifier.slice(2));
      return {
        url: pathToFileURL(existsSync(path + '.ts') ? path + '.ts' : path + '.tsx').href,
        shortCircuit: true,
      };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('file:') && /\.tsx?$/.test(url) && !url.includes('node_modules')) {
      const source = readFileSync(fileURLToPath(url), 'utf8');
      return {
        format: 'module',
        source: url.endsWith('.tsx')
          ? ts.transpileModule(source, {
              compilerOptions: {
                jsx: ts.JsxEmit.ReactJSX,
                module: ts.ModuleKind.ESNext,
                target: ts.ScriptTarget.ES2022,
              },
            }).outputText
          : stripTypeScriptTypes(source, { mode: 'transform' }),
        shortCircuit: true,
      };
    }
    return next(url, context);
  },
});
test.after(() => hooks.deregister());
const { state } = await import(fixtureUrl);
const { default: TavernPage } = await import('../../src/app/tavern/page.tsx');
function reset() {
  Object.assign(state, {
    configured: true,
    calls: [],
    active: 0,
    maxActive: 0,
    user: { id: 'viewer' },
    partyProps: null,
    postProps: null,
    createProps: null,
    highlightFilters: null,
    posts: [],
    total: 0,
    duelProps: null,
    duel: {
      duel: { id: 'duel', game_a_id: 'a', game_b_id: 'b', title: 'Duelo semanal' },
      games: [
        { id: 'b', title: 'Zelda' },
        { id: 'a', title: 'Metroid' },
      ],
      votes: {},
      ownVote: null,
    },
    feed: { items: [], hasMore: false, generatedAt: 0 },
  });
}
function names(): string[] {
  return state.calls.map((call: { name: string }) => call.name).sort();
}
test('Tavern hub defaults to Debates, preserves search/sort/channel and fetches only the two independent queries concurrently', async () => {
  reset();
  const html = renderToStaticMarkup(
    await TavernPage({
      searchParams: Promise.resolve({
        q: '  cooperativo  ',
        sort: 'active',
        channel: 'retro-corner',
      }),
    }),
  );
  assert.deepEqual(names(), ['forum', 'user']);
  assert.equal(state.maxActive, 2);
  assert.deepEqual(state.calls.find((call: { name: string }) => call.name === 'forum').args, [
    'cooperativo',
    'active',
    'retro-corner',
  ]);
  assert.match(html, /href="\/tavern"[^>]*aria-current="page"/);
  assert.doesNotMatch(html, /forum-arcade-banner/);
  assert.match(state.createProps.returnHref, /^\/tavern\?/);
  assert.match(html, /data-threads="true"/);
  assert.doesNotMatch(html, /data-parties/);
});
test('Tavern Arcade loads only duel, feed and user; passes viewer and canonical login through to existing clients', async () => {
  reset();
  const html = renderToStaticMarkup(
    await TavernPage({
      searchParams: Promise.resolve({ tab: 'arcade', q: 'ignored', sort: 'unanswered' }),
    }),
  );
  assert.deepEqual(names(), ['duel', 'parties', 'user']);
  assert.equal(state.maxActive, 3);
  assert.deepEqual(state.calls.find((call: { name: string }) => call.name === 'parties').args, [
    { page: 1 },
  ]);
  assert.equal(state.partyProps.viewerId, 'viewer');
  assert.equal(state.partyProps.configured, true);
  assert.equal(state.duelProps.authenticated, true);
  assert.equal(state.duelProps.loginHref, '/login?next=%2Ftavern%3Ftab%3Darcade');
  assert.match(html, /href="\/tavern\?tab=arcade"[^>]*aria-current="page"/);
  assert.match(html, /data-parties="true"/);
  assert.doesNotMatch(html, /data-threads|forum-channels-grid|forum-arcade-banner/);
});
test('Tavern tab selection is strict: arrays, unknown values and debates resolve to Debates with safe filter defaults', async () => {
  for (const tab of [undefined, 'debates', 'other', ['arcade'], ['arcade', 'debates']]) {
    reset();
    state.user = null;
    state.duel = null;
    const html = renderToStaticMarkup(
      await TavernPage({
        searchParams: Promise.resolve({
          tab,
          q: ['ignored'],
          sort: ['active'],
          channel: ['retro-corner'],
        }),
      }),
    );
    assert.deepEqual(names(), ['forum', 'user']);
    assert.deepEqual(state.calls.find((call: { name: string }) => call.name === 'forum').args, [
      '',
      'recent',
      '',
    ]);
    assert.match(html, /Una comunidad\. Mil conversaciones\./);
    assert.doesNotMatch(html, /forum-arcade-banner/);
    assert.match(html, /href="\/login\?next=%2Ftavern"/);
  }
});
test('Tavern preserves navigation when unconfigured and skips all data providers instead of inventing content', async () => {
  for (const tab of ['arcade', 'debates', 'momentos']) {
    reset();
    state.configured = false;
    state.user = null;
    const html = renderToStaticMarkup(await TavernPage({ searchParams: Promise.resolve({ tab }) }));
    assert.match(html, /Secciones de La Taberna/);
    assert.match(html, /Configuración pendiente/);
    assert.ok(
      !names().includes('forum') && !names().includes('duel') && !names().includes('parties'),
    );
    if (tab === 'arcade') {
      assert.deepEqual(state.partyProps.initial, { items: [], hasMore: false, generatedAt: 0 });
      assert.equal(state.partyProps.configured, false);
    }
  }
});
test('Tavern handles absent duels, anonymous Arcade and missing game metadata without showing undefined or leaking an own vote', async () => {
  reset();
  state.duel = null;
  state.user = null;
  let html = renderToStaticMarkup(
    await TavernPage({ searchParams: Promise.resolve({ tab: 'arcade' }) }),
  );
  assert.equal(state.partyProps.viewerId, null);
  assert.equal(state.duelProps, null);
  assert.match(html, /No hay un duelo activo/);
  reset();
  state.duel.games = [];
  html = renderToStaticMarkup(await TavernPage({ searchParams: Promise.resolve({}) }));
  assert.doesNotMatch(html, /Duelo semanal/);
  assert.doesNotMatch(html, /undefined/);
});

test('Next routing sends both legacy entries directly to the Forum with permanent HTTP redirects', async () => {
  const { default: config } = await import('../../next.config.ts');
  const redirects = await config.redirects?.();
  for (const source of ['/arcade', '/parties']) {
    const rule = redirects?.find((rule) => rule.source === source);
    assert.equal(rule?.destination, '/tavern?tab=arcade');
    assert.equal(rule?.permanent, true);
  }
  assert.equal(
    redirects?.find((rule) => rule.source === '/community/discord')?.destination,
    '/chat',
  );
});

test('Momentos queries only highlights and user concurrently, preserving drafts, title and viewer',async()=>{
 reset();state.posts=[{id:'post-one',title:'Epic play'}];state.total=25;
 const id='11111111-1111-4111-8111-111111111111';
 const html=renderToStaticMarkup(await TavernPage({searchParams:Promise.resolve({tab:'momentos',category:'speedrun',page:'2',player:id,game:id,post:id,draft:'Borrador **épico**',draftTitle:'Mi título'})}));
 assert.deepEqual(names(),['highlights','user']);assert.equal(state.maxActive,2);
 assert.deepEqual(state.highlightFilters,{category:'speedrun',page:2,player:id,game:id,post:id});
 assert.equal(state.postProps.initialDraft,'Borrador **épico**');assert.equal(state.postProps.initialTitle,'Mi título');assert.equal(state.postProps.userId,'viewer');
 const $=load(html);assert.equal($('[data-post-card]').length,1);
 assert.equal($('.tavern-view-tabs a[aria-current="page"]').attr('href'),'/tavern?tab=momentos');
 for(const anchor of $('.highlight-filters a.tag,.highlight-carousel a').toArray()){
  const url=new URL($(anchor).attr('href')!,'https://savestate.test');
  assert.equal(url.pathname,'/tavern');assert.equal(url.searchParams.get('tab'),'momentos');
  for(const field of ['player','game','post'])assert.equal(url.searchParams.get(field),id);
 }
 const next=new URL($('.highlight-carousel a').last().attr('href')!,'https://savestate.test');
 assert.equal(next.searchParams.get('category'),'speedrun');assert.equal(next.searchParams.get('page'),'3');
 assert.equal(names().includes('duel'),false);assert.equal(names().includes('forum'),false);
});
test('Momentos rejects invalid pages/categories/identifiers before making queries',async()=>{
 for(const bad of [{page:'0'},{page:'1001'},{page:'1.5'},{page:['2']},{category:'invalid'},{player:'not-a-uuid'},{game:'//evil.test'},{post:'1'}]){
  reset();
  await assert.rejects(TavernPage({searchParams:Promise.resolve({tab:'momentos',...bad})}),/NOT_FOUND/);
  assert.equal(state.calls.length,0);
 }
});
test('Momentos anonymous login keeps its canonical tab, filters and prefilled draft',async()=>{
 reset();state.user=null;
 const draft='Hazaña & trofeos #1',html=renderToStaticMarkup(await TavernPage({searchParams:Promise.resolve({tab:'momentos',category:'speedrun',draft,draftTitle:'Mi victoria'})}));
 const $=load(html),login=new URL($('a').filter((_,el)=>$(el).text()==='Conecta para publicar').attr('href')!,'https://savestate.test');
 const next=new URL(login.searchParams.get('next')!,'https://savestate.test');
 assert.equal(next.pathname,'/tavern');assert.equal(next.searchParams.get('tab'),'momentos');assert.equal(next.searchParams.get('draft'),draft);assert.equal(next.searchParams.get('category'),'speedrun');
 assert.equal(state.postProps,null);assert.match(html,/Todavía no hay momentos visibles/);
});
test('All three canonical tabs remain reachable with exactly one active link',async()=>{
 for(const tab of ['debates','momentos','arcade']){
  reset();const $=load(renderToStaticMarkup(await TavernPage({searchParams:Promise.resolve({tab})})));
  assert.equal($('.tavern-view-tabs a').length,3);assert.equal($('.tavern-view-tabs a[aria-current="page"]').length,1);
 }
 for(const tab of [undefined,'other',['arcade'],['momentos','arcade']])assert.equal(tavernTab(tab),'debates');
});
test('Legacy server redirects preserve repeated parameters, drafts and forced section tabs',async()=>{
 const search={tab:'arcade',player:'11111111-1111-4111-8111-111111111111',category:'speedrun',page:'2',draft:'á & #',draftTitle:'Victoria',q:['one','two']};
 for(const [section,tab] of [['forum','arcade'],['highlights','momentos'],['arcade','arcade'],['parties','arcade']]){
  const route=await import('../../src/app/'+section+'/page.tsx');
  let location='';
  try{await route.default({searchParams:Promise.resolve(search)});}catch(error){assert.ok(error instanceof Error);assert.ok(error.message.startsWith('REDIRECT:'));location=error.message.slice('REDIRECT:'.length);}
  const url=new URL(location,'https://savestate.test');
  assert.equal(url.pathname,'/tavern');assert.equal(url.searchParams.get('tab'),tab);assert.equal(url.searchParams.get('draft'),search.draft);assert.deepEqual(url.searchParams.getAll('q'),['one','two']);
 }
 assert.equal(legacyTavernHref({}),'/tavern');
 const config=(await import('../../next.config.ts')).default;
 const rules=await config.redirects!();
 for(const [source,destination] of [['/forum','/tavern'],['/taberna','/tavern'],['/highlights','/tavern?tab=momentos'],['/arcade','/tavern?tab=arcade'],['/parties','/tavern?tab=arcade']]){
  const rule=rules.find(r=>r.source===source);assert.equal(rule?.destination,destination);assert.equal(rule?.permanent,true);
 }
});
test('Navbar has a single Taberna entry and stays active on preserved forum detail routes',async()=>{
 const {HeaderNav}=await import('../../src/components/header-nav.tsx');
 for(const pathname of ['/tavern','/forum/retro-corner/thread-id']){
  state.pathname=pathname;const $=load(renderToStaticMarkup(HeaderNav()));
  assert.equal($('a[href="/tavern"]').length,1);assert.equal($('a[href="/forum"],a[href="/highlights"]').length,0);
  assert.equal($('a[aria-current="page"]').attr('href'),'/tavern');
 }
});
