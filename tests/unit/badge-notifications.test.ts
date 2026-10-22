import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import ts from 'typescript';

type View = { type: unknown; props: Record<string, unknown> };
function findToast(value: unknown): View | undefined {
  if (Array.isArray(value)) {
    for (const child of value) { const found=findToast(child); if (found) return found; }
  } else if (value && typeof value==='object' && 'type' in value && 'props' in value) {
    const node=value as View;
    return node.type==='badge-toast' ? node : findToast(node.props.children);
  }
}
test('Badge notifications batch live unlocks, skip history, deduplicate and retain the next toast on double close', async t => {
  t.mock.timers.enable({apis:['setTimeout','setInterval']});
  const fixture='data:text/javascript,'+encodeURIComponent(`
    export const state={slots:[],cursor:0,effects:[],queries:0,removed:0,listener:null,filters:null,
      summary:{unreadCount:1,generatedAt:'2026-10-22T12:00:00Z',items:[
        {id:'old',kind:'badge_unlocked',badgeId:'old',read_at:null,created_at:'2027-01-01T00:00:00Z',username:'alice'}
      ]},
      badges:['one','two','three'].map(id=>({id,name:id,description:'Checkpoint',category:'milestone',icon_pixel:'save',created_at:'2026-10-22T12:00:00Z'}))};
    export const jsx=(type,props)=>({type,props}),jsxs=jsx;
    export const useState=initial=>{
      const i=state.cursor++;
      if(!(i in state.slots))state.slots[i]=typeof initial==='function'?initial():initial;
      return [state.slots[i],value=>{state.slots[i]=typeof value==='function'?value(state.slots[i]):value}];
    };
    export const useRef=initial=>{
      const i=state.cursor++;
      if(!(i in state.slots))state.slots[i]={current:initial};
      return state.slots[i];
    };
    export const useCallback=(fn,deps)=>{
      const i=state.cursor++,old=state.slots[i];
      if(!old||deps.some((v,j)=>v!==old.deps[j]))state.slots[i]={fn,deps};
      return state.slots[i].fn;
    };
    export const useId=()=>':notices:';
    export const useEffect=callback=>{state.effects.push(callback)};
    export const useOnlineUsers=()=>new Set();
    export const useRouter=()=>({refresh(){}});
    export const api=async()=>({});
    export const readJsonResponse=response=>response.json();
    export const Bell='bell-icon',BadgeUnlockToast='badge-toast';
    const channel={on(_type,filters,callback){state.filters=filters;state.listener=callback;return channel},subscribe(){return channel}};
    export const browserClient=()=>({
      channel(){return channel},removeChannel(){state.removed++},
      from(table){
        if(table!=='badges')throw new Error('Unexpected table');
        let ids=[];
        const q={select(){return q},in(_key,values){ids=values;return q},
          abortSignal(){state.queries++;return Promise.resolve({data:state.badges.filter(b=>ids.includes(b.id)),error:null})}};
        return q;
      }
    });
    export default 'a';
  `);
  const aliases=['react','react/jsx-runtime','next/link','lucide-react','next/navigation',
    '@/integrations/supabase/browser','@/lib/presence','@/lib/client-api','@/lib/api-response',
    '@/components/badge-unlock-toast'];
  const hooks=registerHooks({
    resolve(specifier,context,next) {
      if(aliases.includes(specifier))return {url:fixture,shortCircuit:true};
      if(specifier.startsWith('@/')){
        const file=resolve('src',specifier.slice(2));
        return {url:pathToFileURL(existsSync(file+'.tsx')?file+'.tsx':file+'.ts').href,shortCircuit:true};
      }
      return next(specifier,context);
    },
    load(url,context,next) {
      if(url.startsWith('file:')&&/\.tsx?$/.test(url))
        return {format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{
          compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
        }).outputText,shortCircuit:true};
      return next(url,context);
    },
  });
  const originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
  const originalFetch=globalThis.fetch;
  let cleanup: (()=>void)|undefined;
  try {
    const {state}=await import(fixture);
    const {NotificationBell}=await import('../../src/components/notification-bell.tsx');
    globalThis.fetch=async()=>Response.json({data:state.summary});
    Object.defineProperty(globalThis,'document',{configurable:true,value:{
      visibilityState:'visible',addEventListener(){},removeEventListener(){},
    }});
    const render=()=>{state.cursor=0;return NotificationBell({userId:'alice'})};
    const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));
    assert.equal(findToast(render()),undefined);
    cleanup=state.effects[0]();
    await settle();
    assert.equal(findToast(render()),undefined);
    assert.equal(state.queries,0);
    assert.equal(state.filters.filter,'user_id=eq.alice');
    const notice=(id:string,badgeId:string,user='alice')=>({
      eventType:'INSERT',new:{id,badge_id:badgeId,kind:'badge_unlocked',user_id:user,created_at:'2026-10-22T12:01:00Z'},
    });
    state.listener(notice('n1','one'));
    state.listener(notice('n2','two'));
    state.listener(notice('foreign','three','bob'));
    t.mock.timers.tick(250);
    await settle();
    const first=findToast(render());
    assert.ok(first);
    assert.equal((first.props.event as {badgeName:string}).badgeName,'one');
    assert.equal(state.queries,1);
    const close=first.props.onClose as ()=>void;
    close(); close(); // Manual dismissal and timeout racing must not dismiss the next notice.
    const second=findToast(render());
    assert.ok(second);
    assert.equal((second.props.event as {badgeName:string}).badgeName,'two');
    state.listener(notice('n1','one'));
    state.listener({...notice('n2','two'),eventType:'UPDATE'});
    t.mock.timers.tick(250);
    await settle();
    assert.equal(state.queries,1);
    state.summary={unreadCount:2,generatedAt:'2026-10-22T12:03:00Z',items:[...state.summary.items,
      {id:'n3',kind:'badge_unlocked',badgeId:'three',read_at:null,created_at:'2026-10-22T12:02:00Z',username:'alice'}]};
    t.mock.timers.tick(60000);
    t.mock.timers.tick(250);
    await settle();
    assert.equal(state.queries,2);
    (second.props.onClose as ()=>void)();
    const third=findToast(render());
    assert.ok(third);
    assert.equal((third.props.event as {badgeName:string}).badgeName,'three');
    (third.props.onClose as ()=>void)();
    assert.equal(findToast(render()),undefined);
    cleanup!(); cleanup=undefined;
    assert.equal(state.removed,1);
  } finally {
    cleanup?.();
    hooks.deregister();
    globalThis.fetch=originalFetch;
    if(originalDocument)Object.defineProperty(globalThis,'document',originalDocument);else Reflect.deleteProperty(globalThis,'document');
  }
});
