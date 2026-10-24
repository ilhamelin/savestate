import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(process.env.RUNNER_TEMP + '/spec12-tools/node_modules/playwright/index.mjs').href);
const browser = await chromium.launch({executablePath: existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined,headless:true,args:['--no-sandbox']});
const base='http://127.0.0.1:3000';
const report={
 defconLevel:5,defconMetadata:{updatedAt:new Date().toISOString(),updatedBy:'fixture-operator',reason:'Initial posture'},
 quarantinedCount:1,quarantinedIps:[{ip:'192.0.2.1',reason:'Fixture incident',attempts:5,quarantinedAt:Date.now(),expiresAt:Date.now()+900000}],
 attacksBlockedToday:1,recentThreats:[{id:'fixture',event:'threat_ip_quarantined',severity:'high',ip:'192.0.2.1',created_at:new Date().toISOString(),metadata:{reason:'Fixture incident'}}],
 generatedAt:new Date().toISOString(),registrationsOpen:true,decisionLatencyMs:null,cacheTtlMs:3000,counterScope:'automatic_quarantines_utc'
};
try {
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 let mutation=null,reads=0;
 await page.route('**/api/guardian/soc/**',async route=>{
  if(route.request().method()==='GET'){reads++;return route.fulfill({json:report});}
  mutation=route.request().postDataJSON();
  if(route.request().url().endsWith('/defcon')){report.defconLevel=mutation.level;report.registrationsOpen=mutation.level>3;}
  if(mutation.action==='unblock'){report.quarantinedCount=0;report.quarantinedIps=[];}
  return route.fulfill({json:{success:true}});
 });
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});
  await page.goto(base+'/soc-qa',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'DEFCON 5 · NORMAL',exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no page horizontal overflow');
 }
 await page.getByRole('button',{name:'DEFCON 2',exact:true}).click();
 const modal=page.getByRole('dialog');
 await modal.waitFor();
 assert.equal(await modal.evaluate(el=>el.contains(document.activeElement)),true,'dialog focus contained');
 await modal.getByLabel('Motivo obligatorio').fill('Fixture critical response');
 assert.equal(await modal.getByRole('button',{name:'Confirmar postura'}).isDisabled(),true);
 await modal.getByRole('checkbox').check();
 await modal.getByRole('button',{name:'Confirmar postura'}).click();
 await modal.waitFor({state:'hidden'});
 assert.equal(mutation.level,2);assert.equal(mutation.confirmCritical,true);
 await page.getByRole('heading',{name:'DEFCON 2 · CRITICAL',exact:true}).waitFor();
 await page.getByRole('button',{name:'DEFCON 5',exact:true}).click();
 await page.keyboard.press('Escape');
 await modal.waitFor({state:'hidden'});
 assert.equal(report.defconLevel,2,'Escape never submits');
 await page.getByRole('button',{name:'Levantar Cuarentena'}).click();
 await page.getByText('Sin IPs aisladas en la última lectura.').waitFor();
 assert.equal(mutation.action,'unblock');
 assert.equal(errors.length,0,JSON.stringify(errors));
 assert.ok(reads>=2);
 const denied=await page.request.get(base+'/api/guardian/soc/telemetry');
 assert.equal(denied.status(),403);
 const origin=base;
 const cross=await page.request.post(base+'/api/guardian/soc/defcon',{headers:{origin:'https://evil.test'},data:{level:1,reason:'Unauthorized fixture',confirmCritical:true}});
 assert.equal(cross.status(),403);
 const invalid=await page.request.post(base+'/api/auth/password',{headers:{origin},data:{email:'invalid',password:''}});
 assert.equal(invalid.status(),400);
 console.log('SOC browser QA passed: mobile/desktop, overflow, dialog focus/Escape, critical confirmation, refresh/unblock, real anonymous API guards.');
}finally{await browser.close();}
