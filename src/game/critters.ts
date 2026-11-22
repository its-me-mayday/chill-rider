import { T, TILE, tileAt, type GameMap } from './map';
import { rng } from './math';

/** Townsfolk walking along the roads, dogs on leads, napping cats and pond ducks. */

export interface Walker {
  x: number;
  y: number;
  axis: 'x' | 'y';
  dir: 1 | -1;
  /** lateral position of the lane and the curb side (+1 / -1) */
  lane: number;
  side: 1 | -1;
  speed: number;
  phase: number;
  pause: number;
  aside: number; // >0 while stepping aside after the bell
  offset: number; // current lateral offset (0 = lane, 1 = fully aside)
  bumped: number; // >0 shows a "!" bubble
  happy: number; // >0 shows a note bubble (thanked the bell)
  shirt: string;
  hair: string;
  dog: { x: number; y: number; color: string; wag: number } | null;
  active: boolean;
}

export interface Cat {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  color: string;
  awake: number;
  vx: number;
  vy: number;
}

export interface Duck {
  cx: number;
  cy: number;
  r: number;
  a: number;
  speed: number;
  baby: boolean;
}

const SHIRTS = ['#f4a6a6', '#9fd3c7', '#f6d186', '#b8b5ff', '#ffcfa3', '#a7c7e7', '#e8a0bf'];
const HAIR = ['#4a3428', '#2e2a36', '#c98a5a', '#e9d3a3', '#7a4a3a'];
const DOGS = ['#d9a066', '#f6f1e4', '#5a4a42', '#c9a27a'];
const CATS = ['#f0a25e', '#3b3442', '#e9e2d6', '#9a8f86'];

export const WALKER_R = 0.42;

export class Critters {
  walkers: Walker[] = [];
  cats: Cat[] = [];
  ducks: Duck[] = [];

  constructor(private map: GameMap, count: number) {
    const R = rng(map.seed ^ 0xc0ffee);
    const lines: { axis: 'x' | 'y'; at: number; side: 1 | -1 }[] = [];
    for (const r of map.roadRows) {
      lines.push({ axis: 'x', at: r * TILE + 0.8, side: -1 });
      lines.push({ axis: 'x', at: (r + 2) * TILE - 0.8, side: 1 });
    }
    for (const c of map.roadCols) {
      lines.push({ axis: 'y', at: c * TILE + 0.8, side: -1 });
      lines.push({ axis: 'y', at: (c + 2) * TILE - 0.8, side: 1 });
    }
    for (let k = 0; k < count * 6 && this.walkers.length < count; k++) {
      const l = R.pick(lines);
      const along = R.range(6, (l.axis === 'x' ? map.width : map.height) - 6);
      const x = l.axis === 'x' ? along : l.at;
      const y = l.axis === 'x' ? l.at : along;
      if (tileAt(map, x, y) !== T.ROAD) continue;
      if (Math.hypot(x - map.spawn.x, y - map.spawn.y) < 15) continue;
      const hasDog = R.chance(0.4);
      this.walkers.push({
        x, y, axis: l.axis, dir: R.chance(0.5) ? 1 : -1, lane: l.at, side: l.side,
        speed: R.range(0.9, 1.4), phase: R.range(0, 6), pause: 0, aside: 0, offset: 0, bumped: 0, happy: 0,
        shirt: R.pick(SHIRTS), hair: R.pick(HAIR),
        dog: hasDog ? { x, y, color: R.pick(DOGS), wag: R.range(0, 6) } : null,
        active: true,
      });
    }
    for (const s of map.catSpots) {
      this.cats.push({ x: s.x, y: s.y, homeX: s.x, homeY: s.y, color: R.pick(CATS), awake: 0, vx: 0, vy: 0 });
    }
    for (const p of map.ponds) {
      const n = R.int(2, 4);
      for (let i = 0; i < n; i++) {
        this.ducks.push({ cx: p.x, cy: p.y, r: p.r * R.range(0.35, 0.6), a: R.range(0, 6), speed: R.range(0.15, 0.3) * (R.chance(0.5) ? 1 : -1), baby: i > 0 && R.chance(0.6) });
      }
    }
  }

  /** Ring the bell: nearby walkers step aside. Returns how many reacted. */
  bell(x: number, y: number): number {
    let n = 0;
    for (const w of this.walkers) {
      if (!w.active) continue;
      if (Math.hypot(w.x - x, w.y - y) < 14 && w.aside <= 0) {
        w.aside = 4;
        w.happy = 1.5;
        n++;
      }
    }
    return n;
  }

  /** share of townsfolk out on the street (0..1); people only come and go out of sight */
  setDensity(frac: number, px: number, py: number) {
    const want = Math.max(2, Math.round(this.walkers.length * frac));
    this.walkers.forEach((w, i) => {
      const should = i < want;
      if (w.active !== should && Math.hypot(w.x - px, w.y - py) > 30) w.active = should;
    });
  }

  update(dt: number, riderX: number, riderY: number, riderSpeed: number) {
    const m = this.map;
    for (const w of this.walkers) {
      if (!w.active) continue;
      w.bumped = Math.max(0, w.bumped - dt);
      w.happy = Math.max(0, w.happy - dt);
      w.aside = Math.max(0, w.aside - dt);
      w.offset += ((w.aside > 0 ? 1 : 0) - w.offset) * Math.min(1, dt * 5);
      if (w.pause > 0) {
        w.pause -= dt;
      } else {
        const step = w.speed * dt * w.dir * (w.aside > 0 ? 0.4 : 1);
        const nx = w.axis === 'x' ? w.x + step * 3 : w.x;
        const ny = w.axis === 'y' ? w.y + step * 3 : w.y;
        if (tileAt(m, nx, ny) !== T.ROAD) {
          w.dir = (w.dir * -1) as 1 | -1;
          w.pause = 1 + Math.random() * 2;
        } else {
          if (w.axis === 'x') w.x += step;
          else w.y += step;
          w.phase += dt * w.speed * 6;
          if (Math.random() < dt * 0.04) w.pause = 1.5 + Math.random() * 3;
        }
      }
      // lateral position: lane, or stepped onto the verge
      const lat = w.lane + w.side * w.offset * 1.6;
      if (w.axis === 'x') w.y = lat;
      else w.x = lat;
      if (w.dog) {
        const tx = w.x + (w.axis === 'x' ? w.dir * 1.6 : w.side * 0.3);
        const ty = w.y + (w.axis === 'y' ? w.dir * 1.6 : w.side * 0.3);
        w.dog.x += (tx - w.dog.x) * Math.min(1, dt * 3);
        w.dog.y += (ty - w.dog.y) * Math.min(1, dt * 3);
        w.dog.wag += dt * 14;
      }
    }

    for (const c of this.cats) {
      const d = Math.hypot(c.x - riderX, c.y - riderY);
      if (d < 5 && riderSpeed > 2 && c.awake <= 0) {
        c.awake = 3;
        const a = Math.atan2(c.y - riderY, c.x - riderX);
        c.vx = Math.cos(a) * 4;
        c.vy = Math.sin(a) * 4;
      }
      if (c.awake > 0) {
        c.awake -= dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.vx *= 1 - dt * 1.5;
        c.vy *= 1 - dt * 1.5;
        if (tileAt(m, c.x, c.y) === T.WATER) {
          c.vx *= -1;
          c.vy *= -1;
        }
      } else {
        // wander back home slowly and curl up again
        c.x += (c.homeX - c.x) * dt * 0.15;
        c.y += (c.homeY - c.y) * dt * 0.15;
      }
    }

    for (const d of this.ducks) d.a += d.speed * dt;
  }

  /** Solid circles for the rider to bump into. */
  obstacles(): { x: number; y: number; r: number; w: Walker }[] {
    const out: { x: number; y: number; r: number; w: Walker }[] = [];
    for (const w of this.walkers) {
      if (!w.active || w.offset > 0.6) continue;
      out.push({ x: w.x, y: w.y, r: WALKER_R, w });
      if (w.dog) out.push({ x: w.dog.x, y: w.dog.y, r: 0.35, w });
    }
    return out;
  }
}
