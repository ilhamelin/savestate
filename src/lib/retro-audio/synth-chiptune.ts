import type { RadioStationId } from '@/domain/retro-audio';

const scale = [220, 261.63, 293.66, 329.63, 392, 440, 523.25];
const melody = [0, 2, 4, 1, 3, 5, 2, 6, 4, 2, 1, 3, 0, 5, 4, 2];

/** Bounded look-ahead avoids bursts after timer throttling in a background tab. */
export function createProceduralSynth(
  context: AudioContext,
  destination: AudioNode,
  station: Exclude<RadioStationId, 'user_cassette'>,
) {
  let timer: ReturnType<typeof setInterval> | null = null;
  let step = 0,
    nextTime = 0;
  const voices = new Map<OscillatorNode, GainNode>();
  const ambient = station === 'lofi_ambient';
  const beat = ambient ? 0.5 : station === 'synthwave_pulse' ? 0.22 : 0.16;
  function note(
    frequency: number,
    time: number,
    duration: number,
    type: OscillatorType,
    peak: number,
  ) {
    const oscillator = context.createOscillator(),
      envelope = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.linearRampToValueAtTime(peak, time + 0.015);
    envelope.gain.exponentialRampToValueAtTime(peak * 0.45, time + 0.08);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.1);
    oscillator.connect(envelope);
    envelope.connect(destination);
    voices.set(oscillator, envelope);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
      voices.delete(oscillator);
    };
    oscillator.start(time);
    oscillator.stop(time + duration + 0.12);
  }
  function schedule() {
    nextTime = Math.max(nextTime, context.currentTime);
    while (nextTime < context.currentTime + 1.5) {
      const frequency = scale[melody[step % melody.length]!]!;
      note(
        frequency,
        nextTime,
        ambient ? 0.75 : beat * 0.7,
        ambient ? 'triangle' : station === 'synthwave_pulse' ? 'sawtooth' : 'square',
        ambient ? 0.025 : 0.035,
      );
      if (step % 4 === 0)
        note(
          scale[Math.floor(step / 16) % 3]! / 2,
          nextTime,
          beat * 2,
          ambient ? 'sine' : 'sawtooth',
          0.035,
        );
      nextTime += beat;
      step++;
    }
  }
  return {
    start() {
      if (timer !== null) return;
      nextTime = context.currentTime;
      schedule();
      timer = setInterval(schedule, 100);
    },
    stop() {
      if (timer !== null) clearInterval(timer);
      timer = null;
      for (const [oscillator, envelope] of voices) {
        oscillator.onended = null;
        try {
          oscillator.stop();
        } catch {
          /* A scheduled voice may already have ended. */
        }
        oscillator.disconnect();
        envelope.disconnect();
      }
      voices.clear();
    },
  };
}
