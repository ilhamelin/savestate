/* global window, document */
import { chromium } from 'playwright';
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const temp=process.env.RUNNER_TEMP;
await build({
 stdin:{contents:"\nimport React from 'react';import {createRoot} from 'react-dom/client';\nimport {FeedbackModal} from './src/components/support/feedback-modal';\nimport {GuardianJiraPanel} from './src/components/guardian/guardian-jira-panel';\nwindow.stats={requests:[],intervals:new Set(),queued:false};\nconst interval=window.setInterval.bind(window),clear=window.clearInterval.bind(window);\nwindow.setInterval=(cb,...args)=>{const id=interval(cb,...args);window.stats.intervals.add(id);return id;};\nwindow.clearInterval=id=>{window.stats.intervals.delete(id);clear(id);};\nlet escalated=false;\nconst config={instanceUrl:'https://portal-solicitudes-dev.atlassian.net',portalUrl:'https://portal-solicitudes-jira.vercel.app',projectKey:'SOL'};\nwindow.fetch=async(url,init={})=>{\n const data=init.body?JSON.parse(init.body):null;\n window.stats.requests.push({url:String(url),method:init.method||'GET',data});\n if(init.method==='POST'&&String(url).includes('/support/tickets'))return Response.json({data:{ticketId:window.stats.queued?'LOCAL-fixture':'SOL-149',status:window.stats.queued?'queued':'synced_jira',message:window.stats.queued?'Reporte guardado en la bitácora':'Ticket recibido en Jira.',jiraUrl:window.stats.queued?undefined:config.instanceUrl+'/browse/SOL-149'}});\n if(init.method==='POST'&&data?.action==='escalate'){escalated=true;return Response.json({data:{ticketId:'SOL-150',message:'Ticket recibido en Jira.'}});}\n if(init.method==='POST')return Response.json({processed:1});\n if(String(url).includes('/support/tickets'))return Response.json({config,connection:'online',authenticated:true,tickets:[{id:'fixture',input:{title:'Reporte de prueba',type:'bug'},status:'queued',created_at:'2026-10-22T00:00:00Z'}]});\n return Response.json({events:[{id:'incident',message:'Error de prueba',pathname:'/library',timestamp:'2026-10-22T00:00:00Z',stack:'Error: test\\n at /library',escalatedToJira:escalated}]});\n};\nconst root=createRoot(document.getElementById('app'));\nconst render=panel=>root.render(<React.StrictMode>{panel?<main className=\"guardian-app-viewport\"><GuardianJiraPanel/></main>:<FeedbackModal/>}</React.StrictMode>);\nwindow.showPanel=()=>render(true);window.showFooter=()=>render(false);window.unmount=()=>root.unmount();\nrender(false);\n",resolveDir:process.cwd(),loader:'tsx'},
 alias:{'@':process.cwd()+'/src'},nodePaths:[process.cwd()+'/node_modules'],
 bundle:true,write:true,outfile:temp+'/support.js',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},
});
const css=readdirSync('.next/static/chunks').filter(p=>p.endsWith('.css')).map(p=>readFileSync('.next/static/chunks/'+p,'utf8')).join('\n');
const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="app"></div><script src="/support.js"></script></body></html>';
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/support.js'?'text/javascript':'text/html');res.end(req.url==='/support.js'?readFileSync(temp+'/support.js'):html);});
await new Promise(resolve=>server.listen(4174,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:375,height:812}});
 const errors=[];const network=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{if(!request.url().startsWith('http://127.0.0.1:4174'))network.push(request.url());});
 await page.goto('http://127.0.0.1:4174/library?private=1');
 const trigger=page.getByRole('button',{name:'👾 Reportar bug / Sugerir juego',exact:true});
 await trigger.click();
 const dialog=page.getByRole('dialog',{name:'Transmitir un reporte'});
 await dialog.waitFor();
 assert.ok(await dialog.evaluate(node=>node.open));
 await page.getByLabel('Título',{exact:true}).fill('Feature de prueba');
 await page.getByLabel('Detalle',{exact:true}).fill('Descripción de prueba del formulario.');
 await page.getByRole('button',{name:'⚡ Feature',exact:true}).click();
 for(let i=0;i<12;i++){await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.querySelector('dialog').contains(document.activeElement)));}
 await page.keyboard.press('Escape');
 assert.equal(await dialog.isVisible(),false);
 assert.ok(await trigger.evaluate(node=>node===document.activeElement));
 await trigger.click();
 await page.getByRole('button',{name:'Transmitir ticket →',exact:true}).click();
 await page.getByText('✓ SOL-149',{exact:true}).waitFor();
 const payload=await page.evaluate(()=>window.stats.requests.find(item=>item.method==='POST').data);
 assert.equal(payload.type,'feature_request');assert.equal(payload.pageUrl,'/library');
 assert.ok(!JSON.stringify(payload).includes('private=1'));
 assert.equal(await page.getByRole('link',{name:'Ver ticket en Jira ↗'}).getAttribute('rel'),'noopener noreferrer');
 await page.keyboard.press('Escape');
 await trigger.click();
 await page.getByText('✓ SOL-149',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Nuevo reporte',exact:true}).click();
 await page.evaluate(()=>window.stats.queued=true);
 await page.getByLabel('Título',{exact:true}).fill('Reporte en cola');
 await page.getByLabel('Detalle',{exact:true}).fill('Descripción suficiente para quedar en cola.');
 await page.getByRole('button',{name:'Transmitir ticket →',exact:true}).click();
 await page.getByText('✓ LOCAL-fixture',{exact:true}).waitFor();
 for(const width of [320,375,768,1280]){
  await page.setViewportSize({width,height:812});
  const box=await dialog.boundingBox();
  assert.ok(box.x>=0&&box.x+box.width<=width+1);
  assert.ok(box.y>=0&&box.y+box.height<=812+1);
 }
 await page.keyboard.press('Escape');
 await page.evaluate(()=>window.showPanel());
 await page.getByText('Reporte de prueba',{exact:true}).waitFor();
 await page.getByRole('button',{name:'⚡ Escalar a Jira',exact:true}).click();
 await page.getByRole('button',{name:'✓ Reporte registrado',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'✓ Reporte registrado',exact:true}).isDisabled(),true);
 assert.ok(await page.evaluate(()=>window.stats.requests.some(item=>item.data?.action==='escalate'&&item.data.id==='incident')));
 await page.getByRole('button',{name:'↻ Reintentar / conciliar cola',exact:true}).click();
 await page.getByText('Cola revisada.',{exact:true}).waitFor();
 const before=await page.evaluate(()=>window.stats.requests.length);
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForTimeout(100);
 assert.equal(await page.evaluate(()=>window.stats.requests.length),before);
 await page.evaluate(()=>window.unmount());
 assert.equal(await page.evaluate(()=>window.stats.intervals.size),0);
 assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
 console.log('SPEC05_BROWSER_PASS: native dialog focus trap, Escape/focus restoration, categories, sanitized-context payload, honest queued/synced states, responsive 320–1280px, Guardian escalation/retry, hidden-tab pause and timer cleanup; zero external requests and zero runtime errors.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
