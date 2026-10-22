import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import ts from 'typescript';

test(
  'Root layout streams the optional broadcast without waiting for its query',
  { timeout: 2000 },
  async () => {
    const fixture =
      'data:text/javascript,' +
      encodeURIComponent(`
    export const state={calls:0,path:'/',fail:false,release:null};
    export const Suspense='suspense-boundary';
    export const Fragment='fragment';
    export const jsx=(type,props)=>({type,props});
    export const jsxs=jsx;
    export const headers=async()=>({get:()=>state.path});
    export const Silkscreen=()=>({variable:'pixel'});
    export const JetBrains_Mono=()=>({variable:'mono'});
    export const currentUser=async()=>null;
    export const getSystemSwitches=async()=>({seasonal_theme:'classic',double_xp:true});
    export const getActiveSystemBroadcast=()=>{
      state.calls++;
      if(state.fail)return Promise.reject(new Error('DB offline'));
      return new Promise(resolve=>{state.release=resolve;});
    };
    export const Header=()=>null;
    export const HalloweenBats=()=>null;
    export const OperatorSignalsListener=()=>null;
    export const OfflineLibrarySessionSync=()=>null;
    export const SystemBroadcastBanner=()=>null;
    export default ()=>null;
  `);
    const hooks = registerHooks({
      resolve(specifier, context, next) {
        if (
          [
            'react',
            'react/jsx-runtime',
            'next/headers',
            'next/font/google',
            'next/image',
            'next/link',
            '@/components/header',
            '@/components/halloween/halloween-bats',
            '@/components/operator-signals-listener',
            '@/components/offline-library-session-sync',
            '@/components/system-broadcast-banner',
            '@/services/system-state',
            '@/lib/session',
          ].includes(specifier)
        )
          return { url: fixture, shortCircuit: true };
        if (specifier.endsWith('.css'))
          return { url: 'data:text/javascript,export {};', shortCircuit: true };
        if (specifier.startsWith('@/')) {
          const path = resolve('src', specifier.slice(2));
          return {
            url: pathToFileURL(existsSync(path + '.tsx') ? path + '.tsx' : path + '.ts').href,
            shortCircuit: true,
          };
        }
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
    function find(node: unknown, type: unknown): { props: Record<string, unknown> } | undefined {
      if (Array.isArray(node)) {
        for (const child of node) {
          const result = find(child, type);
          if (result) return result;
        }
      } else if (node && typeof node === 'object' && 'type' in node && 'props' in node) {
        const element = node as { type: unknown; props: Record<string, unknown> };
        if (element.type === type) return element;
        return find(element.props.children, type);
      }
    }
    try {
      const { state } = await import(fixture);
      const { default: RootLayout } = await import('../../src/app/layout.tsx');
      const { SystemBroadcastStream } =
        await import('../../src/components/system-broadcast-stream.tsx');
      const tree = await RootLayout({ children: 'MAIN CONTENT' });
      assert.equal(state.calls, 0);
      const boundary = find(tree, 'suspense-boundary');
      assert.ok(boundary);
      assert.equal(boundary.props.fallback, null);
      const stream = find(boundary.props.children, SystemBroadcastStream);
      assert.equal(stream?.props.initialDoubleXp, true);
      let finished = false;
      const pending = SystemBroadcastStream({ initialDoubleXp: true }).then((value) => {
        finished = true;
        return value;
      });
      await Promise.resolve();
      assert.equal(finished, false);
      assert.equal(state.calls, 1);
      const broadcast = {
        id: 'notice',
        message: 'Hello',
        category: 'info',
        created_at: '2026-10-22',
      };
      state.release(broadcast);
      const banner = await pending;
      assert.deepEqual(banner.props.initial, broadcast);
      assert.equal(banner.props.initialDoubleXp, true);
      state.fail = true;
      assert.equal((await SystemBroadcastStream({})).props.initial, null);
      state.path = '/guardian';
      const standalone = await RootLayout({ children: 'OPERATOR' });
      assert.equal(find(standalone, SystemBroadcastStream), undefined);
      assert.equal(state.calls, 2);
    } finally {
      hooks.deregister();
    }
  },
);
