import { hex, mix, type RGB } from './math';

/**
 * A full day in about seven and a half minutes. Time runs on a 24 h clock but
 * not at a constant speed: daytime is long, night passes a little quicker.
 */

export interface Light {
  name: string;
  /** colour multiplied over the whole scene */
  tint: RGB;
  /** strength of the tint */
  amount: number;
  /** 0 day … 1 night: lamps, windows, fireflies */
  night: number;
  /** shadow length */
  shadow: number;
  /** clock time, 0 ≤ hour < 24 */
  hour: number;
}

interface Key {
  hour: number;
  name: string;
  tint: RGB;
  amount: number;
  night: number;
  shadow: number;
}

// colour keyframes along the clock (wraps around midnight)
const KEYS: Key[] = [
  { hour: 0, name: 'Night', tint: hex('#2f3a7a'), amount: 0.74, night: 1, shadow: 0.5 },
  { hour: 4.6, name: 'Night', tint: hex('#2f3a7a'), amount: 0.72, night: 1, shadow: 0.5 },
  { hour: 6, name: 'Dawn', tint: hex('#d9c4ea'), amount: 0.32, night: 0.25, shadow: 2.4 },
  { hour: 8, name: 'Morning', tint: hex('#fff2dc'), amount: 0.1, night: 0, shadow: 1.6 },
  { hour: 12, name: 'Day', tint: hex('#ffffff'), amount: 0.0, night: 0, shadow: 0.7 },
  { hour: 16, name: 'Afternoon', tint: hex('#fff0d8'), amount: 0.1, night: 0, shadow: 1.3 },
  { hour: 18, name: 'Golden Hour', tint: hex('#ffc48f'), amount: 0.32, night: 0, shadow: 2.0 },
  { hour: 19.8, name: 'Dusk', tint: hex('#c98fb8'), amount: 0.52, night: 0.45, shadow: 2.4 },
  { hour: 21.3, name: 'Night', tint: hex('#2f3a7a'), amount: 0.74, night: 1, shadow: 0.5 },
];

// how many real seconds each part of the day lasts
const SEGMENTS: { from: number; to: number; seconds: number }[] = [
  { from: 5, to: 8, seconds: 45 }, // dawn
  { from: 8, to: 17, seconds: 170 }, // day
  { from: 17, to: 19.5, seconds: 75 }, // golden hour
  { from: 19.5, to: 21.5, seconds: 45 }, // dusk
  { from: 21.5, to: 29, seconds: 115 }, // night (to 5 am)
];

export const CYCLE_SECONDS = SEGMENTS.reduce((a, s) => a + s.seconds, 0);

/** clock hour for a game time in seconds; the game starts at 9:00 */
export function hourAt(t: number): number {
  // offset so that t = 0 is 9:00 in the morning
  const startOffset = SEGMENTS[0].seconds + (1 / 9) * SEGMENTS[1].seconds;
  let s = (((t + startOffset) % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS;
  for (const seg of SEGMENTS) {
    if (s <= seg.seconds) return (seg.from + ((seg.to - seg.from) * s) / seg.seconds) % 24;
    s -= seg.seconds;
  }
  return 5;
}

export function lightAt(t: number): Light {
  const hour = hourAt(t);
  let a = KEYS[KEYS.length - 1];
  let b = KEYS[0];
  for (let i = 0; i < KEYS.length; i++) {
    const k = KEYS[i];
    const n = KEYS[i + 1];
    if (n && hour >= k.hour && hour < n.hour) {
      a = k;
      b = n;
      break;
    }
  }
  const span = (b.hour - a.hour + 24) % 24 || 24;
  const f = ((hour - a.hour + 24) % 24) / span;
  const s = f * f * (3 - 2 * f);
  return {
    name: s < 0.5 ? a.name : b.name,
    tint: mix(a.tint, b.tint, s),
    amount: a.amount + (b.amount - a.amount) * s,
    night: a.night + (b.night - a.night) * s,
    shadow: a.shadow + (b.shadow - a.shadow) * s,
    hour,
  };
}

export function formatHour(h: number) {
  const hh = Math.floor(h);
  const mm = Math.floor(((h - hh) * 60) / 10) * 10;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** how busy the streets are at a given hour, 0..1 */
export function busyness(h: number): number {
  if (h < 5 || h >= 23) return 0.15;
  if (h < 7) return 0.35;
  if (h < 9.5) return 1; // morning rush
  if (h < 16.5) return 0.65;
  if (h < 19.5) return 1; // evening rush
  if (h < 21.5) return 0.6;
  return 0.3;
}
