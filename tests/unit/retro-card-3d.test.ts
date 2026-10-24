import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import ts from 'typescript';
import jsQR from 'jsqr';
import { CARD_SHELLS, cardTiltForPoint } from '../../src/domain/memory-card.ts';
import type { InteractiveCardProps } from '../../src/domain/memory-card.ts';

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
  let cursor=0;
  const slots=[];
  export const effects=[];
  export function begin(){cursor=0;}
  export function clear(){slots.length=0;cursor=0;effects.length=0;}
  export const jsx=(type,props)=>({type,props});
  export const jsxs=jsx;
  export const useId=()=> 'card-test';
  export function useState(initial){
    const i=cursor++;if(!(i in slots))slots[i]=initial;
    return [slots[i], value=>{slots[i]=typeof value==='function'?value(slots[i]):value}];
  }
  export function useRef(initial){
    const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];
  }
  export const useEffect=callback=>effects.push(callback);
  export const useSyncExternalStore=(subscribe,snapshot)=>snapshot();
  export default 'img';
`);
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (['react', 'react/jsx-runtime', 'next/image', 'server-only'].includes(specifier))
      return { url: fixture, shortCircuit: true };
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
function replaceGlobal(name: string, value: unknown) {
  const old = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, value });
  return () =>
    old ? Object.defineProperty(globalThis, name, old) : Reflect.deleteProperty(globalThis, name);
}

test('tilt is centered, clamped to twelve degrees and preserves the flip state', () => {
  const rect = { left: 10, top: 20, width: 100, height: 200 };
  assert.deepEqual(cardTiltForPoint(60, 120, rect), {
    rotateX: 0,
    rotateY: 0,
    glareX: 50,
    glareY: 50,
    isFlipped: false,
  });
  assert.deepEqual(cardTiltForPoint(-500, 900, rect, true), {
    rotateX: -12,
    rotateY: -12,
    glareX: 0,
    glareY: 100,
    isFlipped: true,
  });
  assert.equal(cardTiltForPoint(110, 20, rect).rotateX, 12);
  assert.equal(cardTiltForPoint(110, 20, rect).rotateY, 12);
});
test('reduced motion and invalid geometry always return a neutral tilt', () => {
  const rect = { left: 0, top: 0, width: 100, height: 100 };
  for (const result of [
    cardTiltForPoint(0, 0, rect, false, true),
    cardTiltForPoint(NaN, 0, rect),
    cardTiltForPoint(0, 0, { ...rect, width: 0 }),
    cardTiltForPoint(0, 0, { ...rect, height: Infinity }),
  ])
    assert.deepEqual(result, { rotateX: 0, rotateY: 0, glareX: 50, glareY: 50, isFlipped: false });
});
test('three chassis have distinct palettes and stable public identifiers', () => {
  assert.deepEqual(Object.keys(CARD_SHELLS), [
    'ps1_memory_card',
    'gameboy_cartridge',
    'atomic_purple',
  ]);
  assert.equal(new Set(Object.values(CARD_SHELLS).map((skin) => skin.plastic)).size, 3);
});

test('QR independently decodes to the canonical profile URL, with a four-module quiet zone', async () => {
  const { createMemoryCardQr } = await import('../../src/lib/memory-card-qr.ts');
  for (const username of ['ilhamelin_v2', 'player_with_a_long_username_123']) {
    const code = createMemoryCardQr(username, 'https://savestate-eight.vercel.app');
    const scale = 8,
      width = code.size * scale;
    const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
    for (const run of code.path.matchAll(/M(\d+),(\d+)\.5h(\d+)/g)) {
      const x = Number(run[1]),
        y = Number(run[2]),
        length = Number(run[3]);
      assert.ok(x >= 4 && y >= 4 && x + length <= code.size - 4 && y < code.size - 4);
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < length * scale; dx++) {
          const offset = ((y * scale + dy) * width + x * scale + dx) * 4;
          pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 0;
        }
    }
    assert.equal(jsQR(pixels, width, width)?.data, code.url);
    assert.equal(code.url, 'https://savestate-eight.vercel.app/players/' + username);
  }
  assert.throws(() => createMemoryCardQr('player', 'javascript:alert(1)'));
});

test('accessible flip, chassis selection, touch tilt, animation cleanup and live reduced motion', async () => {
  const runtime = await import(fixture);
  runtime.clear();
  let reduced = false;
  let nextFrame = 0;
  const queued = new Map<number, FrameRequestCallback>();
  const restore = [
    replaceGlobal('window', { matchMedia: () => ({ matches: reduced }) }),
    replaceGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      queued.set(++nextFrame, callback);
      return nextFrame;
    }),
    replaceGlobal('cancelAnimationFrame', (id: number) => {
      queued.delete(id);
    }),
  ];
  try {
    const { RetroCard3D } = await import('../../src/components/retro-card-3d.tsx');
    const props: InteractiveCardProps = {
      username: 'player',
      avatarUrl: null,
      clearRate: 50,
      hours: 123,
      topGames: [],
      qrCode: { url: 'https://example.com/players/player', size: 29, path: 'M4,4.5h7' },
      children: (skin) => skin,
    };
    // These tests drive real component handlers with a small deterministic hook/JSX fixture.
    const render = () => {
      runtime.begin();
      return RetroCard3D(props);
    };
    const find = (view: unknown, className: string) =>
      nodes(view).find((n) => n.props.className === className)!;
    let view = render();
    assert.equal(find(view, 'retro-card-front').props['aria-hidden'], false);
    assert.equal(find(view, 'retro-card-back').props.inert, true);
    const flip = nodes(view).find((n) => n.type === 'button')!;
    assert.equal(flip.props.type, 'button');
    assert.equal(flip.props['aria-controls'], 'card-test-object');
    assert.equal(flip.props['aria-pressed'], false);
    (flip.props.onClick as () => void)();
    view = render();
    assert.equal(nodes(view).find((n) => n.type === 'button')?.props['aria-pressed'], true);
    assert.equal(find(view, 'retro-card-front').props.inert, true);
    assert.equal(find(view, 'retro-card-back').props['aria-hidden'], false);
    assert.ok(nodes(view).some((n) => n.type === 'a' && n.props.href === props.qrCode?.url));
    assert.ok(nodes(view).some((n) => n.type === 'svg' && n.props.role === 'img'));
    const select = nodes(view).find((n) => n.type === 'select')!;
    assert.equal(nodes(select).filter((n) => n.type === 'option').length, 3);
    (select.props.onChange as (e: unknown) => void)({ target: { value: 'atomic_purple' } });
    view = render();
    assert.equal((view as View).props['data-skin'], 'atomic_purple');

    const styles = new Map<string, string>();
    const scene = find(view, 'retro-card-scene');
    (scene.props.ref as { current: unknown }).current = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    };
    (find(view, 'retro-card-tilt').props.ref as { current: unknown }).current = {
      style: { setProperty: (key: string, value: string) => styles.set(key, value) },
    };
    const move = scene.props.onPointerMove as (e: unknown) => void;
    move({ clientX: 100, clientY: 0, pointerType: 'mouse' });
    (scene.props.onPointerDown as (e: unknown) => void)({
      clientX: 75,
      clientY: 25,
      pointerType: 'touch',
    });
    assert.equal(queued.size, 1);
    const flush = () => {
      const callbacks = [...queued.values()];
      queued.clear();
      callbacks.forEach((cb) => cb(0));
    };
    flush();
    assert.equal(styles.get('--card-rx'), '6deg');
    assert.equal(styles.get('--card-ry'), '6deg');
    assert.equal(styles.get('--card-glare'), '1');
    move({ clientX: 0, clientY: 0 });
    reduced = true;
    flush();
    assert.equal(styles.get('--card-rx'), '0deg');
    assert.equal(styles.get('--card-ry'), '0deg');
    assert.equal(styles.get('--card-glare'), '0');
    view = render();
    (find(view, 'retro-card-scene').props.onPointerMove as (e: unknown) => void)({
      clientX: 0,
      clientY: 0,
    });
    assert.equal(queued.size, 0);
    reduced = false;
    view = render();
    (find(view, 'retro-card-scene').props.onPointerMove as (e: unknown) => void)({
      clientX: 0,
      clientY: 0,
    });
    const cleanup = runtime.effects.at(-1)() as () => void;
    cleanup();
    assert.equal(queued.size, 0);
    runtime.clear();
    runtime.begin();
    assert.equal(
      (RetroCard3D({ ...props, defaultSkin: 'gameboy_cartridge' }) as View).props['data-skin'],
      'gameboy_cartridge',
    );
  } finally {
    restore.reverse().forEach((fn) => fn());
  }
});

test('CSS disables dynamic motion and uses separate tilt/flip planes without blocking mobile scroll', () => {
  const css = readFileSync('src/styles/retro-card-3d.css', 'utf8');
  assert.match(css, /perspective: 1200px/);
  assert.match(css, /transform-style: preserve-3d/);
  assert.match(css, /backface-visibility: hidden/);
  assert.match(css, /touch-action: pan-y/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /transform: none !important/);
  assert.match(css, /visibility: hidden/);
  assert.match(css, /transition: none/);
  assert.match(
    css,
    /\.retro-card-front,\s*\.retro-card-back\s*\{[\s\S]*var\(--card-plastic\)[\s\S]*border:\s*3px solid #626674/,
  );
  assert.match(
    css,
    /\.retro-card\[data-skin='gameboy_cartridge'\]\s+\.retro-card-back[\s\S]*border-radius:\s*28px 16px 6px 6px/,
  );
  const page = readFileSync('src/app/players/[username]/page.tsx', 'utf8');
  assert.match(page, /qrCode: createMemoryCardQr\(profile.username, appUrl\(\)\)/);
});

test('PNG remains 1080×1350 and exports every selected chassis, hardware and four favorite slots', async () => {
  const { renderMemoryCard } = await import('../../src/lib/memory-card-export.ts');
  const labels: string[] = [];
  const paints: string[] = [];
  const context = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    fillRect() {
      paints.push(this.fillStyle);
    },
    strokeRect() {},
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {},
    drawImage() {},
    measureText: (value: string) => ({ width: value.length * 8 }),
    fillText: (value: string) => labels.push(value),
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    toBlob: (callback: (blob: Blob) => void, format: string) =>
      callback(new Blob(['png-fixture'], { type: format })),
  };
  const restore = [
    replaceGlobal('document', {
      createElement: () => canvas,
      fonts: { ready: Promise.resolve() },
      documentElement: {},
    }),
    replaceGlobal('getComputedStyle', () => ({ getPropertyValue: () => '' })),
    replaceGlobal('location', { origin: 'https://savestate-eight.vercel.app' }),
    replaceGlobal(
      'Image',
      class {
        crossOrigin = '';
        naturalWidth = 72;
        naturalHeight = 96;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(value: string) {
          if (value)
            queueMicrotask(() => {
              assert.equal(this.crossOrigin, 'anonymous');
              this.onerror?.();
            });
        }
      },
    ),
  ];
  try {
    for (const skin of Object.keys(CARD_SHELLS) as (keyof typeof CARD_SHELLS)[]) {
      labels.length = paints.length = 0;
      const result = await renderMemoryCard(
        {
          profile: {
            username: 'player',
            avatar_url: 'https://example.com/missing.png',
            terminal_status: 'Ready',
            owned_platforms: ['PS1', 'PC'],
          },
          clearRate: 50,
          hours: 24,
          favorites: [
            { id: 'one', title: 'Celeste', cover_url: 'https://example.com/missing.png' },
          ],
        },
        skin,
      );
      assert.equal(canvas.width, 1080);
      assert.equal(canvas.height, 1350);
      assert.equal(result.blob.type, 'image/png');
      assert.equal(result.missingImages, true);
      assert.ok(paints.includes(CARD_SHELLS[skin].plastic));
      assert.ok(labels.includes(CARD_SHELLS[skin].label.toUpperCase() + ' // PLAYER SAVE'));
      assert.ok(labels.includes('PS1') && labels.includes('PC') && labels.includes('Celeste'));
      assert.equal(labels.filter((text) => /^SLOT 0[1-4]$/.test(text)).length, 4);
    }
  } finally {
    restore.reverse().forEach((fn) => fn());
  }
});
