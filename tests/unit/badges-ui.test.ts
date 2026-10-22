import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import ts from 'typescript';
import type { Badge, UserBadge } from '../../src/domain/badges.ts';
import type { Game, UserGame } from '../../src/domain/model.ts';

type View = { type: unknown; props: Record<string, unknown> };
function nodes(value: unknown): View[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object' || !('type' in value) || !('props' in value)) return [];
  const node = value as View;
  return [node, ...nodes(node.props.children)];
}
function text(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).join('');
  if (value && typeof value === 'object' && 'props' in value) return text((value as View).props.children);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}
test('SPEC-02: owner onboarding, neutral visitor state, badge progress and toast lifecycle', async () => {
  const fixture = 'data:text/javascript,' + encodeURIComponent(`
    export const effects=[];
    export const jsx=(type,props)=>({type,props});
    export const jsxs=jsx;
    export const Fragment='fragment';
    export const useState=(initial)=>[typeof initial==='function'?initial():initial,()=>{}];
    export const useEffect=(callback)=>{effects.push(callback)};
    export const useLibraryViewPreference=()=>['grid',()=>{}];
    export const createPortal=(node)=>node;
    export const LockKeyhole='lock-icon',Gamepad2='gamepad-icon',Zap='zap-icon';
    export const GameCard=()=>null,QuickHoursEditor=()=>null,ConsoleProgressBadge=()=>null;
    export const SteamAchievementsSync=()=>null,LibraryRecordActions=()=>null,LibraryTable=()=>null;
    export default 'a';
  `);
  const stubs = ['react', 'react/jsx-runtime', 'react-dom', 'next/link', 'lucide-react',
    '@/components/library-view-preference', '@/components/game-card', '@/components/quick-hours-editor',
    '@/components/console-progress-badge', '@/components/steam-achievements-sync',
    '@/components/library-record-actions', '@/components/library-table'];
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (stubs.includes(specifier)) return {url:fixture,shortCircuit:true};
      if (specifier.startsWith('@/')) {
        const file = resolve('src', specifier.slice(2));
        return {url:pathToFileURL(existsSync(file+'.tsx')?file+'.tsx':file+'.ts').href,shortCircuit:true};
      }
      return next(specifier,context);
    },
    load(url, context, next) {
      if (url.startsWith('file:') && /\.tsx?$/.test(url))
        return {format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{
          compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
        }).outputText,shortCircuit:true};
      return next(url,context);
    },
  });
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  try {
    const { Library } = await import('../../src/components/library.tsx');
    const { LibraryEmptyHero } = await import('../../src/components/library-empty-hero.tsx');
    assert.equal(Library({entries:[],games:[],logs:[],editable:true}).type, LibraryEmptyHero);
    const visitor = Library({entries:[],games:[],logs:[],editable:false});
    assert.match(text(visitor), /Esta biblioteca aún no tiene juegos registrados/);
    assert.equal(nodes(visitor).some(node => node.type === LibraryEmptyHero), false);
    const populated = Library({
      entries:[{id:'entry',game_id:'game',status:'playing',rating:null,updated_at:'2026-10-22'}] as UserGame[],
      games:[{id:'game',title:'Celeste',genres:[],platforms:['PC']}] as Game[],logs:[],editable:true,
    });
    assert.equal(nodes(populated).some(node => node.type === LibraryEmptyHero), false);
    const hero = LibraryEmptyHero();
    assert.ok(nodes(hero).some(node => node.props.href === '/library/import'));
    assert.ok(nodes(hero).some(node => node.props.href === '/explore'));
    const { BadgeGallery } = await import('../../src/components/badge-gallery.tsx');
    const catalogue = [{id:'one',name:'Uno',description:'Primer juego',icon_pixel:'save'},
      {id:'two',name:'Dos',description:'Segundo juego',icon_pixel:'arcade'}] as Badge[];
    const gallery = BadgeGallery({catalogue,earned:[{badge_id:'one',unlocked_at:'2026-10-22'},
      {badge_id:'one',unlocked_at:'2026-10-22'},{badge_id:'unknown',unlocked_at:'2026-10-22'}] as UserBadge[]});
    assert.match(text(gallery), /Coleccionista Novato/);
    assert.match(text(gallery), /1 de 2 desbloqueadas — 50%/);
    assert.equal(nodes(gallery).find(node => node.type === 'progress')?.props.value, 50);
    assert.equal(nodes(BadgeGallery({catalogue:[],earned:[]})).find(node => node.type === 'progress')?.props.value, 0);
    const { BadgeUnlockToast, BADGE_TOAST_DURATION_MS } = await import('../../src/components/badge-unlock-toast.tsx');
    const { effects } = await import(fixture);
    const timers: { callback: () => void; delay: number }[] = [];
    let cleared = false, dismissed = 0;
    Object.defineProperty(globalThis, 'document', {configurable:true,value:{body:{}}});
    Object.defineProperty(globalThis, 'window', {configurable:true,value:{
      setTimeout(callback: () => void, delay: number) {timers.push({callback,delay});return 1},
      clearTimeout() {cleared=true},
    }});
    const toast = BadgeUnlockToast({event:{badgeId:'one',badgeName:'Primer Guardado',
      badgeDescription:'Tu primer juego',iconPixel:'save',unlockedAt:'2026-10-22T12:00:00Z'},
      onClose:()=>{dismissed++}});
    const cleanup = effects.pop()();
    assert.equal(BADGE_TOAST_DURATION_MS, 6000);
    assert.equal(timers[0]?.delay, 6000);
    assert.match(text(toast), /¡LOGRO DESBLOQUEADO!Primer Guardado/);
    assert.equal(nodes(toast).find(node => node.type === 'aside')?.props.role, 'status');
    const close = nodes(toast).find(node => node.type === 'button');
    assert.ok(close);
    (close.props.onClick as () => void)();
    assert.equal(dismissed, 1);
    timers[0]!.callback();
    assert.equal(dismissed, 2);
    cleanup();
    assert.equal(cleared, true);
    const css = readFileSync('src/app/badges.css','utf8');
    assert.match(css,/prefers-reduced-motion: reduce/);
  } finally {
    hooks.deregister();
    if (oldDocument) Object.defineProperty(globalThis,'document',oldDocument); else Reflect.deleteProperty(globalThis,'document');
    if (oldWindow) Object.defineProperty(globalThis,'window',oldWindow); else Reflect.deleteProperty(globalThis,'window');
  }
});
