import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import {
  AUDIO_FILTER_CONFIGS,
  DEFAULT_RADIO_STATE,
  RADIO_STATIONS,
  RADIO_STORAGE_KEYS,
  cassetteMetadata,
  readRadioPreferences,
  serializeRadioPreferences,
  writeRadioPreferences,
  radioVolume,
  radioTime,
  radioAllowedAtPath,
} from '../../src/domain/retro-audio.ts';

const fixture =
  'data:text/javascript,' +
  encodeURIComponent(`
  export const effects=[],refs=[];
  export const jsx=(type,props)=>({type,props}),jsxs=jsx;
  export const useEffect=callback=>effects.push(callback);
  export const useRef=value=>{const ref={current:value};refs.push(ref);return ref;};
  export const useId=()=> 'cassette-test';
`);
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (['react', 'react/jsx-runtime'].includes(specifier))
      return { url: fixture, shortCircuit: true };
    if (
      specifier.startsWith('@/') ||
      (specifier.startsWith('.') &&
        context.parentURL?.startsWith('file:') &&
        !/\.\w+$/.test(specifier))
    ) {
      const file = specifier.startsWith('@/')
        ? resolve('src', specifier.slice(2))
        : resolve(dirname(fileURLToPath(context.parentURL!)), specifier);
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
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            jsx: ts.JsxEmit.ReactJSX,
          },
        }).outputText,
        shortCircuit: true,
      };
    return next(url, context);
  },
});
after(() => hooks.deregister());
const { RetroAudioEngine } = await import('../../src/lib/retro-audio/audio-engine.ts');
const { createProceduralSynth } = await import('../../src/lib/retro-audio/synth-chiptune.ts');
class Param {
  value = 0;
  ramps: number[] = [];
  setValueAtTime(value: number) {
    this.value = value;
  }
  setTargetAtTime(value: number) {
    this.value = value;
  }
  linearRampToValueAtTime(value: number) {
    this.value = value;
  }
  exponentialRampToValueAtTime(value: number) {
    assert.ok(value > 0);
    this.ramps.push(value);
    this.value = value;
  }
}
class AudioNodeMock {
  targets: unknown[] = [];
  disconnected = false;
  connect(node: unknown) {
    this.targets.push(node);
    return node;
  }
  disconnect() {
    this.disconnected = true;
  }
}
class Gain extends AudioNodeMock {
  gain = new Param();
}
class Filter extends AudioNodeMock {
  type = '';
  frequency = new Param();
  Q = new Param();
}
class Oscillator extends AudioNodeMock {
  type = '';
  frequency = new Param();
  onended: (() => void) | null = null;
  startTime = 0;
  stops = 0;
  start(time: number) {
    this.startTime = time;
  }
  stop() {
    this.stops++;
  }
}
class Meter extends AudioNodeMock {
  fftSize = 0;
  smoothingTimeConstant = 0;
  frequencyBinCount = 32;
  getByteFrequencyData(data: Uint8Array) {
    data.fill(128);
  }
}
class BufferSource extends AudioNodeMock {
  buffer: unknown;
  loop = false;
  stops = 0;
  start() {}
  stop() {
    this.stops++;
  }
}
class Context {
  state = 'suspended';
  currentTime = 0;
  sampleRate = 44100;
  destination = new AudioNodeMock();
  filters: Filter[] = [];
  gains: Gain[] = [];
  oscillators: Oscillator[] = [];
  buffers: BufferSource[] = [];
  meter = new Meter();
  mediaSource = new AudioNodeMock();
  mediaSources = 0;
  closes = 0;
  bufferCount = 0;
  resume = () => {
    this.state = 'running';
    return Promise.resolve();
  };
  suspend = () => {
    this.state = 'suspended';
    return Promise.resolve();
  };
  close = () => {
    this.state = 'closed';
    this.closes++;
    return Promise.resolve();
  };
  createBiquadFilter() {
    const node = new Filter();
    this.filters.push(node);
    return node;
  }
  createGain() {
    const node = new Gain();
    this.gains.push(node);
    return node;
  }
  createAnalyser() {
    return this.meter;
  }
  createMediaElementSource() {
    this.mediaSources++;
    return this.mediaSource;
  }
  createOscillator() {
    const node = new Oscillator();
    this.oscillators.push(node);
    return node;
  }
  createBuffer() {
    this.bufferCount++;
    return { getChannelData: () => new Float32Array(88200) };
  }
  createBufferSource() {
    const node = new BufferSource();
    this.buffers.push(node);
    return node;
  }
}
class Media {
  preload = '';
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
  currentTime = 0;
  ended = false;
  loads = 0;
  pauses = 0;
  play = () => Promise.resolve();
  pause() {
    this.pauses++;
  }
  load() {
    this.loads++;
    this.currentTime = 0;
    this.ended = false;
  }
  removeAttribute() {
    this.src = '';
  }
}
function setup() {
  const context = new Context(),
    media = new Media();
  const revoked: string[] = [],
    created: string[] = [];
  let contexts = 0;
  const engine = new RetroAudioEngine(undefined, {
    createContext: () => {
      contexts++;
      return context as unknown as AudioContext;
    },
    createMedia: () => media as unknown as HTMLAudioElement,
    urls: {
      createObjectURL: () => {
        const url = 'blob:cassette-' + (created.length + 1);
        created.push(url);
        return url;
      },
      revokeObjectURL: (url) => {
        assert.notEqual(media.src, url, 'detach media before revoking its object URL');
        revoked.push(url);
      },
    },
  });
  return {
    context,
    media,
    engine,
    revoked,
    created,
    get contexts() {
      return contexts;
    },
  };
}
function temporaryGlobal(name: string, value: unknown) {
  const old = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, value });
  return () =>
    old ? Object.defineProperty(globalThis, name, old) : Reflect.deleteProperty(globalThis, name);
}
function timers() {
  const active = new Map<number, () => void>();
  let id = 0;
  const restore = [
    temporaryGlobal('setInterval', (callback: () => void) => {
      active.set(++id, callback);
      return id;
    }),
    temporaryGlobal('clearInterval', (key: number) => active.delete(key)),
  ];
  return { active, restore: () => restore.reverse().forEach((fn) => fn()) };
}
const audioFile = (name = 'Mi cinta.MP3', type = 'audio/mpeg') =>
  new File(['audio'], name, { type });

test('radio defaults never autoplay or restore local media; all three stations are procedural', () => {
  assert.equal(DEFAULT_RADIO_STATE.isPlaying, false);
  assert.equal(DEFAULT_RADIO_STATE.userTrack, null);
  assert.equal(DEFAULT_RADIO_STATE.isMinimized, true);
  assert.equal(DEFAULT_RADIO_STATE.volume, 0.35);
  assert.equal(RADIO_STATIONS.length, 3);
  assert.ok(RADIO_STATIONS.every((station) => station.isProcedural && !station.streamUrl));
  assert.equal(new Set(RADIO_STATIONS.map((station) => station.id)).size, 3);
});
test('filter presets expose the specified topology and exact cutoff/Q values', () => {
  assert.deepEqual(
    Object.values(AUDIO_FILTER_CONFIGS).map(({ filterType, frequency, Q }) => [
      filterType,
      frequency,
      Q,
    ]),
    [
      ['allpass', 20000, 1],
      ['bandpass', 1800, 1.8],
      ['lowpass', 4200, 0.7],
    ],
  );
});
test('preferences round-trip only four allowed keys without names, blobs or autoplay state', () => {
  const state = {
    ...DEFAULT_RADIO_STATE,
    volume: 0.8,
    isPlaying: true,
    isMinimized: false,
    activeFilter: 'gameboy' as const,
    rainFxEnabled: true,
    userTrack: { name: 'PRIVATE TRACK', fileSize: 20, format: 'MP3', objectUrl: 'blob:private' },
  };
  const values = serializeRadioPreferences(state);
  assert.equal(Object.keys(values).length, 4);
  assert.doesNotMatch(JSON.stringify(values), /PRIVATE|blob:|isPlaying/);
  assert.deepEqual(readRadioPreferences({ getItem: (key) => values[key] ?? null }), {
    ...DEFAULT_RADIO_STATE,
    volume: 0.8,
    isMinimized: false,
    activeFilter: 'gameboy',
    rainFxEnabled: true,
  });
  const saved: Record<string, string> = {};
  writeRadioPreferences(
    {
      setItem: (key, value) => {
        saved[key] = value;
      },
    },
    state,
  );
  assert.deepEqual(saved, values);
});
test('corrupt or blocked storage and non-finite volumes keep safe bounded defaults', () => {
  for (const value of ['NaN', 'Infinity', '', ' ', 'nope'])
    assert.equal(
      readRadioPreferences({
        getItem: (key) => (key === RADIO_STORAGE_KEYS.volume ? value : 'unknown'),
      }).volume,
      0.35,
    );
  assert.equal(radioVolume(NaN), 0.35);
  assert.equal(radioVolume(-1), 0);
  assert.equal(radioVolume(4), 1);
  assert.deepEqual(
    readRadioPreferences({
      getItem: () => {
        throw new Error('denied');
      },
    }),
    DEFAULT_RADIO_STATE,
  );
  assert.doesNotThrow(() =>
    writeRadioPreferences(
      {
        setItem: () => {
          throw new Error('denied');
        },
      },
      DEFAULT_RADIO_STATE,
    ),
  );
  assert.equal(
    readRadioPreferences({ getItem: (key) => (key === RADIO_STORAGE_KEYS.volume ? '5' : null) })
      .volume,
    1,
  );
});
test('cassette validation accepts audio MIME or genuine untyped extensions and sanitizes metadata', () => {
  assert.deepEqual(
    cassetteMetadata({ name: '  Mi\u0000 cinta.MP3', type: 'audio/mpeg', size: 123 }),
    { name: 'Mi cinta', fileSize: 123, format: 'MP3' },
  );
  for (const ext of ['wav', 'ogg', 'flac', 'm4a', 'aac', 'opus', 'aiff'])
    assert.ok(cassetteMetadata({ name: 'track.' + ext, type: '', size: 1 }));
  for (const file of [
    { name: 'image.jpg', type: 'image/jpeg', size: 1 },
    { name: 'spoof.mp3', type: 'text/html', size: 1 },
    { name: 'script.js', type: '', size: 1 },
    { name: 'empty.mp3', type: 'audio/mpeg', size: 0 },
    { name: 'bad.wav', type: 'audio/wav', size: Infinity },
  ])
    assert.equal(cassetteMetadata(file), null);
  assert.equal(
    cassetteMetadata({ name: 'x'.repeat(300) + '.flac', type: '', size: 1 })?.name.length,
    120,
  );
});
test('audio graph is lazy and shares one media source, with working DSP, mute and gain', async () => {
  const fakeTimers = timers(),
    f = setup();
  try {
    assert.equal(f.contexts, 0);
    f.engine.setFilter('gameboy');
    f.engine.setVolume(0.7);
    assert.equal(await f.engine.play(), true);
    assert.equal(f.contexts, 1);
    assert.equal(f.context.mediaSources, 1);
    assert.equal(f.context.filters[0]!.type, 'bandpass');
    assert.equal(f.context.filters[0]!.frequency.value, 1800);
    assert.equal(f.context.filters[0]!.Q.value, 1.8);
    assert.equal(f.context.filters[0]!.targets[0], f.context.meter);
    assert.equal(f.context.meter.targets[0], f.context.gains[0]);
    assert.equal(f.context.gains[0]!.targets[0], f.context.destination);
    assert.equal(f.context.meter.fftSize, 64);
    assert.equal(f.context.meter.smoothingTimeConstant, 0.8);
    assert.equal(f.context.gains[0]!.gain.value, 0.7);
    f.engine.toggleMute();
    assert.equal(f.context.gains[0]!.gain.value, 0);
    f.engine.toggleMute();
    assert.equal(f.context.gains[0]!.gain.value, 0.7);
    f.engine.setFilter('tape_warmth');
    assert.equal(f.context.filters[0]!.frequency.value, 4200);
    f.context.currentTime = 15;
    assert.equal(f.engine.position, 15);
    f.engine.pause();
    assert.equal(f.engine.snapshot.isPlaying, false);
    assert.equal(f.context.state, 'suspended');
    assert.equal(fakeTimers.active.size, 0);
    assert.ok(f.context.oscillators.every((node) => node.disconnected));
    f.context.currentTime = 16;
    assert.equal(f.engine.position, 15);
    await f.engine.play();
    assert.equal(f.context.mediaSources, 1);
  } finally {
    f.engine.dispose();
    fakeTimers.restore();
  }
});
test('replacing, ejecting and disposing cassette files revoke every URL exactly once', async () => {
  const f = setup();
  assert.equal(f.engine.loadCassette(audioFile()), true);
  assert.equal(f.contexts, 0);
  await f.engine.play();
  f.media.currentTime = 12;
  f.engine.pause();
  const loads = f.media.loads;
  await f.engine.play();
  assert.equal(f.media.currentTime, 12);
  assert.equal(f.media.loads, loads);
  f.engine.loadCassette(audioFile('second.ogg', 'audio/ogg'));
  assert.deepEqual(f.revoked, ['blob:cassette-1']);
  assert.equal(f.context.mediaSources, 1);
  f.engine.eject();
  assert.deepEqual(f.revoked, f.created);
  assert.equal(f.engine.snapshot.userTrack, null);
  assert.equal(f.engine.snapshot.activeStationId, 'chiptune_procedural');
  f.engine.loadCassette(audioFile());
  f.engine.dispose();
  f.engine.dispose();
  assert.deepEqual(f.revoked, f.created);
  assert.equal(f.context.closes, 1);
});
test('invalid and undecodable cassettes surface a stable error and reset safely', async () => {
  const f = setup();
  try {
    assert.equal(f.engine.loadCassette(audioFile('not-a-song.jpg', 'image/jpeg')), false);
    assert.equal(f.created.length, 0);
    assert.equal(f.engine.snapshot.error, 'ERR: INVALID CASSETTE FORMAT');
    f.engine.loadCassette(audioFile('corrupt.flac', 'audio/flac'));
    f.media.play = () => Promise.reject(new Error('codec rejected'));
    assert.equal(await f.engine.play(), false);
    assert.equal(f.engine.snapshot.userTrack, null);
    assert.equal(f.engine.snapshot.isPlaying, false);
    assert.deepEqual(f.revoked, f.created);
    f.engine.loadCassette(audioFile());
    f.media.onerror?.();
    assert.equal(f.engine.snapshot.error, 'ERR: INVALID CASSETTE FORMAT');
    assert.deepEqual(f.revoked, f.created);
  } finally {
    f.engine.dispose();
  }
});
test('pending resume cannot restart after pause, and disposal cancels stale continuations', async () => {
  const f = setup();
  let resume!: () => void;
  f.context.resume = () =>
    new Promise<void>((resolve) => {
      resume = resolve;
    });
  const play = f.engine.play();
  assert.equal(f.engine.snapshot.pending, true);
  f.engine.pause();
  resume();
  assert.equal(await play, false);
  assert.equal(f.context.oscillators.length, 0);
  assert.equal(f.engine.snapshot.isPlaying, false);
  const later = f.engine.play();
  f.engine.dispose();
  resume();
  assert.equal(await later, false);
  assert.equal(f.context.closes, 1);
});
test('rain reuses its noise buffer and disconnects sources on pause or effect toggle', async () => {
  const fakeTimers = timers(),
    f = setup();
  try {
    f.engine.setRain(true);
    await f.engine.play();
    assert.equal(f.context.bufferCount, 1);
    assert.equal(f.context.buffers[0]!.loop, true);
    assert.equal(f.context.filters[1]!.type, 'lowpass');
    assert.equal(
      f.context.gains.find((g) => g.gain.value === 0.03)?.targets[0],
      f.context.filters[0],
    );
    f.engine.setRain(false);
    assert.equal(f.context.buffers[0]!.stops, 1);
    f.engine.setRain(true);
    assert.equal(f.context.bufferCount, 1);
    f.engine.pause();
    assert.equal(f.context.buffers[1]!.disconnected, true);
  } finally {
    f.engine.dispose();
    fakeTimers.restore();
  }
});
test('synth uses bounded positive envelopes and never schedules an overdue burst after throttling', () => {
  const fakeTimers = timers(),
    ctx = new Context();
  const synth = createProceduralSynth(
    ctx as unknown as AudioContext,
    ctx.destination as unknown as AudioNode,
    'chiptune_procedural',
  );
  try {
    synth.start();
    synth.start();
    assert.equal(fakeTimers.active.size, 1);
    assert.ok(ctx.oscillators.some((node) => node.type === 'square'));
    assert.ok(ctx.oscillators.some((node) => node.type === 'sawtooth'));
    const before = ctx.oscillators.length;
    ctx.currentTime = 100000;
    [...fakeTimers.active.values()][0]!();
    const added = ctx.oscillators.slice(before);
    assert.ok(added.length > 0 && added.length < 20);
    assert.ok(added.every((node) => node.startTime >= ctx.currentTime));
    synth.stop();
    synth.stop();
    assert.equal(fakeTimers.active.size, 0);
    assert.ok(ctx.oscillators.every((node) => node.disconnected));
  } finally {
    synth.stop();
    fakeTimers.restore();
  }
});
test('elapsed labels and standalone routing are deterministic', () => {
  assert.equal(radioTime(125.9), '02:05');
  assert.equal(radioTime(NaN), '00:00');
  assert.equal(radioTime(-20), '00:00');
  for (const path of ['/guardian', '/guardian/setup', '/gatekeeper'])
    assert.equal(radioAllowedAtPath(path), false);
  for (const path of ['/', '/library', '/explore', '/worlds', '/guardian-guide'])
    assert.equal(radioAllowedAtPath(path), true);
});
test('equalizer cancels frames when paused, hidden, reduced, or unmounted', async () => {
  const runtime = await import(fixture);
  const { EqualizerVisualizer } =
    await import('../../src/components/retro-radio/equalizer-visualizer.tsx');
  const transforms = Array.from({ length: 8 }, () => ({ style: { transform: '' } }));
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0,
    hidden = false;
  const events = new Map<string, () => void>();
  const query = {
    matches: false,
    addEventListener: (key: string, cb: () => void) => events.set(key, cb),
    removeEventListener: (key: string) => events.delete(key),
  };
  const restore = [
    temporaryGlobal('window', { matchMedia: () => query }),
    temporaryGlobal('document', {
      get hidden() {
        return hidden;
      },
      addEventListener: (key: string, cb: () => void) => events.set(key, cb),
      removeEventListener: (key: string) => events.delete(key),
    }),
    temporaryGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++id, callback);
      return id;
    }),
    temporaryGlobal('cancelAnimationFrame', (key: number) => frames.delete(key)),
  ];
  try {
    EqualizerVisualizer({ active: true, analyser: new Meter() as unknown as AnalyserNode });
    runtime.refs.at(-1).current = { querySelectorAll: () => transforms };
    const cleanup = runtime.effects.at(-1)();
    assert.equal(frames.size, 1);
    const callback = [...frames.values()][0]!;
    frames.clear();
    callback(40);
    assert.notEqual(transforms[0]!.style.transform, 'scaleY(0.2)');
    query.matches = true;
    events.get('change')!();
    assert.equal(frames.size, 0);
    assert.ok(transforms.every((bar) => bar.style.transform === 'scaleY(0.2)'));
    query.matches = false;
    events.get('change')!();
    assert.equal(frames.size, 1);
    hidden = true;
    events.get('visibilitychange')!();
    assert.equal(frames.size, 0);
    hidden = false;
    events.get('visibilitychange')!();
    assert.equal(frames.size, 1);
    cleanup();
    assert.equal(frames.size, 0);
    assert.equal(events.size, 0);
    EqualizerVisualizer({ active: false, analyser: new Meter() as unknown as AnalyserNode });
    runtime.refs.at(-1).current = { querySelectorAll: () => transforms };
    runtime.effects.at(-1)()();
    assert.equal(frames.size, 0);
  } finally {
    restore.reverse().forEach((fn) => fn());
  }
});

test('autoplay rejection retains a valid cassette for a later explicit Play gesture', async () => {
  const f = setup();
  try {
    f.engine.loadCassette(audioFile());
    f.media.play = () => Promise.reject(new DOMException('gesture required', 'NotAllowedError'));
    assert.equal(await f.engine.play(), false);
    assert.equal(f.engine.snapshot.userTrack?.name, 'Mi cinta');
    assert.equal(f.revoked.length, 0);
    assert.equal(f.engine.snapshot.error, 'Pulsa ▶ para habilitar el audio.');
    f.media.play = () => Promise.resolve();
    assert.equal(await f.engine.play(), true);
  } finally {
    f.engine.dispose();
  }
});
