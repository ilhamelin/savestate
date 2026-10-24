/* global document, innerWidth */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.RUNNER_TEMP+'/spec14-tools/node_modules/playwright/index.mjs').href);
const browser=await chromium.launch({executablePath:existsSync('/usr/bin/google-chrome')?'/usr/bin/google-chrome':undefined,headless:true,args:['--no-sandbox']});
const base='http://127.0.0.1:3000';
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const id='11111111-1111-4111-8111-111111111111',draft='Victoria & trofeos #1';
 const cases=[
  ['/forum?q=cooperativo&sort=active&channel=retro-corner',{q:'cooperativo',sort:'active',channel:'retro-corner'}],
  ['/forum?tab=arcade',{tab:'arcade'}],
  ['/taberna?tab=momentos',{tab:'momentos'}],
  ['/highlights?'+new URLSearchParams({tab:'arcade',category:'speedrun',page:'2',player:id,game:id,post:id,draft,draftTitle:'Mi título'}),{tab:'momentos',category:'speedrun',page:'2',player:id,game:id,post:id,draft,draftTitle:'Mi título'}],
  ['/arcade?platform=PC',{tab:'arcade',platform:'PC'}],
  ['/parties?page=2',{tab:'arcade',page:'2'}]
 ];
 for(const [path,expected] of cases){
  const response=await page.request.get(base+path,{maxRedirects:0});
  assert.equal(response.status(),308,path);
  const location=new URL(response.headers().location,base);
  assert.equal(location.pathname,'/tavern');
  for(const [key,value]of Object.entries(expected))assert.equal(location.searchParams.get(key),value,path+' preserves '+key);
 }
 const discord=await page.request.get(base+'/community/discord',{maxRedirects:0});
 assert.equal(discord.status(),308);assert.equal(new URL(discord.headers().location,base).pathname,'/chat');
 const detail=await page.request.get(base+'/forum/retro-corner',{maxRedirects:0});
 assert.equal(detail.status(),200,'Forum detail route remains available');
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});
  for(const tab of ['debates','momentos','arcade']){
   await page.goto(base+'/tavern'+(tab==='debates'?'':'?tab='+tab),{waitUntil:'domcontentloaded'});
   const nav=page.getByRole('navigation',{name:'Secciones de La Taberna'});
   await nav.waitFor();assert.equal(await nav.getByRole('link').count(),3);
   assert.equal(await nav.locator('[aria-current="page"]').count(),1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No overflow: '+tab+' at '+width);
   const main=page.getByRole('navigation',{name:'Navegación principal'});
   assert.equal(await main.getByRole('link',{name:'La Taberna',exact:true}).count(),1);
   assert.equal(await main.getByRole('link',{name:'Momentos',exact:true}).count(),0);
   assert.equal(await main.getByRole('link',{name:'Foro',exact:true}).count(),0);
  }
 }
 const nav=page.getByRole('navigation',{name:'Secciones de La Taberna'});
 await nav.getByRole('link',{name:'✨ Momentos Épicos',exact:true}).click();
 await page.waitForURL('**/tavern?tab=momentos');
 await page.getByRole('heading',{name:'Momentos & Jugadas Épicas.'}).waitFor();
 const active=page.getByRole('navigation',{name:'Secciones de La Taberna'}).locator('[aria-current="page"]');
 await active.focus();assert.equal(await active.evaluate(el=>el.matches(':focus-visible')),true);
 assert.deepEqual(errors,[]);
 console.log('PASS: SPEC-14 real Next 308 redirects, forced tabs, draft/UUID/category/page preservation, Discord alias, forum detail compatibility, navigation and 320/390/768/1440 px layouts.');
}finally{await browser.close();}
