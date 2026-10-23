/* global document, window */
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:4186';
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','4186'],{
 env:{...process.env,NEXT_PUBLIC_SUPABASE_URL:'',NEXT_PUBLIC_SUPABASE_ANON_KEY:'',SUPABASE_SERVICE_ROLE_KEY:'',GATEKEEPER_ENABLED:'false'},
 stdio:['ignore','pipe','pipe']
});
let logs='';child.stdout.on('data',chunk=>logs+=chunk);child.stderr.on('data',chunk=>logs+=chunk);
let browser;
try {
 let ready=false;
 for(let i=0;i<60;i++){try{const r=await fetch(base+'/forum',{signal:AbortSignal.timeout(2000)});if(r.ok){ready=true;break;}}catch{/* Retry while the production server starts. */}await delay(250);}
 assert.ok(ready,'Next server did not become ready: '+logs);
 for(const path of ['/arcade','/parties']){
  const response=await fetch(base+path,{redirect:'manual'});
  assert.equal(response.status,308);
  assert.equal(new URL(response.headers.get('location'),base).pathname+new URL(response.headers.get('location'),base).search,'/forum?tab=arcade');
 }
 browser=await chromium.launch({headless:true,...(existsSync('/usr/bin/google-chrome')?{channel:'chrome'}:{})});
 const page=await browser.newPage({viewport:{width:375,height:812}});
 const errors=[];page.on('pageerror',error=>{errors.push(error.message);console.log('PAGE_ERROR:',error.message);});
 await page.goto(base+'/forum');
 await page.getByRole('heading',{name:'Una comunidad. Mil conversaciones.',exact:true}).waitFor();
 const tabs=page.getByRole('navigation',{name:'Secciones del Foro',exact:true});
 assert.equal(await tabs.getByRole('link',{name:'💬 Debates Comunitarios',exact:true}).getAttribute('aria-current'),'page');
 assert.equal(await page.getByRole('navigation',{name:'Navegación principal',exact:true}).locator('a').count(),12);
 for(const width of [320,375,768]){
  await page.setViewportSize({width,height:812});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'overflow at '+width);
 }
 await tabs.getByRole('link',{name:'🕹️ Sala Arcade & LFG',exact:true}).click();
 await page.getByRole('heading',{name:'Sala Arcade & Convocatorias de Escuadrón',exact:true}).waitFor();
 assert.equal(new URL(page.url()).search,'?tab=arcade');
 assert.equal(await tabs.getByRole('link',{name:'🕹️ Sala Arcade & LFG',exact:true}).getAttribute('aria-current'),'page');
 const login=page.getByRole('link',{name:'Conecta para publicar',exact:true});
 assert.equal(await login.getAttribute('href'),'/login?next=/forum?tab=arcade');
 assert.ok(await page.getByRole('combobox',{name:'Plataforma',exact:true}).isDisabled());
 assert.equal(await page.getByRole('navigation',{name:'Navegación principal',exact:true}).getByRole('link',{name:'Foro',exact:true}).getAttribute('aria-current'),'page');
 await page.reload();
 await page.getByRole('heading',{name:'Sala Arcade & Convocatorias de Escuadrón',exact:true}).waitFor();
 await tabs.getByRole('link',{name:'💬 Debates Comunitarios',exact:true}).click();
 await page.getByRole('heading',{name:'Una comunidad. Mil conversaciones.',exact:true}).waitFor();
 await page.goto(base+'/forum?tab=arcade&tab=debates');
 await page.getByRole('heading',{name:'Una comunidad. Mil conversaciones.',exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('SPEC10_BROWSER_PASS: real Next.js production server, 308 aliases, strict duplicate-tab fallback, mobile 320/375/768px, 12 navbar links, active Forum on both tabs, navigation/deep-link/reload and canonical login; unconfigured providers stay disabled.');
} catch(error) {console.log('NEXT_SERVER_LOGS:',logs);throw error;}
finally {await browser?.close();child.kill('SIGTERM');}
