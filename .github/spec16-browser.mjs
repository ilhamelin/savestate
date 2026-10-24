/* global document, window, getComputedStyle */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.RUNNER_TEMP+'/spec16-tools/node_modules/playwright/index.mjs'));
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try {
  const context=await browser.newContext({viewport:{width:1280,height:1000}});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3000/game-meta-qa',{waitUntil:'commit'});
  await page.getByRole('heading',{name:'Game Meta QA',exact:true}).waitFor();
  await page.getByText('Consultando metadatos…',{exact:true}).waitFor();
  await page.locator('.game-meta-hub').waitFor();
  assert.equal(await page.locator('.game-meta-card').count(),3);
  const columns=await page.locator('.game-meta-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
  assert.equal(columns,3);
  assert.equal(await page.locator('.game-meta-record').innerText(),'1:24:12');
  assert.ok((await page.locator('.game-meta-proton').innerText()).includes('No equivale a la certificación de Valve'));
  assert.equal(await page.locator('a[href^="javascript:"]').count(),0);
  for(const link of await page.locator('.game-meta-hub a').all()){
    assert.equal(await link.getAttribute('target'),'_blank');
    assert.equal(await link.getAttribute('rel'),'noopener noreferrer');
  }
  console.log('SPEC16_DESKTOP_JPEG:'+(await page.locator('.game-meta-hub').screenshot({type:'jpeg',quality:60})).toString('base64'));
  await page.goto('http://localhost:3000/game-meta-qa?kind=partial',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('.game-meta-card').count(),1);
  await page.goto('http://localhost:3000/game-meta-qa?kind=empty',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('.game-meta-hub').count(),0);
  await page.goto('http://localhost:3000/game-meta-qa?kind=silver',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('.game-meta-deck').count(),0);
  assert.equal(await page.locator('[data-tier="silver"]').evaluate(el=>getComputedStyle(el).color),'rgb(148, 163, 184)');
  await page.goto('http://localhost:3000/game-meta-qa?kind=no-video',{waitUntil:'domcontentloaded'});
  assert.equal(await page.getByRole('link',{name:'▶ Ver carrera en video ↗',exact:true}).count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS desktop: Suspense streaming, 3 columns, tiers, safe links, partial and empty reports');
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const phone=await mobile.newPage();
  await phone.goto('http://localhost:3000/game-meta-qa',{waitUntil:'domcontentloaded'});
  assert.equal(await phone.locator('.game-meta-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),1);
  assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  console.log('SPEC16_MOBILE_JPEG:'+(await phone.locator('.game-meta-hub').screenshot({type:'jpeg',quality:60})).toString('base64'));
  console.log('PASS mobile: one column, no overflow, reduced-motion safe');
  await mobile.close();await context.close();
}finally{await browser.close();}
