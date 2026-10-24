import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import type { GameLiveTelemetry, GameDealItem } from '../../src/domain/game-live-telemetry.ts';

const imageFixture='data:text/javascript,'+encodeURIComponent(`
 import {createElement} from 'react';
 export default function Image({unoptimized,...props}){return createElement('img',props);}
`);
const hooks=registerHooks({
 resolve(specifier,context,next){
  if(specifier==='next/image')return {url:imageFixture,shortCircuit:true};
  if(specifier.endsWith('.css'))return {url:'data:text/javascript,export {};',shortCircuit:true};
  if(specifier.startsWith('@/'))return {url:pathToFileURL(resolve('src',specifier.slice(2)+'.ts')).href,shortCircuit:true};
  return next(specifier,context);
 },
 load(url,context,next){
  if(url.startsWith('file:')&&/\.tsx?$/.test(url)&&!url.includes('node_modules'))return {format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,shortCircuit:true};
  return next(url,context);
 }
});
after(()=>hooks.deregister());
const {GameLiveTelemetryView}=await import('../../src/components/game-live-telemetry-view.tsx');
const empty:GameLiveTelemetry={steamAppId:null,steamCurrentPlayers:null,historicalLow:null,deals:[],twitchStreams:[],twitchTotalTopViewers:0};
const deal=(patch:Partial<GameDealItem>={}):GameDealItem=>({dealId:'steam',storeName:'Steam',salePrice:'49.99',normalPrice:'49.99',savingsPercent:0,dealUrl:'https://www.cheapshark.com/redirect?dealID=fixture',...patch});
const render=(data:GameLiveTelemetry=empty,title='The Witcher 3')=>load(renderToStaticMarkup(createElement(GameLiveTelemetryView,{data,title})));
const full:GameLiveTelemetry={
 ...empty,usdToClpRate:1000,steamAppId:292030,steamCurrentPlayers:68285,historicalLow:{price:'7.09',dateIso:null},
 deals:[deal(),deal({dealId:'gog',storeName:'GOG',normalPrice:'49.99',salePrice:'24.99',savingsPercent:50})],
 twitchStreams:[{id:'one',userName:'Streamer',userLogin:'streamer',title:'Un título completo de Twitch',viewerCount:1442,language:'es',thumbnailUrl:'https://static-cdn.jtvnw.net/fixture.jpg',streamUrl:'https://www.twitch.tv/streamer'}],
 twitchTotalTopViewers:1442
};
test('Live radar renders three KPI cards with Steam, aggregate Twitch and historical USD/CLP',()=>{
 const $=render(full);
 assert.equal($('.radar-stat-card').length,3);
 assert.equal($('[data-metric="steam"] > strong').text(),'68.285');
 assert.equal($('[data-metric="twitch"] > strong').text(),'1.442');
 assert.equal($('[data-metric="low"] > strong').text(),'$7.09 USD');
 assert.equal($('[data-metric="low"] .radar-clp-price').text(),'(~$7.090 CLP)');
 assert.equal($('.radar-live-dot').length,2);
 assert.match($('.radar-rate').text(),/1 USD ≈ \$1\.000 CLP/);
 assert.equal($('.notice').length,0);
});
test('Only discounted offers render the original deleted price and savings badge',()=>{
 const $=render(full);
 const steam=$('.radar-deal-row').filter((_,el)=>$(el).find('[data-store="steam"]').length>0);
 const gog=$('.radar-deal-row').filter((_,el)=>$(el).find('[data-store="gog"]').length>0);
 assert.equal(steam.find('del').length,0);assert.equal(steam.find('.radar-savings-tag').length,0);
 assert.equal(steam.find('.radar-current-price strong').text(),'$49.99 USD');
 assert.equal(steam.find('.radar-current-price .radar-clp-price').text(),'(~$49.990 CLP)');
 assert.match(steam.text(),/Sin descuento/);
 assert.equal(gog.find('del').length,1);assert.match(gog.find('del').text(),/\$49\.99 USD/);
 assert.equal(gog.find('.radar-savings-tag').text(),'-50%');
 assert.equal(gog.find('.radar-current-price strong').text(),'$24.99 USD');
 assert.equal(gog.find('.radar-current-price .radar-clp-price').text(),'(~$24.990 CLP)');
});
test('Free offers retain 100% savings while missing currency rates never produce invalid CLP',()=>{
 const $=render({...empty,deals:[deal({normalPrice:'9.99',salePrice:'0.00',savingsPercent:100})]});
 assert.equal($('.radar-savings-tag').text(),'-100%');
 assert.equal($('.radar-current-price strong').text(),'$0.00 USD');
 assert.equal($('.radar-current-price .radar-clp-price').text(),'');
 assert.equal($('.radar-rate').length,0);
 for(const rate of [null,0,-1,NaN,Infinity]){
  const page=render({...full,usdToClpRate:rate});
  assert.equal(page('.radar-rate').length,0);
  assert.doesNotMatch(page('.game-live-radar').text(),/NaN|Infinity|undefined/);
 }
});
test('Instant Gaming is a labeled keyshop search with correctly encoded title and safe external links',()=>{
 const title='Portal 2 & DLC? #retro', $=render(empty,title);
 const row=$('.radar-instant-gaming-row');
 assert.match(row.text(),/Instant Gaming/);assert.equal(row.find('[data-store="instant-gaming"]').text(),'KEYSHOP');
 assert.equal(row.find('a').attr('href'),'https://www.instant-gaming.com/es/busqueda/?q='+encodeURIComponent(title));
 assert.equal(row.find('del').length,0);assert.equal(row.find('.radar-savings-tag').length,0);
 for(const el of $('a[target="_blank"]').toArray())assert.match($(el).attr('rel')!,/noopener noreferrer/);
});
test('Twitch cards retain complete tooltip titles, lazy decorative images and viewer counts',()=>{
 const $=render(full), card=$('.radar-stream-card');
 assert.equal(card.find('.radar-stream-copy p').attr('title'),full.twitchStreams[0]!.title);
 assert.equal(card.find('p').text(),full.twitchStreams[0]!.title);
 assert.match(card.find('.radar-stream-viewers').text(),/EN VIVO · 1\.442 esp\./);
 assert.equal(card.attr('href'),'https://www.twitch.tv/streamer');
 assert.equal(card.find('img').attr('loading'),'lazy');
 assert.equal(card.find('img').attr('alt'),'');
 const missing=render({...full,twitchStreams:[{...full.twitchStreams[0]!,thumbnailUrl:''}]});
 assert.equal(missing('.radar-stream-card img').length,0);
 assert.equal(missing('.radar-stream-viewers').length,1);
});
test('Radar caps offers and streams at four without changing caller-owned input',()=>{
 const data={...full,deals:Array.from({length:6},(_,i)=>deal({dealId:String(i)})),twitchStreams:Array.from({length:6},(_,i)=>({...full.twitchStreams[0]!,id:String(i)}))};
 const original=structuredClone(data), $=render(data);
 assert.equal($('.radar-deal-row:not(.radar-instant-gaming-row)').length,4);
 assert.equal($('.radar-stream-card').length,4);
 assert.deepEqual(data,original);
});
test('Empty telemetry and valid zero player counts have distinct truthful states',()=>{
 const $=render();
 assert.match($('.notice').text(),/No hay datos disponibles/);
 assert.equal($('.radar-system-status').text(),'SYS: SIN DATOS');
 assert.equal($('[data-metric="steam"] > strong').text(),'Sin datos');
 assert.equal($('[data-metric="low"] > strong').text(),'Sin registro');
 assert.equal($('.radar-streams-section').length,0);assert.equal($('.radar-live-dot').length,0);
 const zero=render({...empty,steamCurrentPlayers:0});
 assert.equal(zero('.notice').length,0);
 assert.equal(zero('[data-metric="steam"] > strong').text(),'0');
 assert.equal(zero('.radar-system-status').text(),'SYS: ACTIVE');
 assert.match(zero('.radar-footer').text(),/975 CLP/);
});
test('React safely escapes untrusted game and stream titles while keeping semantic sections',()=>{
 const dangerous='<script>alert("x")</script>', $=render({...full,twitchStreams:[{...full.twitchStreams[0]!,title:dangerous}]},dangerous);
 assert.equal($('script').length,0);
 assert.equal($('.radar-stream-copy p').attr('title'),dangerous);
 assert.equal($('.game-live-radar').attr('aria-label'),'Telemetría en vivo y ofertas');
 assert.match($('h2').text(),new RegExp('El pulso de'));
 assert.equal($('.radar-footer a').attr('href'),'https://www.exchangerate-api.com');
});
