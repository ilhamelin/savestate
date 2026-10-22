import {
  AUDIO_FILTER_CONFIGS,
  DEFAULT_RADIO_STATE,
  RADIO_STATIONS,
  cassetteMetadata,
  radioVolume,
  type AudioFilterPreset,
  type RadioStationId,
  type RetroRadioState,
} from '@/domain/retro-audio';
import { createProceduralSynth } from './synth-chiptune';
import { requestAudioFocus } from './audio-focus';

export interface RadioSnapshot extends RetroRadioState {
  pending: boolean;
  error: string | null;
  sampleRate: number;
}
export const INITIAL_RADIO_SNAPSHOT: RadioSnapshot = {
  ...DEFAULT_RADIO_STATE,
  pending: false,
  error: null,
  sampleRate: 44100,
};
type Dependencies = {
  createContext?: () => AudioContext;
  createMedia?: () => HTMLAudioElement;
  urls?: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>;
};

/** One controller per persistent root deck. Browser resources are created only by user gestures. */
export class RetroAudioEngine {
  private current: RadioSnapshot;
  private listeners = new Set<() => void>();
  private context: AudioContext | null = null;
  private filter: BiquadFilterNode | null = null;
  private meter: AnalyserNode | null = null;
  private master: GainNode | null = null;
  private media: HTMLAudioElement | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;
  private synth: ReturnType<typeof createProceduralSynth> | null = null;
  private rain: { source: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null =
    null;
  private noise: AudioBuffer | null = null;
  private generation = 0;
  private disposed = false;
  private elapsed = 0;
  private startedAt = 0;
  private dependencies: Dependencies;

  constructor(preferences: RetroRadioState = DEFAULT_RADIO_STATE, dependencies: Dependencies = {}) {
    this.current = {
      ...INITIAL_RADIO_SNAPSHOT,
      ...preferences,
      isPlaying: false,
      isMuted: false,
      userTrack: null,
    };
    this.dependencies = dependencies;
  }
  get snapshot(): Readonly<RadioSnapshot> {
    return this.current;
  }
  get analyser() {
    return this.meter;
  }
  get position() {
    if (this.current.activeStationId === 'user_cassette') return this.media?.currentTime ?? 0;
    return (
      this.elapsed +
      (this.current.isPlaying && this.context ? this.context.currentTime - this.startedAt : 0)
    );
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private update(patch: Partial<RadioSnapshot>) {
    this.current = { ...this.current, ...patch };
    for (const listener of this.listeners) listener();
  }
  private audio() {
    if (!this.media) {
      this.media = this.dependencies.createMedia?.() ?? new Audio();
      this.media.preload = 'metadata';
      this.media.onended = () => {
        if (this.current.activeStationId === 'user_cassette') this.pause();
      };
    }
    return this.media;
  }
  private graph() {
    if (this.context) return this.context;
    const context =
      this.dependencies.createContext?.() ?? new window.AudioContext({ sampleRate: 44100 });
    try {
      const filter = context.createBiquadFilter(),
        meter = context.createAnalyser(),
        master = context.createGain();
      meter.fftSize = 64;
      meter.smoothingTimeConstant = 0.8;
      master.gain.value = 0;
      filter.connect(meter);
      meter.connect(master);
      master.connect(context.destination);
      const mediaSource = context.createMediaElementSource(this.audio());
      mediaSource.connect(filter);
      this.context = context;
      this.filter = filter;
      this.meter = meter;
      this.master = master;
      this.mediaSource = mediaSource;
      this.applyFilter();
      this.applyGain();
      this.update({ sampleRate: context.sampleRate });
      return context;
    } catch (error) {
      void context.close().catch(() => {});
      throw error;
    }
  }
  private applyFilter() {
    if (!this.context || !this.filter) return;
    const config = AUDIO_FILTER_CONFIGS[this.current.activeFilter];
    this.filter.type = config.filterType;
    this.filter.frequency.setTargetAtTime(
      Math.min(config.frequency, this.context.sampleRate / 2),
      this.context.currentTime,
      0.015,
    );
    this.filter.Q.setTargetAtTime(config.Q, this.context.currentTime, 0.015);
  }
  private applyGain() {
    if (this.context && this.master)
      this.master.gain.setTargetAtTime(
        this.current.isMuted ? 0 : this.current.volume,
        this.context.currentTime,
        0.015,
      );
  }
  private stopRain() {
    if (!this.rain) return;
    this.rain.source.stop();
    this.rain.source.disconnect();
    this.rain.filter.disconnect();
    this.rain.gain.disconnect();
    this.rain = null;
  }
  private startRain() {
    if (this.rain || !this.current.rainFxEnabled || !this.context || !this.filter) return;
    const ctx = this.context;
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const samples = this.noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    source.buffer = this.noise;
    source.loop = true;
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    gain.gain.value = 0.03;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.filter);
    source.start();
    this.rain = { source, filter, gain };
  }
  async play(): Promise<boolean> {
    if (this.disposed) return false;
    if (this.current.isPlaying) return true;
    if (this.current.activeStationId === 'user_cassette' && !this.current.userTrack) return false;
    const generation = ++this.generation;
    this.update({ pending: true, error: null });
    try {
      const context = this.graph();
      // Both permission-gated calls happen before the first await, inside the user gesture.
      const resumed = context.resume();
      let mediaPlaying: Promise<void> | undefined;
      if (this.current.activeStationId === 'user_cassette') {
        if (this.audio().ended) this.audio().currentTime = 0;
        mediaPlaying = this.audio().play();
      }
      await Promise.all([resumed, mediaPlaying]);
      if (this.disposed || generation !== this.generation) return false;
      if (this.current.activeStationId !== 'user_cassette') {
        this.synth ??= createProceduralSynth(context, this.filter!, this.current.activeStationId);
        this.synth.start();
      }
      this.startedAt = context.currentTime;
      this.applyGain();
      this.startRain();
      this.update({ isPlaying: true, pending: false });
      requestAudioFocus('retro-radio');
      return true;
    } catch {
      if (this.disposed || generation !== this.generation) return false;
      const cassette = this.current.activeStationId === 'user_cassette';
      if (cassette) this.eject();
      else this.pause();
      this.update({ error: cassette ? 'ERR: INVALID CASSETTE FORMAT' : 'ERR: AUDIO UNAVAILABLE' });
      return false;
    }
  }
  pause() {
    this.generation++;
    if (this.current.isPlaying && this.current.activeStationId !== 'user_cassette')
      this.elapsed = this.position;
    this.synth?.stop();
    this.stopRain();
    this.media?.pause();
    this.update({ isPlaying: false, pending: false });
    if (this.context && this.context.state !== 'closed')
      void this.context.suspend().catch(() => {});
  }
  setStation(id: RadioStationId) {
    if (id !== 'user_cassette' && !RADIO_STATIONS.some((station) => station.id === id)) return;
    if (id === 'user_cassette' && !this.current.userTrack) return;
    this.pause();
    this.synth = null;
    this.elapsed = 0;
    this.update({ activeStationId: id, error: null });
  }
  setVolume(volume: number) {
    this.update({ volume: radioVolume(volume) });
    this.applyGain();
  }
  toggleMute() {
    this.update({ isMuted: !this.current.isMuted });
    this.applyGain();
  }
  setFilter(activeFilter: AudioFilterPreset) {
    if (!Object.hasOwn(AUDIO_FILTER_CONFIGS, activeFilter)) return;
    this.update({ activeFilter });
    this.applyFilter();
  }
  setRain(rainFxEnabled: boolean) {
    this.update({ rainFxEnabled });
    if (rainFxEnabled && this.current.isPlaying) this.startRain();
    else this.stopRain();
  }
  setMinimized(isMinimized: boolean) {
    this.update({ isMinimized });
  }
  loadCassette(file: File): boolean {
    if (this.disposed) return false;
    const metadata = cassetteMetadata(file);
    if (!metadata) {
      this.update({ error: 'ERR: INVALID CASSETTE FORMAT' });
      return false;
    }
    let objectUrl: string | null = null;
    try {
      const media = this.audio();
      objectUrl = (this.dependencies.urls ?? URL).createObjectURL(file);
      this.pause();
      this.synth = null;
      this.elapsed = 0;
      this.releaseTrack();
      this.update({
        userTrack: { ...metadata, objectUrl },
        activeStationId: 'user_cassette',
        error: null,
      });
      const loadedUrl = objectUrl;
      media.onerror = () => {
        if (!this.disposed && this.current.userTrack?.objectUrl === loadedUrl) {
          this.eject();
          this.update({ error: 'ERR: INVALID CASSETTE FORMAT' });
        }
      };
      media.src = objectUrl;
      media.load();
      return true;
    } catch {
      if (objectUrl && this.current.userTrack?.objectUrl !== objectUrl)
        (this.dependencies.urls ?? URL).revokeObjectURL(objectUrl);
      this.eject();
      this.update({ error: 'ERR: INVALID CASSETTE FORMAT' });
      return false;
    }
  }
  private releaseTrack() {
    if (this.media) {
      this.media.onerror = null;
      this.media.removeAttribute('src');
      this.media.load();
    }
    if (this.current.userTrack)
      (this.dependencies.urls ?? URL).revokeObjectURL(this.current.userTrack.objectUrl);
    this.update({ userTrack: null });
  }
  eject() {
    const active = this.current.activeStationId === 'user_cassette';
    if (active) this.pause();
    this.releaseTrack();
    if (active) this.update({ activeStationId: 'chiptune_procedural' });
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.listeners.clear();
    this.pause();
    this.releaseTrack();
    if (this.media) {
      this.media.onended = null;
      this.media.onerror = null;
    }
    this.mediaSource?.disconnect();
    this.filter?.disconnect();
    this.meter?.disconnect();
    this.master?.disconnect();
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {});
    this.noise = null;
  }
}
