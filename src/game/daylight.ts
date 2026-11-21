import { hex, mix, type RGB } from './math';

export interface Light {
  name: string;
  /** colour multiplied over the whole scene */
  tint: RGB;
  /** strength of the tint */
  amount: number;
  /** 0 day … 1 night: lamps, windows, fireflies */
  night: number;
  /** shadow direction & length */
  shadow: number;
}

const PHASES: (Light & { weight: number })[] = [
  { name: 'Golden Hour', tint: hex('#ffc48f'), amount: 0.32, night: 0, shadow: 1.6, weight: 0.4 },
  { name: 'Pink Dusk', tint: hex('#c98fb8'), amount: 0.5, night: 0.4, shadow: 2.2, weight: 0.2 },
  { name: 'Blue Night', tint: hex('#2f3a7a'), amount: 0.72, night: 1, shadow: 0.6, weight: 0.22 },
  { name: 'Soft Dawn', tint: hex('#d9c4ea'), amount: 0.3, night: 0.2, shadow: 1.8, weight: 0.18 },
];

export const CYCLE_SECONDS = 7 * 60;

export function lightAt(t: number): Light {
  const phase = (((t / CYCLE_SECONDS) % 1) + 1) % 1;
  let acc = 0;
  let i = 0;
  for (; i < PHASES.length - 1; i++) {
    if (phase < acc + PHASES[i].weight) break;
    acc += PHASES[i].weight;
  }
  const local = (phase - acc) / PHASES[i].weight;
  const blend = local < 0.65 ? 0 : (local - 0.65) / 0.35;
  const s = blend * blend * (3 - 2 * blend);
  const a = PHASES[i];
  const b = PHASES[(i + 1) % PHASES.length];
  return {
    name: s < 0.5 ? a.name : b.name,
    tint: mix(a.tint, b.tint, s),
    amount: a.amount + (b.amount - a.amount) * s,
    night: a.night + (b.night - a.night) * s,
    shadow: a.shadow + (b.shadow - a.shadow) * s,
  };
}
