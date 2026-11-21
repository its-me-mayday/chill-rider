import { hex, mix, type RGB } from './math';

export interface Palette {
  skyTop: RGB;
  skyMid: RGB;
  skyHorizon: RGB;
  sun: RGB;
  sunGlow: RGB;
  far: RGB; // distant mountains
  mid: RGB;
  near: RGB;
  ground: RGB;
  groundDeep: RGB;
  road: RGB;
  roadLine: RGB;
  foliage: RGB;
  foliage2: RGB;
  trunk: RGB;
  cloud: RGB;
  /** 0 = full daylight, 1 = deep night — drives stars, lamps and window lights */
  night: number;
}

const p = (o: Palette) => o;

const KEYS: { name: string; pal: Palette }[] = [
  {
    name: 'Golden Hour',
    pal: p({
      skyTop: hex('#ff9a8b'), skyMid: hex('#ffb38a'), skyHorizon: hex('#ffe0a3'),
      sun: hex('#fff1b8'), sunGlow: hex('#ffcf7d'),
      far: hex('#e8918f'), mid: hex('#d4767f'), near: hex('#b35d72'),
      ground: hex('#8f4d63'), groundDeep: hex('#5e3350'),
      road: hex('#4a2d43'), roadLine: hex('#ffd9a0'),
      foliage: hex('#e2726b'), foliage2: hex('#f29a6e'), trunk: hex('#5a3040'),
      cloud: hex('#ffd6c2'), night: 0,
    }),
  },
  {
    name: 'Pink Dusk',
    pal: p({
      skyTop: hex('#6a5acd'), skyMid: hex('#d77fa1'), skyHorizon: hex('#ffb3a7'),
      sun: hex('#ffd1b0'), sunGlow: hex('#ff8fa3'),
      far: hex('#a66ba6'), mid: hex('#8a5591'), near: hex('#6e437d'),
      ground: hex('#573667'), groundDeep: hex('#3a2450'),
      road: hex('#2f1f40'), roadLine: hex('#ffc4c9'),
      foliage: hex('#b05a8a'), foliage2: hex('#d47a95'), trunk: hex('#3b2343'),
      cloud: hex('#f5b3c4'), night: 0.35,
    }),
  },
  {
    name: 'Blue Night',
    pal: p({
      skyTop: hex('#0f1433'), skyMid: hex('#1f2a5c'), skyHorizon: hex('#3d4a86'),
      sun: hex('#f4f1ff'), sunGlow: hex('#8e9cff'),
      far: hex('#2b3266'), mid: hex('#232955'), near: hex('#1b2046'),
      ground: hex('#171b3a'), groundDeep: hex('#0d1028'),
      road: hex('#11142c'), roadLine: hex('#c9d0ff'),
      foliage: hex('#2c3a6e'), foliage2: hex('#36468a'), trunk: hex('#141834'),
      cloud: hex('#3a4580'), night: 1,
    }),
  },
  {
    name: 'Soft Dawn',
    pal: p({
      skyTop: hex('#7fa7d9'), skyMid: hex('#c3b5e0'), skyHorizon: hex('#ffd1c1'),
      sun: hex('#fff6dc'), sunGlow: hex('#ffc9b0'),
      far: hex('#a9a3cf'), mid: hex('#8f87bd'), near: hex('#776ea6'),
      ground: hex('#645a8f'), groundDeep: hex('#433b6b'),
      road: hex('#37305a'), roadLine: hex('#ffe3cf'),
      foliage: hex('#8fa3c9'), foliage2: hex('#b5a6d6'), trunk: hex('#3b3459'),
      cloud: hex('#ffe4dc'), night: 0.15,
    }),
  },
];

/** Full day cycle length in seconds. */
export const CYCLE_SECONDS = 8 * 60;

/**
 * Golden hour lasts longest — it's the heart of the game.
 * Weights are the share of the cycle each phase holds (incl. its blend out).
 */
const WEIGHTS = [0.4, 0.2, 0.22, 0.18];

export function paletteAt(t: number): { pal: Palette; name: string } {
  const phase = ((t / CYCLE_SECONDS) % 1 + 1) % 1;
  let acc = 0;
  let i = 0;
  for (; i < WEIGHTS.length; i++) {
    if (phase < acc + WEIGHTS[i]) break;
    acc += WEIGHTS[i];
  }
  i = Math.min(i, WEIGHTS.length - 1);
  const local = (phase - acc) / WEIGHTS[i];
  // hold for the first 60% of a phase, then blend into the next
  const blend = local < 0.6 ? 0 : (local - 0.6) / 0.4;
  const s = blend * blend * (3 - 2 * blend);
  const a = KEYS[i].pal;
  const b = KEYS[(i + 1) % KEYS.length].pal;
  const out = {} as Palette;
  for (const k of Object.keys(a) as (keyof Palette)[]) {
    if (k === 'night') continue;
    (out as unknown as Record<string, RGB>)[k] = mix(a[k] as RGB, b[k] as RGB, s);
  }
  out.night = a.night + (b.night - a.night) * s;
  return { pal: out, name: s < 0.5 ? KEYS[i].name : KEYS[(i + 1) % KEYS.length].name };
}
