import { getContext, getMaster } from './engine';

/** Short percussive click; the accented downbeat is higher and louder. */
export function playClick(time: number, accent: boolean, level = 1): void {
  const ctx = getContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = accent ? 1760 : 1175;
  const peak = (accent ? 0.5 : 0.3) * level;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peak, time + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
  osc.connect(gain).connect(getMaster());
  osc.start(time);
  osc.stop(time + 0.06);
}

/** Soft two-tone chime used for cues (turn changes, warnings, end of jam). */
export function playChime(time: number, kind: 'warn' | 'go' | 'end' = 'go'): void {
  const ctx = getContext();
  const freqs = kind === 'warn' ? [660, 660] : kind === 'end' ? [784, 523] : [523, 784];
  freqs.forEach((f, i) => {
    const t = time + i * 0.12;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain).connect(getMaster());
    osc.start(t);
    osc.stop(t + 0.4);
  });
}
