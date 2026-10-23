import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, createRequire, stripTypeScriptTypes } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const fixtureUrl = 'data:text/javascript,' + encodeURIComponent(`
import {createElement as h} from '${pathToFileURL(require.resolve('react')).href}';
export const state={configured:true,calls:[],active:0,maxActive:0,user:null,duel:null,feed:{items:[],hasMore:false,generatedAt:0},partyProps:null,duelProps:null};
async function query(name,args,result){state.calls.push({name,args});state.active++;state.maxActive=Math.max(state.maxActive,state.active);await Promise.resolve();state.active--;return result;}
export function isConfigured(){return state.configured;}
export function currentUser(){return query('user',[],state.user);}
export function duelSummary(){return query('duel',[],state.duel);}
export function partyFeed(filters){return query('parties',[filters],state.feed);}
export function forumDirectory(...args){return query('forum',args,{categories:[{id:'retro-corner',name:'La Taberna Retro',description:'Canal retro',icon:'gamepad-2'}],stats:[],hot:[]});}
export function GameDuelWidget(props){state.duelProps=props;return h('section',{'data-duel':'true'},'Duelo interactivo');}
export function PartyBoard(props){state.partyProps=props;return h('section',{'data-parties':'true'},'Tablero LFG');}
export function SetupNotice(){return state.configured?null:h('aside',null,'Configuración pendiente');}
export function ForumCreate(){return h('section',{'data-create':'true'},'Crear hilo');}
export function ForumThreadList(){return h('section',{'data-threads':'true'},'Hilos');}
export default function Link({scroll,...props}){return h('a',props,props.children);}
`);
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.includes('/app/forum/page.tsx') &&
      ['next/link','@/lib/env','@/lib/session','@/services/arcade','@/services/forum','@/components/setup-notice','@/components/forum-create','@/components/forum-thread-list','@/components/game-duel-widget','@/components/arcade/party-board'].includes(specifier))
      return { url: fixtureUrl, shortCircuit: true };
    if (specifier.startsWith('@/')) {
      const path=resolve('src',specifier.slice(2));
      return {url:pathToFileURL(existsSync(path+'.ts')?path+'.ts':path+'.tsx').href,shortCircuit:true};
    }
    return next(specifier,context);
  },
  load(url,context,next) {
    if (url.startsWith('file:') && /\.tsx?$/.test(url) && !url.includes('node_modules')) {
      const source=readFileSync(fileURLToPath(url),'utf8');
      return {format:'module',source:url.endsWith('.tsx')
        ? ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
        : stripTypeScriptTypes(source,{mode:'transform'}),shortCircuit:true};
    }
    return next(url,context);
  },
});
test.after(()=>hooks.deregister());
const {state}=await import(fixtureUrl);
const {default:ForumPage}=await import('../../src/app/forum/page.tsx');
function reset() {
  Object.assign(state,{configured:true,calls:[],active:0,maxActive:0,user:{id:'viewer'},partyProps:null,duelProps:null,
    duel:{duel:{id:'duel',game_a_id:'a',game_b_id:'b',title:'Duelo semanal'},games:[{id:'b',title:'Zelda'},{id:'a',title:'Metroid'}],votes:{},ownVote:null},
    feed:{items:[],hasMore:false,generatedAt:0}});
}
function names(): string[] {return state.calls.map((call: {name:string})=>call.name).sort();}
test('Forum hub defaults to Debates, preserves search/sort/channel and fetches three independent queries concurrently',async()=>{
  reset();
  const html=renderToStaticMarkup(await ForumPage({searchParams:Promise.resolve({q:'  cooperativo  ',sort:'active',channel:'retro-corner'})}));
  assert.deepEqual(names(),['duel','forum','user']);
  assert.equal(state.maxActive,3);
  assert.deepEqual(state.calls.find((call:{name:string})=>call.name==='forum').args,['cooperativo','active','retro-corner']);
  assert.match(html,/href="\/forum"[^>]*aria-current="page"/);
  assert.match(html,/Metroid vs Zelda/);
  assert.match(html,/forum-arcade-banner/);
  assert.match(html,/data-threads="true"/);
  assert.doesNotMatch(html,/data-parties/);
});
test('Forum Arcade loads only duel, feed and user; passes viewer and canonical login through to existing clients',async()=>{
  reset();
  const html=renderToStaticMarkup(await ForumPage({searchParams:Promise.resolve({tab:'arcade',q:'ignored',sort:'unanswered'})}));
  assert.deepEqual(names(),['duel','parties','user']);
  assert.equal(state.maxActive,3);
  assert.deepEqual(state.calls.find((call:{name:string})=>call.name==='parties').args,[{page:1}]);
  assert.equal(state.partyProps.viewerId,'viewer');
  assert.equal(state.partyProps.configured,true);
  assert.equal(state.duelProps.authenticated,true);
  assert.equal(state.duelProps.loginHref,'/login?next=/forum?tab=arcade');
  assert.match(html,/href="\/forum\?tab=arcade"[^>]*aria-current="page"/);
  assert.match(html,/data-parties="true"/);
  assert.doesNotMatch(html,/data-threads|forum-channels-grid|forum-arcade-banner/);
});
test('Forum tab selection is strict: arrays, unknown values and debates resolve to Debates with safe filter defaults',async()=>{
  for(const tab of [undefined,'debates','other',['arcade'],['arcade','debates']]) {
    reset();state.user=null;state.duel=null;
    const html=renderToStaticMarkup(await ForumPage({searchParams:Promise.resolve({tab,q:['ignored'],sort:['active'],channel:['retro-corner']})}));
    assert.deepEqual(names(),['duel','forum','user']);
    assert.deepEqual(state.calls.find((call:{name:string})=>call.name==='forum').args,['','recent','']);
    assert.match(html,/Una comunidad\. Mil conversaciones\./);
    assert.doesNotMatch(html,/forum-arcade-banner/);
    assert.match(html,/href="\/login\?next=\/forum"/);
  }
});
test('Forum preserves navigation when unconfigured and skips all data providers instead of inventing content',async()=>{
  for(const tab of ['arcade','debates']) {
    reset();state.configured=false;state.user=null;
    const html=renderToStaticMarkup(await ForumPage({searchParams:Promise.resolve({tab})}));
    assert.match(html,/Secciones del Foro/);
    assert.match(html,/Configuración pendiente/);
    assert.ok(!names().includes('forum') && !names().includes('duel') && !names().includes('parties'));
    if(tab==='arcade') {assert.deepEqual(state.partyProps.initial,{items:[],hasMore:false,generatedAt:0});assert.equal(state.partyProps.configured,false);}
  }
});
test('Forum handles absent duels, anonymous Arcade and missing game metadata without showing undefined or leaking an own vote',async()=>{
  reset();state.duel=null;state.user=null;
  let html=renderToStaticMarkup(await ForumPage({searchParams:Promise.resolve({tab:'arcade'})}));
  assert.equal(state.partyProps.viewerId,null);
  assert.equal(state.duelProps,null);
  assert.match(html,/No hay un duelo activo/);
  reset();state.duel.games=[];
  html=renderToStaticMarkup(await ForumPage({searchParams:Promise.resolve({})}));
  assert.match(html,/Duelo semanal/);
  assert.doesNotMatch(html,/undefined/);
});
