import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import ts from 'typescript';

test('Operator listener uses a private channel, isolates recipients, signs out on kick and cleans up', async () => {
  const fixture = `data:text/javascript,${encodeURIComponent(`
    export const state={effects:[],notices:[],routes:[],handlers:{},removed:0,signouts:0,channel:null};
    export const useState=initial=>[initial,value=>state.notices.push(value)];
    export const useEffect=fn=>{state.effects.push(fn);};
    export const jsx=(type,props)=>({type,props});
    export const jsxs=jsx;
    export const useRouter=()=>({replace:path=>state.routes.push(path),refresh:()=>state.routes.push('refresh')});
    const channel={on(type,filter,fn){state.handlers[filter.event]=fn;return channel;},subscribe(){return channel;}};
    export const browserClient=()=>({
      realtime:{setAuth:async()=>{}},
      channel(name,options){state.channel={name,options};return channel;},
      auth:{signOut:async()=>{state.signouts++;return {error:null};}},
      removeChannel:async()=>{state.removed++;}
    });
  `)}`;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (
        [
          'react',
          'react/jsx-runtime',
          'next/navigation',
          '@/integrations/supabase/browser',
        ].includes(specifier)
      )
        return { url: fixture, shortCircuit: true };
      if (specifier.startsWith('@/'))
        return {
          url: pathToFileURL(resolve('src', specifier.slice(2) + '.ts')).href,
          shortCircuit: true,
        };
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url.startsWith('file:') && /\.tsx?$/.test(url))
        return {
          format: 'module',
          source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
            compilerOptions: {
              module: ts.ModuleKind.ESNext,
              target: ts.ScriptTarget.ES2022,
              jsx: ts.JsxEmit.ReactJSX,
            },
          }).outputText,
          shortCircuit: true,
        };
      return next(url, context);
    },
  });
  try {
    const { state } = await import(fixture);
    const { OperatorSignalsListener } =
      await import('../../src/components/operator-signals-listener.tsx');
    const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    OperatorSignalsListener({ userId });
    const cleanup = state.effects[0]();
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(state.channel, {
      name: `savestate:operator:${userId}`,
      options: { config: { private: true } },
    });
    const payload = {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      user_id: userId,
      sender: 'operator',
      message: 'Hola',
      sent_at: new Date().toISOString(),
    };
    await state.handlers.operator_whisper({
      payload: { ...payload, user_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc' },
    });
    assert.equal(state.notices.length, 0);
    await state.handlers.operator_whisper({ payload });
    assert.equal(state.notices[0].message, 'Hola');
    assert.equal(state.signouts, 0);
    await state.handlers.operator_whisper({ payload });
    assert.equal(state.notices.length, 1);
    const kick = { ...payload, id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', message: undefined };
    await state.handlers.operator_kick({ payload: kick });
    await state.handlers.operator_kick({ payload: kick });
    assert.equal(state.signouts, 1);
    assert.deepEqual(state.routes, ['/', 'refresh']);
    assert.equal(state.notices[1].kicked, true);
    cleanup();
    assert.equal(state.removed, 1);
    await state.handlers.operator_whisper({
      payload: { ...payload, id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' },
    });
    assert.equal(state.notices.length, 2);
  } finally {
    hooks.deregister();
  }
});
