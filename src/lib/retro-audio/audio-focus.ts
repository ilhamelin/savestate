export const AUDIO_FOCUS_EVENT = 'savestate:audio-focus';
export function requestAudioFocus(owner: 'retro-radio' | 'worlds-music') {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(AUDIO_FOCUS_EVENT, { detail: owner }));
}
