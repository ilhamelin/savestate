/* global document, window, getComputedStyle */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.RUNNER_TEMP + '/spec15-tools/node_modules/playwright/index.mjs'));
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const base = 'https://images.igdb.com/igdb/image/upload/t_screenshot_big/';
const game = {id:'00000000-0000-4000-8000-000000000001',igdb_id:1,title:'Gallery Fixture',slug:'gallery-fixture',cover_url:null,release_year:2026,platforms:['PC'],genres:[],developer:null,publisher:null,series:null,synopsis:null,cached_at:'2026-10-24',screenshots:[base+'sc_1.jpg',base+'sc_2.jpg',base+'sc_3.jpg'],community_rating:9,days_until_release:null,release_date:null};
async function setup(options={}) {
  const context=await browser.newContext({viewport:{width:1280,height:900},...options});
  const page=await context.newPage();
  const requests=[];const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://images.igdb.com/**',async route=>{
    requests.push(route.request().url());
    await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#164e63"/><text x="100" y="300" fill="white" font-size="80">GAMEPLAY PREVIEW</text></svg>'});
  });
  await page.route('**/api/catalogue?**',route=>route.fulfill({json:{games:[game,{...game,id:'empty',title:'No Captures',slug:'no-captures',screenshots:[]}],source:'igdb',message:null,nextOffset:null}}));
  await page.goto('http://localhost:3000/explore',{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Ver 3 capturas de Gallery Fixture',exact:true}).waitFor();
  return {context,page,requests,errors};
}
try {
  const {context,page,requests,errors}=await setup();
  const card=page.locator('.game-card').first();
  const trigger=page.getByRole('button',{name:'Ver 3 capturas de Gallery Fixture',exact:true});
  assert.equal(requests.length,0,'No screenshot prefetch before intent');
  assert.equal(await page.locator('.game-card').nth(1).locator('.game-gallery-trigger').count(),0);
  assert.equal(await card.locator('a button').count(),0);
  await card.hover();
  await page.waitForFunction(()=>document.querySelector('.game-card.is-peeking'));
  assert.ok(requests.some(url=>url.endsWith('sc_1.jpg')));
  await page.getByRole('button',{name:'Vista previa 2 de Gallery Fixture',exact:true}).hover();
  await page.waitForFunction(()=>document.querySelector('.game-card-peek img')?.getAttribute('src')?.endsWith('sc_2.jpg'));
  await page.mouse.move(0,0);
  assert.equal(await card.evaluate(el=>el.classList.contains('is-peeking')),false);
  await trigger.click();
  const modal=page.getByRole('dialog');
  await modal.waitFor();
  assert.ok(page.url().includes('/explore'));
  await page.getByRole('img',{name:'Captura 1 de Gallery Fixture',exact:true}).waitFor();
  assert.equal(await modal.evaluate(el=>el.open),true);
  await page.keyboard.press('ArrowLeft');
  await page.getByRole('img',{name:'Captura 3 de Gallery Fixture',exact:true}).waitFor();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('img',{name:'Captura 1 de Gallery Fixture',exact:true}).waitFor();
  await page.getByRole('button',{name:'Ver captura 2',exact:true}).click();
  await page.getByRole('img',{name:'Captura 2 de Gallery Fixture',exact:true}).waitFor();
  console.log('SPEC15_DESKTOP_JPEG:' + (await page.screenshot({type:'jpeg',quality:45})).toString('base64'));
  await page.keyboard.press('Tab');
  for(let i=0;i<14;i++){
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('dialog')),true,'Focus stays in native dialog');
  }
  await page.keyboard.press('Escape');
  await modal.waitFor({state:'hidden'});
  assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
  assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');
  await trigger.click();
  await page.mouse.click(2,2);
  await modal.waitFor({state:'hidden'});
  assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
  assert.deepEqual(errors,[]);
  console.log('PASS desktop: lazy peek, indicators, sibling buttons, arrows, thumbnails, Escape/backdrop, focus trap/return and scroll');
  await context.close();
  // Use a fresh browser cache: gallery thumbnails already loaded all three images above.
  const failed=await setup();
  await failed.page.unroute('https://images.igdb.com/**');
  await failed.page.route('https://images.igdb.com/**',route=>route.abort());
  await failed.page.locator('.game-card').first().hover();
  await failed.page.waitForFunction(()=>{
    const img=document.querySelector('.game-card-peek img');
    return img?.complete && img.naturalWidth===0;
  });
  assert.equal(await failed.page.locator('.game-card').first().evaluate(el=>el.classList.contains('is-peeking')),false);
  assert.deepEqual(failed.errors,[]);
  console.log('PASS failed image: original cover stays visible');
  await failed.context.close();
  const mobile=await setup({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await mobile.page.getByRole('button',{name:'Ver 3 capturas de Gallery Fixture',exact:true}).tap();
  await mobile.page.getByRole('dialog').waitFor();
  console.log('SPEC15_MOBILE_JPEG:' + (await mobile.page.screenshot({type:'jpeg',quality:45})).toString('base64'));
  assert.equal(await mobile.page.locator('.game-card.is-peeking').count(),0,'Touch does not peek');
  assert.equal(await mobile.page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'No horizontal overflow');
  await mobile.page.getByRole('button',{name:'Siguiente captura',exact:true}).tap();
  await mobile.page.getByRole('img',{name:'Captura 2 de Gallery Fixture',exact:true}).waitFor();
  await mobile.page.getByRole('button',{name:'Cerrar galería',exact:true}).tap();
  await mobile.page.getByRole('dialog').waitFor({state:'hidden'});
  assert.deepEqual(mobile.errors,[]);
  console.log('PASS mobile: normal cover, gallery, arrows, close, viewport fit');
  await mobile.context.close();
  const reduced=await setup({reducedMotion:'reduce'});
  await reduced.page.locator('.game-card').first().hover();
  assert.equal(await reduced.page.locator('.game-card .cover').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
  console.log('PASS reduced motion: no preview transitions');
  await reduced.context.close();
} finally { await browser.close(); }
