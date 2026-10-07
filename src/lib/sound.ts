'use client';
let context: AudioContext | undefined;
const active = new Set<OscillatorNode>();
export const audioEvent = 'savestate-audio-change';
export function isAudioEnabled() {
  try {
    return typeof window !== 'undefined' && localStorage.getItem('savestate_audio') === 'enabled';
  } catch {
    return false;
  }
}
export function toggleAudio() {
  const next = !isAudioEnabled();
  try {
    localStorage.setItem('savestate_audio', next ? 'enabled' : 'disabled');
  } catch {
    return false;
  }
  if (!next)
    for (const oscillator of active) {
      try {
        oscillator.stop();
      } catch {
        /* Already stopped. */
      }
    }
  window.dispatchEvent(new Event(audioEvent));
  return next;
}
export function subscribeAudio(callback: () => void) {
  window.addEventListener(audioEvent, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(audioEvent, callback);
    window.removeEventListener('storage', callback);
  };
}
// Call during a user gesture, before an asynchronous mutation.
export function unlockAudio() {
  if (!isAudioEnabled()) return;
  try {
    context ??= new window.AudioContext();
    if (context.state === 'suspended') void context.resume().catch(() => {});
  } catch {
    /* Audio support is optional. */
  }
}
function play(notes: number[], duration: number, type: OscillatorType = 'square') {
  if (!isAudioEnabled()) return;
  unlockAudio();
  const ctx = context;
  if (!ctx || ctx.state !== 'running') return;
  try {
    notes.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain();
      const start = ctx.currentTime + index * duration;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.04, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      active.add(oscillator);
      oscillator.onended = () => {
        active.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + duration);
    });
  } catch {
    /* Feedback must never interrupt an action. */
  }
}
export const soundFx = {
  click: () => play([800], 0.04),
  criticalHit: () => play([520, 1040], 0.09, 'sawtooth'),
  levelUp: () => play([440, 554.37, 659.25], 0.1),
  error: () => play([180], 0.12, 'sawtooth'),
};
