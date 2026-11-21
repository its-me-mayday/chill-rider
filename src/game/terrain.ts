import { hash } from './math';

/**
 * The road is an infinite, deterministic height function (meters, y up).
 * Rolling sine hills plus occasional "kicker" bumps that send you airborne
 * when you ride over them fast enough.
 */

const KICKER_CELL = 110; // one potential kicker every ~110 m
const START_FLAT = 60; // keep the start flat and gentle

function kickerAt(cell: number) {
  if (cell * KICKER_CELL < START_FLAT + 40) return null;
  const r = hash(cell * 7 + 3);
  if (r < 0.35) return null; // not every cell has one
  const center = cell * KICKER_CELL + 20 + hash(cell * 13 + 1) * 60;
  const height = 0.9 + hash(cell * 17 + 5) * 1.3;
  const width = 3.2 + hash(cell * 23 + 9) * 2.5;
  return { center, height, width };
}

function kickers(x: number): number {
  const cell = Math.floor(x / KICKER_CELL);
  let h = 0;
  for (let c = cell - 1; c <= cell + 1; c++) {
    const k = kickerAt(c);
    if (!k) continue;
    const d = (x - k.center) / k.width;
    h += k.height * Math.exp(-d * d);
  }
  return h;
}

function baseHills(x: number): number {
  const ramp = Math.min(1, Math.max(0, (x - START_FLAT) / 120));
  return (
    ramp *
    (9 * Math.sin(x * 0.0031 + 0.8) +
      4.2 * Math.sin(x * 0.0093 + 2.1) +
      1.6 * Math.sin(x * 0.024 + 0.4) +
      2.2 * Math.sin(x * 0.045 + 2.6) +
      0.35 * Math.sin(x * 0.071 + 1.3))
  );
}

export function groundY(x: number): number {
  return baseHills(x) + kickers(x);
}

const EPS = 0.05;

/** dy/dx */
export function groundSlope(x: number): number {
  return (groundY(x + EPS) - groundY(x - EPS)) / (2 * EPS);
}

/** d²y/dx² */
export function groundCurvature(x: number): number {
  return (groundY(x + EPS) - 2 * groundY(x) + groundY(x - EPS)) / (EPS * EPS);
}

export function groundAngle(x: number): number {
  return Math.atan(groundSlope(x));
}
