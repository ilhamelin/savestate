/* global window, document, navigator, getComputedStyle */
import {chromium} from 'playwright';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const temp=process.env.RUNNER_TEMP;
await build({stdin:{contents:"\nimport React from 'react';import {createRoot} from 'react-dom/client';\nimport {GuardianCloudPanel} from './src/components/guardian/guardian-cloud-panel';\nwindow.stats={timers:new Map(),next:1,requests:0,aborts:0,active:0,maxActive:0,hold:false,status:200,visible:true,online:true};\nObject.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.stats.visible?'visible':'hidden'});\nObject.defineProperty(navigator,'onLine',{configurable:true,get:()=>window.stats.online});\nwindow.setTimeout=(callback,delay)=>{const id=window.stats.next++;window.stats.timers.set(id,{callback,delay});return id;};\nwindow.clearTimeout=id=>window.stats.timers.delete(id);\nconst now=Date.now(),sha='a'.repeat(40);\nconst deployment={id:'dpl_browser',url:'https://savestate-fixture.vercel.app',inspectorUrl:'https://vercel.com/team/savestate/dpl_browser',state:'BUILDING',target:'production',commitSha:sha,shortSha:'aaaaaaa',commitMessage:'Cloud monitor fixture',commitAuthor:'Tester',createdAt:now-60000,buildingAt:now-40000,readyAt:null,durationSec:40};\nwindow.feed={measuredAt:new Date().toISOString(),vercel:{configured:true,latestProduction:deployment,recentDeployments:[deployment,{...deployment,id:'preview',target:'preview',state:'READY'}]},\ngithub:{configured:true,updatedAt:new Date().toISOString(),recentCommits:[{sha,shortSha:'aaaaaaa',message:'Commit de prueba',author:'Tester',date:new Date().toISOString(),url:'https://github.com/ilhamelin/savestate/commit/'+sha,branch:'main · implementation/chatgpt'}],\nlatestWorkflowRun:{id:42,name:'CI Runner',status:'completed',conclusion:'success',headBranch:'implementation/chatgpt',shortSha:'aaaaaaa',runDurationSec:42,updatedAt:new Date().toISOString(),htmlUrl:'https://github.com/ilhamelin/savestate/actions/runs/42'},\nopenPullRequests:[{number:12,title:'Cloud feature',author:'Tester',htmlUrl:'https://github.com/ilhamelin/savestate/pull/12',headBranch:'feature/cloud',baseBranch:'implementation/chatgpt',draft:false,createdAt:new Date().toISOString()}]}};\nwindow.fetch=async(url,init={})=>{\n if(String(url)!=='/api/guardian/cloud-feed')throw Error('Unexpected URL');\n window.stats.requests++;window.stats.active++;window.stats.maxActive=Math.max(window.stats.maxActive,window.stats.active);\n try {\n  if(window.stats.hold)await new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>{window.stats.aborts++;reject(new DOMException('Aborted','AbortError'));},{once:true}));\n  return Response.json(window.stats.status===200?window.feed:{error:'Forbidden'},{status:window.stats.status});\n } finally {window.stats.active--;}\n};\nconst root=createRoot(document.getElementById('app'));\nroot.render(<React.StrictMode><main className=\"guardian-app-viewport\"><div className=\"guardian-mobile-body\"><GuardianCloudPanel/></div></main></React.StrictMode>);\nwindow.unmountCloud=()=>root.unmount();\n",resolveDir:process.cwd(),loader:'tsx'},alias:{'@':process.cwd()+'/src'},
 nodePaths:[process.cwd()+'/node_modules'],bundle:true,outfile:temp+'/cloud.js',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
const css=readdirSync('.next/static/chunks').filter(p=>p.endsWith('.css')).map(p=>readFileSync('.next/static/chunks/'+p,'utf8')).join('\n');
const html='<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><div id="app"></div><script src="/cloud.js"></script>';
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/cloud.js'?'text/javascript':'text/html');res.end(req.url==='/cloud.js'?readFileSync(temp+'/cloud.js'):html);});
await new Promise(resolve=>server.listen(4176,'127.0.0.1',resolve));
const browser=await chromium.launch({...existsSync('/usr/bin/google-chrome')?{channel:'chrome'}:{},headless:true});
try {
 const page=await browser.newPage({viewport:{width:375,height:812}});
 const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4176'))external.push(r.url());});
 await page.goto('http://127.0.0.1:4176/guardian');
 await page.getByText('✓ PASS (check)',{exact:true}).waitFor();
 await page.evaluate(()=>{for(const [id,t] of window.stats.timers)if(t.delay===0){window.stats.timers.delete(id);t.callback();}});
 await page.getByRole('button',{name:'↻ Refrescar ahora',exact:true}).waitFor();
 await page.waitForFunction(()=>[...window.stats.timers.values()].some(t=>t.delay===30000));
 assert.equal(await page.locator('.cloud-state[data-building=true]').first().textContent(),'BUILDING');
 assert.equal(await page.getByRole('link',{name:'Abrir logs del runner ↗'}).getAttribute('rel'),'noopener noreferrer');
 await page.getByRole('link',{name:'#12 · Cloud feature',exact:true}).waitFor();
 await page.getByRole('link',{name:'aaaaaaa · Commit de prueba',exact:true}).waitFor();
 await page.getByText('main',{exact:true}).waitFor();await page.getByText('chatgpt',{exact:true}).waitFor();
 const before=await page.evaluate(()=>window.stats.requests);
 await page.evaluate(()=>{const [id,t]=[...window.stats.timers.entries()].find(([,t])=>t.delay===30000);window.stats.timers.delete(id);t.callback();});
 await page.waitForFunction(count=>window.stats.requests===count+1,before);
 await page.getByRole('button',{name:'↻ Refrescar ahora',exact:true}).waitFor();
 for(const width of [320,375,768]){
  await page.setViewportSize({width,height:812});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.cloud-state[data-building=true]').first().evaluate(el=>getComputedStyle(el).animationName),'none');
 await page.evaluate(()=>window.stats.hold=true);
 await page.getByRole('button',{name:'↻ Refrescar ahora',exact:true}).click();
 await page.getByRole('button',{name:'Consultando…',exact:true}).waitFor();
 const held=await page.evaluate(()=>window.stats.requests);
 assert.equal(await page.getByRole('button',{name:'Consultando…',exact:true}).isDisabled(),true);
 await page.evaluate(()=>{window.stats.visible=false;document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForFunction(()=>window.stats.active===0&&window.stats.timers.size===0);
 assert.equal(await page.evaluate(()=>window.stats.requests),held);
 assert.ok(await page.evaluate(()=>window.stats.aborts>=1));
 await page.evaluate(()=>{window.stats.hold=false;window.stats.visible=true;document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForFunction(count=>window.stats.requests===count+1,held);
 await page.getByRole('button',{name:'↻ Refrescar ahora',exact:true}).waitFor();
 await page.evaluate(()=>{window.stats.online=false;window.dispatchEvent(new Event('offline'));});
 await page.waitForFunction(()=>window.stats.timers.size===0);
 assert.equal(await page.getByRole('button',{name:'↻ Refrescar ahora',exact:true}).isDisabled(),true);
 await page.evaluate(()=>{window.stats.online=true;window.dispatchEvent(new Event('online'));});
 await page.getByRole('button',{name:'↻ Refrescar ahora',exact:true}).waitFor();
 await page.evaluate(()=>window.stats.status=403);
 await page.getByRole('button',{name:'↻ Refrescar ahora',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Vuelve a iniciar sesión'}).waitFor();
 assert.equal(await page.getByRole('link',{name:'aaaaaaa · Commit de prueba',exact:true}).count(),0);
 assert.equal(await page.getByText(/Cloud monitor fixture/).count(),0);
 await page.evaluate(()=>{window.stats.status=200;window.stats.hold=true;});
 await page.getByRole('button',{name:'↻ Refrescar ahora',exact:true}).click();
 await page.getByRole('button',{name:'Consultando…',exact:true}).waitFor();
 await page.evaluate(()=>window.unmountCloud());
 await page.waitForFunction(()=>window.stats.active===0&&window.stats.timers.size===0);
 assert.equal(await page.evaluate(()=>window.stats.maxActive),1);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 console.log('SPEC06_BROWSER_PASS: mobile 320–768px, provider cards and links, 30s scheduler, no overlap, hidden/offline abort, single resume, revoked-auth data clearing, reduced motion, unmount cleanup; zero external requests/runtime errors.');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
