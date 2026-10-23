/* global window, document, getComputedStyle */
import { chromium } from 'playwright';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const temp = process.env.RUNNER_TEMP;
writeFileSync(temp + '/nav.mjs', 'export function useRouter(){return {refresh(){}};}');
writeFileSync(temp + '/link.mjs', "import React from 'react';export default function Link(props){return React.createElement('a',props,props.children);}");
await build({ stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React from 'react';import {createRoot} from 'react-dom/client';
import {PartyBoard} from './src/components/arcade/party-board';
const user='00000000-0000-0000-0000-000000000001',game='00000000-0000-0000-0000-000000000002';
const now=Date.now();
window.fixture={requests:[],failure:false,aborted:0};
const row=(i,platform='PC',playstyle='casual')=>({
 id:'row-'+i,user_id:user,game_id:game,platform,playstyle,schedule:'Viernes 21:00 GMT-3',
 contact_note:'Discord: @player-'+i,created_at:new Date(now).toISOString(),expires_at:new Date(now+48*3600000).toISOString(),
 game:{id:game,title:'Test Game '+i,slug:'test-game',cover_url:null},
 author:{id:user,username:'tester',avatar_url:null,level:10}
});
let rows=[...Array.from({length:15},(_,i)=>row(i)),row(16,'Xbox','competitive')];
const feed=(platform='',style='',page=1)=>{
 const filtered=rows.filter(row=>(!platform||row.platform===platform)&&(!style||row.playstyle===style));
 return {items:filtered.slice((page-1)*12,page*12),hasMore:filtered.length>page*12,generatedAt:Date.now()};
};
window.fetch=async(input,init={})=>{
 const url=new URL(String(input),window.location.origin);
 window.fixture.requests.push({url:url.pathname+url.search,method:init.method??'GET'});
 if(url.pathname==='/api/catalogue')return Response.json({games:[{id:game,title:'Elden Ring',release_year:2022}],message:null,nextOffset:null});
 if(url.pathname!=='/api/parties')throw Error('Unexpected request '+url.pathname);
 if(init.method==='POST'){
  const body=JSON.parse(init.body);
  if(body.action==='delete'){rows=rows.filter(row=>row.id!==body.id);return Response.json({data:{deleted:true}});}
  rows=[{...row('created'),...body,game:{id:game,title:'Elden Ring',slug:'elden-ring',cover_url:null}},...rows];
  return Response.json({data:{created:true}});
 }
 await new Promise((resolve,reject)=>{
  const cancel=()=>{clearTimeout(timer);window.fixture.aborted++;reject(new DOMException('Aborted','AbortError'));};
  const timer=setTimeout(()=>{init.signal?.removeEventListener('abort',cancel);resolve();},120);
  init.signal?.addEventListener('abort',cancel,{once:true});
 });
 if(window.fixture.failure)return Response.json({error:'Feed unavailable'},{status:503});
 return Response.json({data:feed(url.searchParams.get('platform')??'',url.searchParams.get('playstyle')??'',Number(url.searchParams.get('page')??1))});
};
const initial=feed();initial.items.push({...row('expired'),expires_at:new Date(now-1000).toISOString()});
createRoot(document.getElementById('app')).render(<main className="container"><div className="arcade-section"><PartyBoard initial={initial} viewerId={user}/></div></main>);
` }, alias: { '@': process.cwd()+'/src', 'next/navigation': temp+'/nav.mjs', 'next/link': temp+'/link.mjs' },
 nodePaths:[process.cwd()+'/node_modules'], bundle:true, outfile:temp+'/arcade.js', jsx:'automatic',
 define:{'process.env.NODE_ENV':'"production"'} });
const css=readdirSync('.next/static/chunks').filter(p=>p.endsWith('.css')).map(p=>readFileSync('.next/static/chunks/'+p,'utf8')).join('\n');
const html='<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><div id="app"></div><script src="/arcade.js"></script>';
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/arcade.js'?'text/javascript':'text/html');res.end(req.url==='/arcade.js'?readFileSync(temp+'/arcade.js'):html);});
await new Promise(resolve=>server.listen(4178,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(existsSync('/usr/bin/google-chrome')?{channel:'chrome'}:{})});
try {
 const page=await browser.newPage({viewport:{width:375,height:812}});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:4178/arcade');
 await page.getByRole('heading',{name:'Compañeros de partida'}).waitFor();
 assert.equal(await page.locator('.party-card').count(),12);
 assert.equal(await page.getByText('Discord: @player-expired',{exact:true}).count(),0);
 for(const width of [320,375,768]){
  await page.setViewportSize({width,height:812});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
  const columns=await page.locator('.party-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
  assert.equal(columns,width<640?1:2);
 }
 await page.getByRole('button',{name:'Siguiente →',exact:true}).click();
 await page.getByText('Página 2',{exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelectorAll('.party-card').length===4);
 await page.getByLabel('Plataforma',{exact:true}).selectOption('Xbox');
 await page.waitForFunction(()=>document.querySelectorAll('.party-card').length===1);
 await page.getByText('Página 1',{exact:true}).waitFor();
 await page.getByLabel('Estilo',{exact:true}).selectOption('achievements');
 await page.getByText(/No hay convocatorias activas/).waitFor();
 await page.getByLabel('Estilo',{exact:true}).selectOption('competitive');
 await page.getByText('Discord: @player-16',{exact:true}).waitFor();
 await page.getByRole('button',{name:'+ Publicar Convocatoria',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.waitFor();
 assert.ok(await page.evaluate(()=>document.querySelector('dialog').contains(document.activeElement)));
 await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);
 assert.equal(await page.getByRole('button',{name:'+ Publicar Convocatoria',exact:true}).evaluate(el=>el===document.activeElement),true);
 await page.getByRole('button',{name:'+ Publicar Convocatoria',exact:true}).click();
 await page.getByLabel('Buscar en todo el catálogo',{exact:true}).fill('Elden');
 await page.getByLabel('Juego',{exact:true}).selectOption('00000000-0000-0000-0000-000000000002');
 await page.getByLabel('Horario disponible',{exact:true}).fill('Viernes 22:00 GMT-3');
 await page.getByLabel('Nota de contacto',{exact:true}).fill('<script>window.xss=true</script> Discord @safe');
 await dialog.getByRole('button',{name:'Publicar convocatoria',exact:true}).click();
 await page.getByText('Convocatoria publicada. ¡Tu escuadrón te espera!',{exact:true}).waitFor();
 await page.getByText('<script>window.xss=true</script> Discord @safe',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.xss),undefined);
 assert.equal(await page.getByLabel('Plataforma',{exact:true}).inputValue(),'');
 page.once('dialog',dialog=>dialog.accept());
 await page.locator('.party-card').filter({hasText:'Elden Ring'}).getByRole('button',{name:'✕ Retirar',exact:true}).click();
 await page.getByText('Convocatoria retirada.',{exact:true}).waitFor();
 await page.waitForFunction(()=>!document.body.textContent.includes('Discord @safe'));
 await page.evaluate(()=>window.fixture.failure=true);
 await page.getByRole('button',{name:'↻ Actualizar',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Feed unavailable'}).waitFor();
 await page.evaluate(()=>window.fixture.failure=false);
 await page.getByRole('button',{name:'↻ Actualizar',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.party-card').length===12);
 assert.deepEqual(errors,[]);
 console.log('SPEC08_BROWSER_PASS: mobile grid 320/375/768, pagination/filter reset, empty state, expired hidden, native modal focus/Escape/restoration, catalogue selection, create/refetch, plain-text XSS, confirmed delete/refetch and failed-feed recovery.');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
