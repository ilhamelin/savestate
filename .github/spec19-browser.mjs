/* global document, window */
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.RUNNER_TEMP+'/spec19-tools/node_modules/playwright/index.mjs'));
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const base='http://localhost:3000/games/god-of-war--1/resilience-qa';
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 const page=await context.newPage();
 await page.route('**/fixture-achievement.png',route=>route.abort());
 const core=async()=>{
   await page.getByRole('heading',{name:'God of War',exact:true}).waitFor();
   await page.getByRole('textbox',{name:'Reseña',exact:true}).fill('Still usable');
   assert.equal(await page.locator('.site-header').count(),1);
   assert.equal(await page.locator('.site-footer').count(),1);
   assert.equal(await page.getByText('ERROR CRÍTICO // CHECKPOINT CORRUPT',{exact:true}).count(),0);
 };
 let response=await page.goto(base,{waitUntil:'domcontentloaded'});
 assert.equal(response.status(),200);await core();
 await page.getByRole('heading',{name:'Logros y Rareza Global',exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('.achievement-img')?.style.display==='none');
 assert.equal(await page.locator('time').count(),0);
 assert.equal(await page.locator('.achievement-bar-fill').getAttribute('style'),'width:4%');
 assert.equal(await page.locator('[data-widget-fallback]').count(),0);
 console.log('PASS healthy RSC: achievement onError is a client island, invalid dates/percentages do not break rendering');
 const scenarios=[['load',null],['render','meta'],['serialization','critic'],['client','forum']];
 for(const [fault,slot]of scenarios){
   response=await page.goto(base+'?fault='+fault,{waitUntil:'domcontentloaded'});
   assert.equal(response.status(),200);await core();
   if(slot)await page.locator('[data-widget-fallback="'+slot+'"]').waitFor();
   await page.getByRole('heading',{name:'Logros y Rareza Global',exact:true}).waitFor();
   console.log('PASS isolated failure: '+fault);
 }
 await page.goto(base+'?fault=fatal',{waitUntil:'domcontentloaded'});
 await page.getByText('SEÑAL DEL JUEGO INTERRUMPIDA // RECONEXIÓN',{exact:true}).waitFor();
 assert.equal(await page.locator('.site-header').count(),1);
 assert.equal(await page.locator('.site-footer').count(),1);
 assert.equal(await page.getByText('ERROR CRÍTICO // CHECKPOINT CORRUPT',{exact:true}).count(),0);
 assert.ok((await page.locator('[role="alert"]').innerText()).includes('Código de error:'));
 assert.equal(await page.getByRole('link',{name:'Regresar al catálogo',exact:true}).getAttribute('href'),'/explore');
 console.log('SPEC19_ERROR_JPEG:'+(await page.locator('[role="alert"]').screenshot({type:'jpeg',quality:60})).toString('base64'));
 await context.addCookies([{name:'s19_recovered',value:'1',url:'http://localhost:3000'}]);
 await page.getByRole('button',{name:'Reintentar sincronización',exact:true}).click();
 await core();
 console.log('PASS segment error: header/footer retained, safe digest shown, retry re-fetches and recovers');
 await page.setViewportSize({width:390,height:844});
 await page.goto(base,{waitUntil:'domcontentloaded'});await core();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 console.log('PASS mobile: preserved core and responsive error isolation');
 await context.close();
}finally{await browser.close();}
