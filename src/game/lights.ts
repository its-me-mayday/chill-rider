import { TILE } from './map';

/** A junction with traffic lights. The square covers the whole crossing. */
export interface TrafficLight {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  offset: number;
}

export type Signal = 'green' | 'yellow' | 'red';

const GREEN = 7;
const YELLOW = 1.6;
const ALL_RED = 0.8;
export const LIGHT_PERIOD = (GREEN + YELLOW + ALL_RED) * 2;

/** Signal for traffic moving horizontally (h) or vertically (v). */
export function signal(l: TrafficLight, time: number, axis: 'h' | 'v'): Signal {
  const t = (((time + l.offset) % LIGHT_PERIOD) + LIGHT_PERIOD) % LIGHT_PERIOD;
  const half = GREEN + YELLOW + ALL_RED;
  const local = axis === 'h' ? t : (t + half) % LIGHT_PERIOD;
  if (local < GREEN) return 'green';
  if (local < GREEN + YELLOW) return 'yellow';
  return 'red';
}

export function makeLight(c: number, r: number, offset: number): TrafficLight {
  return { x0: c * TILE, y0: r * TILE, x1: (c + 2) * TILE, y1: (r + 2) * TILE, offset };
}
