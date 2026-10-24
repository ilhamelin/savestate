import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import ts from 'typescript';
import type { Game } from '../../src/domain/model.ts';
import { igdbScreenshotUrls, gameScreenshotUrls } from '../../src/domain/game-screenshots.ts';
import { mapIgdbGame, igdbQuery, parseFilters } from '../../src/integrations/igdb/query.ts';

const base = 'https://images.igdb.com/igdb/image/upload/t_screenshot_big/';
test('IGDB screenshot mapping rejects malformed entries and never interpolates URL fragments', () => {
  const raw = [
    { image_id: 'sc_1' },
    { image_id: 'ABC123' },
    { image_id: 'sc_1' },
    null,
    42,
    {},
    { image_id: 23 },
    { image_id: '../evil' },
    { image_id: 'a/b' },
    { image_id: 'https://evil.test/x' },
    { image_id: 'x?foo' },
    { image_id: 'x#foo' },
    { image_id: 'x.jpg' },
    { image_id: 'x\n' },
    { image_id: '' },
  ];
  assert.deepEqual(igdbScreenshotUrls(raw), [base + 'sc_1.jpg', base + 'ABC123.jpg']);
  for (const value of [undefined, null, {}, 'invalid'])
    assert.deepEqual(igdbScreenshotUrls(value), []);
  const mapped = mapIgdbGame({ id: 1, name: 'Game', slug: 'game', screenshots: raw as never });
  assert.deepEqual(mapped.screenshots, [base + 'sc_1.jpg', base + 'ABC123.jpg']);
  assert.deepEqual(mapIgdbGame({ id: 1, name: 'Game', slug: 'game' }).screenshots, []);
  assert.match(igdbQuery(parseFilters(new URLSearchParams())), /screenshots\.image_id/);
});
test('client screenshot boundary rejects foreign hosts, traversal, query strings and credentials', () => {
  const valid = base + 'sc_1.jpg';
  assert.deepEqual(
    gameScreenshotUrls([
      valid,
      valid,
      null,
      valid + '?redirect=evil',
      valid + '#fragment',
      valid.replace('images.igdb.com', 'images.igdb.com.evil.test'),
      valid.replace('https:', 'http:'),
      base + '../evil.jpg',
      base + 'sc\n.jpg',
      'https://user:pass@images.igdb.com/igdb/image/upload/t_screenshot_big/sc_1.jpg',
    ]),
    [valid],
  );
  assert.deepEqual(gameScreenshotUrls(undefined), []);
});

type View = { type: unknown; props: Record<string, unknown> };
function nodes(value: unknown): View[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object' || !('props' in value)) return [];
  const node = value as View;
  return [node, ...nodes(node.props.children)];
}
const fixture =
  'data:text/javascript,' +
  encodeURIComponent(`
  let cursor=0; const slots=[];
  export const effects=[];
  export function begin(){cursor=0;}
  export function clear(){slots.length=0;cursor=0;effects.length=0;}
  export const Fragment='fragment';
  export const jsx=(type,props)=>({type,props});
  export const jsxs=jsx;
  export const useId=()=> 'gallery-test';
  export function useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i], value=>{slots[i]=typeof value==='function'?value(slots[i]):value}];}
  export function useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];}
  export const useEffect=callback=>effects.push(callback);
  export const Gamepad2='svg';export const ArrowUpRight='svg';
  export default 'mock-link-or-image';
`);
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (
      ['react', 'react/jsx-runtime', 'next/image', 'next/link', 'lucide-react'].includes(specifier)
    )
      return { url: fixture, shortCircuit: true };
    if (specifier.endsWith('.css'))
      return { url: 'data:text/javascript,export {};', shortCircuit: true };
    if (specifier.startsWith('@/')) {
      const file = resolve('src', specifier.slice(2));
      return {
        url: pathToFileURL(existsSync(file + '.tsx') ? file + '.tsx' : file + '.ts').href,
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
after(() => hooks.deregister());
const game: Game = {
  id: 'game-1',
  igdb_id: 1,
  title: 'Test Game',
  slug: 'test-game',
  cover_url: null,
  release_year: 2026,
  platforms: ['PC'],
  genres: [],
  developer: null,
  publisher: null,
  series: null,
  synopsis: null,
  cached_at: '2026-10-24',
  screenshots: [base + 'sc_1.jpg', base + 'sc_2.jpg'],
};
function replaceGlobal(name: string, value: unknown) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, value });
  return () =>
    previous
      ? Object.defineProperty(globalThis, name, previous)
      : Reflect.deleteProperty(globalThis, name);
}
test('card has a separate accessible gallery trigger, lazy hover and touch-safe cover fallback', async () => {
  const runtime = await import(fixture);
  const { GameCard } = await import('../../src/components/game-card.tsx');
  let fine = true;
  const restore = replaceGlobal('window', { matchMedia: () => ({ matches: fine }) });
  try {
    runtime.clear();
    let opened: Game | null = null;
    const props = {
      game,
      onOpenGallery: (value: Game) => {
        opened = value;
      },
    };
    const render = () => {
      runtime.begin();
      return GameCard(props);
    };
    let view = render();
    const trigger = nodes(view).find((n) => n.props['aria-haspopup'] === 'dialog')!;
    assert.equal(trigger.props['aria-label'], 'Ver 2 capturas de Test Game');
    const link = nodes(view).find((n) => n.props.href === '/games/test-game')!;
    assert.ok(
      !nodes(link).some((n) => n.type === 'button'),
      'No nested buttons inside poster link',
    );
    assert.ok(
      !nodes(view).some((n) => n.props.src === game.screenshots![0]),
      'No screenshot download before hover',
    );
    let prevented = 0;
    (trigger.props.onClick as (e: unknown) => void)({
      preventDefault: () => prevented++,
      stopPropagation: () => prevented++,
    });
    assert.equal(prevented, 2);
    assert.deepEqual(opened, game);
    (view.props.onMouseEnter as () => void)();
    view = render();
    const image = nodes(view).find((n) => n.props.src === game.screenshots![0])!;
    (image.props.onLoad as () => void)();
    view = render();
    assert.match(String(view.props.className), /is-peeking/);
    (view.props.onMouseLeave as () => void)();
    fine = false;
    (view.props.onMouseEnter as () => void)();
    assert.doesNotMatch(String(render().props.className), /is-peeking/);
    runtime.clear();
    runtime.begin();
    const empty = GameCard({
      game: { ...game, screenshots: [] },
      onOpenGallery: props.onOpenGallery,
    });
    assert.ok(!nodes(empty).some((n) => n.props['aria-haspopup'] === 'dialog'));
  } finally {
    restore();
  }
});
test('modal wraps arrow navigation, selects thumbnails, closes once on Escape and restores focus/scroll', async () => {
  const runtime = await import(fixture);
  const { GameScreenshotsModal } = await import('../../src/components/game-screenshots-modal.tsx');
  runtime.clear();
  let closed = 0,
    focused = 0,
    modalOpened = 0,
    modalClosed = 0;
  class FocusTarget {
    isConnected = true;
    focus() {
      focused++;
    }
  }
  const body = { style: { overflow: 'auto' } };
  const doc = { activeElement: new FocusTarget(), body };
  const restore = [replaceGlobal('document', doc), replaceGlobal('HTMLElement', FocusTarget)];
  try {
    const render = (value: Game | null = game) => {
      runtime.begin();
      return GameScreenshotsModal({ game: value, onClose: () => closed++ });
    };
    let view = render()!;
    const dialog = {
      showModal() {
        modalOpened++;
      },
      close() {
        modalClosed++;
      },
    };
    (view.props.ref as { current: unknown }).current = dialog;
    const close = nodes(view).find((n) => n.props['aria-label'] === 'Cerrar galería')!;
    (close.props.ref as { current: unknown }).current = { focus() {} };
    const cleanup = runtime.effects.at(-1)() as () => void;
    assert.equal(modalOpened, 1);
    assert.equal(body.style.overflow, 'hidden');
    const key = (key: string) =>
      (view.props.onKeyDown as (e: unknown) => void)({ key, preventDefault() {} });
    key('ArrowLeft');
    view = render()!;
    assert.equal(
      nodes(view)
        .find((n) => n.props.role === 'status')
        ?.props.children?.toString(),
      '2, / ,2',
    );
    key('ArrowRight');
    view = render()!;
    assert.ok(nodes(view).some((n) => n.props.alt === 'Captura 1 de Test Game'));
    (
      nodes(view).find((n) => n.props['aria-label'] === 'Ver captura 2')!.props
        .onClick as () => void
    )();
    view = render()!;
    assert.ok(nodes(view).some((n) => n.props.alt === 'Captura 2 de Test Game'));
    key('Escape');
    assert.equal(closed, 1);
    cleanup();
    assert.equal(body.style.overflow, 'auto');
    assert.equal(focused, 1);
    assert.equal(modalClosed, 1);
    const first = new FocusTarget(),
      last = new FocusTarget();
    let prevented = 0;
    const tab = (shiftKey: boolean) =>
      (view!.props.onKeyDown as (e: unknown) => void)({
        key: 'Tab',
        shiftKey,
        currentTarget: { querySelectorAll: () => [first, last] },
        preventDefault() {
          prevented++;
        },
      });
    doc.activeElement = last;
    tab(false);
    doc.activeElement = first;
    tab(true);
    assert.equal(prevented, 2, 'Both boundaries explicitly wrap focus');
    assert.equal(focused, 3);
    view = render({ ...game, id: 'different', screenshots: [base + 'only.jpg'] })!;
    assert.ok(nodes(view).filter((n) => n.type === 'button' && n.props.disabled).length === 2);
    assert.equal(render(null), null);
  } finally {
    restore.reverse().forEach((fn) => fn());
  }
});
