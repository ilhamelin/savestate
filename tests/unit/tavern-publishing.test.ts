import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import ts from 'typescript';

type View={type:unknown;props:Record<string,unknown>};
function nodes(value:unknown):View[]{
 if(Array.isArray(value))return value.flatMap(nodes);
 if(!value||typeof value!=='object'||!('props' in value))return [];
 const view=value as View;return [view,...nodes(view.props.children)];
}
const fixture='data:text/javascript,'+encodeURIComponent(`
 export const state={pushes:[],refreshes:0,calls:[]};
 export const jsx=(type,props)=>({type,props});export const jsxs=jsx;
 export const useState=(initial)=>[initial,()=>{}];export const useRef=(value)=>({current:value});export const useEffect=()=>{};
 export const useRouter=()=>({push:(href)=>state.pushes.push(href),refresh:()=>state.refreshes++});
 export async function api(path,input){state.calls.push({path,input});return{id:'thread-id',category_id:'retro-corner'};}
 export const browserClient=()=>({storage:{from(){throw new Error('Unexpected upload');}}});
 export const CataloguePicker='catalogue-picker';export const ForumEditor='forum-editor';
 export const highlightImage=async()=>{throw new Error('Unexpected upload');};
 export const readJsonResponse=async()=>({games:[]});
`);
const hooks=registerHooks({
 resolve(specifier,context,next){
  if(['react','react/jsx-runtime','next/navigation','@/lib/client-api','@/integrations/supabase/browser','@/components/catalogue-picker','./forum-editor','@/lib/highlight-image','@/lib/api-response'].includes(specifier))return {url:fixture,shortCircuit:true};
  if(specifier.startsWith('@/')){const path=resolve('src',specifier.slice(2));return {url:pathToFileURL(existsSync(path+'.ts')?path+'.ts':path+'.tsx').href,shortCircuit:true};}
  return next(specifier,context);
 },
 load(url,context,next){if(url.startsWith('file:')&&/\.tsx?$/.test(url)&&!url.includes('node_modules'))return {format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};return next(url,context);}
});
after(()=>hooks.deregister());
const {state}=await import(fixture);
test('Forum creation returns to the canonical Debates view while channel editors retain thread navigation',async()=>{
 const {ForumCreate}=await import('../../src/components/forum-create.tsx');
 for(const returnHref of ['/tavern?sort=recent',undefined]){
  state.pushes=[];state.refreshes=0;
  // initialGame opens the real editor; this test exercises the submit handler with external persistence mocked.
  const view=ForumCreate({categories:[],initialGame:{id:'game-id',title:'Game'} as NonNullable<Parameters<typeof ForumCreate>[0]['initialGame']>,returnHref});
  const form=nodes(view).find(n=>n.type==='form')!;
  await (form.props.onSubmit as (event:unknown)=>Promise<void>)({preventDefault(){}});
  assert.deepEqual(state.pushes,[returnHref??'/forum/retro-corner/thread-id']);
  assert.equal(state.refreshes,1);assert.equal(state.calls.at(-1).path,'forum');
 }
});
test('Publishing a moment refreshes the current tab and filters without redirecting to a legacy route',async()=>{
 const {PostForm}=await import('../../src/components/highlights/post-form.tsx');
 state.pushes=[];state.refreshes=0;
 const old=globalThis.FormData;
 class Fields {get(key:string){return ({title:'Victoria épica',content:'Registro',category:'speedrun'} as Record<string,string>)[key]??null;}}
 Object.defineProperty(globalThis,'FormData',{configurable:true,value:Fields});
 try{
  const view=PostForm({userId:'viewer',initialDraft:'Registro'}),form=nodes(view).find(n=>n.type==='form')!;
  let resets=0;
  await (form.props.onSubmit as (event:unknown)=>Promise<void>)({preventDefault(){},currentTarget:{reset(){resets++;}}});
  assert.deepEqual(state.pushes,[]);assert.equal(state.refreshes,1);assert.equal(resets,1);
  assert.equal(state.calls.at(-1).path,'highlights');assert.equal(state.calls.at(-1).input.action,'create');
 }finally{Object.defineProperty(globalThis,'FormData',{configurable:true,value:old});}
});
