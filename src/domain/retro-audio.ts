export type AudioFilterPreset = 'hifi' | 'gameboy' | 'tape_warmth';
export type RadioStationId =
  'chiptune_procedural' | 'lofi_ambient' | 'synthwave_pulse' | 'user_cassette';
export interface RadioStation {
  id: RadioStationId;
  name: string;
  genre: string;
  description: string;
  isProcedural: boolean;
  streamUrl?: string;
}
export interface UserCassetteTrack {
  name: string;
  fileSize: number;
  format: string;
  objectUrl: string;
}
export interface RetroRadioState {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  activeStationId: RadioStationId;
  activeFilter: AudioFilterPreset;
  isMinimized: boolean;
  rainFxEnabled: boolean;
  userTrack: UserCassetteTrack | null;
}
export const RADIO_STATIONS: RadioStation[] = [
  {
    id: 'chiptune_procedural',
    name: '8-Bit Odyssey',
    genre: 'Chiptune FM',
    description: 'Arpegios retro generados con osciladores Web Audio.',
    isProcedural: true,
  },
  {
    id: 'lofi_ambient',
    name: 'Neo Akihabara',
    genre: 'Lo-Fi Chill',
    description: 'Melodías lentas para acompañar tu backlog.',
    isProcedural: true,
  },
  {
    id: 'synthwave_pulse',
    name: 'Cyber Horizon',
    genre: 'Outrun Synth',
    description: 'Bajos pulsantes y secuencias de neón.',
    isProcedural: true,
  },
];
export const AUDIO_FILTER_CONFIGS: Record<
  AudioFilterPreset,
  { label: string; filterType: BiquadFilterType; frequency: number; Q: number }
> = {
  hifi: { label: 'Hi-Fi Master', filterType: 'allpass', frequency: 20000, Q: 1 },
  gameboy: { label: 'Game Boy Speaker', filterType: 'bandpass', frequency: 1800, Q: 1.8 },
  tape_warmth: { label: 'Cassette Warmth', filterType: 'lowpass', frequency: 4200, Q: 0.7 },
};
export const DEFAULT_RADIO_STATE: RetroRadioState = {
  isPlaying: false,
  isMuted: false,
  volume: 0.35,
  activeStationId: 'chiptune_procedural',
  activeFilter: 'hifi',
  isMinimized: true,
  rainFxEnabled: false,
  userTrack: null,
};
export const RADIO_STORAGE_KEYS = {
  isMinimized: 'savestate_radio_minimized',
  volume: 'savestate_radio_volume',
  activeFilter: 'savestate_radio_filter',
  rainFxEnabled: 'savestate_radio_rain',
} as const;
export function radioVolume(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : DEFAULT_RADIO_STATE.volume;
}
export function serializeRadioPreferences(state: RetroRadioState): Record<string, string> {
  return {
    [RADIO_STORAGE_KEYS.isMinimized]: String(state.isMinimized),
    [RADIO_STORAGE_KEYS.volume]: String(radioVolume(state.volume)),
    [RADIO_STORAGE_KEYS.activeFilter]: state.activeFilter,
    [RADIO_STORAGE_KEYS.rainFxEnabled]: String(state.rainFxEnabled),
  };
}
export function readRadioPreferences(storage?: Pick<Storage, 'getItem'>): RetroRadioState {
  const state = { ...DEFAULT_RADIO_STATE };
  if (!storage) return state;
  try {
    const values = Object.fromEntries(
      Object.entries(RADIO_STORAGE_KEYS).map(([key, name]) => [key, storage.getItem(name)]),
    );
    if (values.isMinimized === 'true' || values.isMinimized === 'false')
      state.isMinimized = values.isMinimized === 'true';
    if (values.rainFxEnabled === 'true' || values.rainFxEnabled === 'false')
      state.rainFxEnabled = values.rainFxEnabled === 'true';
    if (
      values.volume !== null &&
      values.volume.trim() !== '' &&
      Number.isFinite(Number(values.volume))
    )
      state.volume = radioVolume(Number(values.volume));
    if (
      values.activeFilter === 'hifi' ||
      values.activeFilter === 'gameboy' ||
      values.activeFilter === 'tape_warmth'
    )
      state.activeFilter = values.activeFilter;
  } catch {
    /* Storage can be unavailable in privacy mode. */
  }
  return state;
}
export function writeRadioPreferences(storage: Pick<Storage, 'setItem'>, state: RetroRadioState) {
  try {
    for (const [key, value] of Object.entries(serializeRadioPreferences(state)))
      storage.setItem(key, value);
  } catch {
    /* Playback does not depend on storage permissions. */
  }
}
export function cassetteMetadata(
  file: Pick<File, 'name' | 'type' | 'size'>,
): Omit<UserCassetteTrack, 'objectUrl'> | null {
  if (!Number.isSafeInteger(file.size) || file.size <= 0) return null;
  const extension = file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  const audioMime = file.type.toLowerCase().startsWith('audio/');
  const genericMime = !file.type || file.type === 'application/octet-stream';
  if (
    !audioMime &&
    !(genericMime && /^(mp3|wav|ogg|flac|m4a|aac|opus|aiff?)$/.test(extension ?? ''))
  )
    return null;
  const name = file.name
    .replace(/\.[^/.]+$/, '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 120);
  return {
    name: name || 'Cassette sin título',
    fileSize: file.size,
    format: (extension ?? file.type.split('/')[1] ?? 'audio').toUpperCase().slice(0, 12),
  };
}
export function radioAllowedAtPath(pathname: string) {
  return (
    pathname !== '/gatekeeper' && pathname !== '/guardian' && !pathname.startsWith('/guardian/')
  );
}
export function radioTime(seconds: number) {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return (
    Math.floor(value / 60)
      .toString()
      .padStart(2, '0') +
    ':' +
    (value % 60).toString().padStart(2, '0')
  );
}
