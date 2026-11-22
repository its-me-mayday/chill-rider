import { T, TILE, type GameMap } from './map';
import { rng } from './math';

/**
 * Cars and other chill riders driving on the right through the road grid.
 * Each vehicle follows its lane, picks a new direction at every junction,
 * keeps its distance and slows down for the player.
 */

type Dir = 0 | 1 | 2 | 3; // E S W N
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

export interface Vehicle {
  kind: 'car' | 'van' | 'rider';
  x: number;
  y: number;
  dir: Dir;
  line: number; // row (E/W) or column (N/S) in tiles
  heading: number;
  speed: number;
  max: number;
  color: string;
  color2: string;
  half: number; // half length (m)
  width: number;
  pending: { dir: Dir; at: number } | null;
  node: number;
  stopped: number; // seconds waiting after a crash
  honk: number;
  wave: number;
  braking: boolean;
  // drawing state for the rider sprite
  crank: number;
  wheel: number;
  steerVis: number;
  lean: number;
  wobble: number;
  beanie: string;
  scarf: string;
  frame: string;
  parcel: boolean;
}

export type TrafficEvent = { type: 'honk'; v: Vehicle } | { type: 'ring'; v: Vehicle } | { type: 'hit'; v: Vehicle; power: number } | { type: 'wave'; v: Vehicle };

const CAR_COLORS = ['#e86a5a', '#7fc4e6', '#f4c063', '#9fd3c7', '#c9b3f2', '#f6f1e4', '#5a6fb0', '#f3a6bd'];
const VAN_COLORS = ['#f6f1e4', '#d9e8f0', '#ffe3a8'];
const OUTFITS = ['#ff8fab', '#7bdff2', '#b8f2a0', '#c3a6ff', '#ffd166', '#f6f1e4', '#ff9a76'];

/** lane offset from the road's first tile edge, in meters (roads are 8 m wide) */
function laneOffset(kind: Vehicle['kind'], dir: Dir) {
  const rightSide = dir === 0 || dir === 3; // E and N drive on the high side
  const inset = kind === 'rider' ? 1.4 : 2.45;
  return rightSide ? 8 - inset : inset;
}

export class Traffic {
  vehicles: Vehicle[] = [];
  private nodeAt = new Map<number, { c: number; r: number; id: number }>();

  constructor(private map: GameMap, cars: number, riders: number, avoid: { x: number; y: number }) {
    const R = rng(map.seed ^ 0x7aff1c);
    let id = 1;
    for (const r of map.roadRows)
      for (const c of map.roadCols) {
        if (this.tile(c, r) !== T.ROAD) continue;
        const node = { c, r, id: id++ };
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) this.nodeAt.set((r + dy) * 1000 + c + dx, node);
      }

    const spawn = (kind: Vehicle['kind']) => {
      for (let k = 0; k < 60; k++) {
        const horiz = R.chance(0.5);
        const line = horiz ? R.pick(map.roadRows) : R.pick(map.roadCols);
        const dir: Dir = horiz ? (R.chance(0.5) ? 0 : 2) : R.chance(0.5) ? 1 : 3;
        const along = R.range(6, (horiz ? map.width : map.height) - 6);
        const x = horiz ? along : line * TILE + laneOffset(kind, dir);
        const y = horiz ? line * TILE + laneOffset(kind, dir) : along;
        if (this.tile(Math.floor(x / TILE), Math.floor(y / TILE)) !== T.ROAD) continue;
        if (this.nodeAt.has(Math.floor(y / TILE) * 1000 + Math.floor(x / TILE))) continue;
        if (Math.hypot(x - avoid.x, y - avoid.y) < 25) continue;
        if (this.vehicles.some((v) => Math.hypot(v.x - x, v.y - y) < 10)) continue;
        const isRider = kind === 'rider';
        this.vehicles.push({
          kind, x, y, dir, line, heading: Math.atan2(DY[dir], DX[dir]),
          speed: 0, max: isRider ? R.range(4.2, 6) : kind === 'van' ? R.range(6, 7.5) : R.range(7, 9),
          color: kind === 'van' ? R.pick(VAN_COLORS) : R.pick(CAR_COLORS),
          color2: R.pick(CAR_COLORS),
          half: isRider ? 0.85 : kind === 'van' ? 2.5 : 2.1,
          width: isRider ? 0.6 : kind === 'van' ? 2.0 : 1.85,
          pending: null, node: 0, stopped: 0, honk: 0, wave: 0, braking: false,
          crank: R.range(0, 6), wheel: 0, steerVis: 0, lean: 0, wobble: 0,
          beanie: R.pick(OUTFITS), scarf: R.pick(OUTFITS), frame: R.pick(OUTFITS), parcel: R.chance(0.4),
        });
        return;
      }
    };
    for (let i = 0; i < cars; i++) spawn(R.chance(0.25) ? 'van' : 'car');
    for (let i = 0; i < riders; i++) spawn('rider');
  }

  private tile(tx: number, ty: number) {
    const m = this.map;
    if (tx < 0 || ty < 0 || tx >= m.cols || ty >= m.rows) return T.GRASS;
    return m.tiles[ty * m.cols + tx] as T;
  }

  private exits(c: number, r: number): Dir[] {
    const out: Dir[] = [];
    if (this.tile(c + 2, r) === T.ROAD) out.push(0);
    if (this.tile(c, r + 2) === T.ROAD) out.push(1);
    if (this.tile(c - 1, r) === T.ROAD) out.push(2);
    if (this.tile(c, r - 1) === T.ROAD) out.push(3);
    return out;
  }

  /** Solid shapes for the player's collision. */
  movers() {
    return this.vehicles.map((v) => ({
      x: v.x, y: v.y, r: v.width / 2, len: Math.max(0, v.half - v.width / 2), angle: v.heading,
      kind: v.kind === 'rider' ? ('rider' as const) : ('car' as const), v,
    }));
  }

  update(dt: number, px: number, py: number, pspeed: number, out: TrafficEvent[]) {
    for (const v of this.vehicles) {
      v.honk = Math.max(0, v.honk - dt);
      v.wave = Math.max(0, v.wave - dt);
      if (v.stopped > 0) {
        v.stopped -= dt;
        v.speed = Math.max(0, v.speed - 12 * dt);
        continue;
      }
      const dx = DX[v.dir];
      const dy = DY[v.dir];

      // ---- what's ahead in my lane?
      let limit = v.max;
      for (const o of this.vehicles) {
        if (o === v) continue;
        const ax = (o.x - v.x) * dx + (o.y - v.y) * dy;
        const lat = Math.abs((o.x - v.x) * -dy + (o.y - v.y) * dx);
        if (ax > 0 && ax < 14 && lat < 1.6) limit = Math.min(limit, Math.max(0, (ax - v.half - o.half - 1.5) * 1.1));
      }
      const pax = (px - v.x) * dx + (py - v.y) * dy;
      const plat = Math.abs((px - v.x) * -dy + (py - v.y) * dx);
      if (pax > 0 && pax < 11 && plat < v.width / 2 + 1.1) {
        limit = Math.min(limit, Math.max(0, (pax - v.half - 1.6) * 1.2));
        if (pax < 8 && v.honk <= 0) {
          v.honk = 4;
          out.push(v.kind === 'rider' ? { type: 'ring', v } : { type: 'honk', v });
        }
      }
      // friendly wave when the player rides by
      if (v.kind === 'rider' && v.wave <= 0 && Math.hypot(px - v.x, py - v.y) < 4 && pspeed > 1) {
        v.wave = 6;
        out.push({ type: 'wave', v });
      }

      const prev = v.speed;
      const acc = v.speed < limit ? (v.kind === 'rider' ? 1.6 : 2.6) : -9;
      v.speed = Math.max(0, Math.min(v.max, v.speed + acc * dt));
      if (v.speed > limit && acc > 0) v.speed = limit;
      v.braking = v.speed < prev - 0.05 || limit < 0.5;

      // ---- move along the lane
      v.x += dx * v.speed * dt;
      v.y += dy * v.speed * dt;
      // keep the lateral position on the lane centre
      const laneCoord = v.line * TILE + laneOffset(v.kind, v.dir);
      if (dx !== 0) v.y += (laneCoord - v.y) * Math.min(1, dt * 3);
      else v.x += (laneCoord - v.x) * Math.min(1, dt * 3);

      // ---- junctions
      const tx = Math.floor(v.x / TILE);
      const ty = Math.floor(v.y / TILE);
      const node = this.nodeAt.get(ty * 1000 + tx);
      if (node && node.id !== v.node && !v.pending) {
        v.node = node.id;
        const back = ((v.dir + 2) % 4) as Dir;
        let opts = this.exits(node.c, node.r).filter((d) => d !== back);
        if (!opts.length) opts = [back];
        const straight = opts.includes(v.dir) && Math.random() < 0.5;
        const nd = straight ? v.dir : opts[Math.floor(Math.random() * opts.length)];
        if (nd !== v.dir) {
          // turn once we reach the new lane's line inside the junction
          const nLine = nd === 0 || nd === 2 ? node.r : node.c;
          const at = nLine * TILE + laneOffset(v.kind, nd);
          v.pending = { dir: nd, at };
        }
      }
      if (!node) v.node = 0;
      if (v.pending) {
        const p = v.pending;
        const coord = dx !== 0 ? v.x : v.y;
        const dirSign = dx !== 0 ? dx : dy;
        const passed = dirSign > 0 ? coord >= p.at : coord <= p.at;
        const uTurn = p.dir === (v.dir + 2) % 4;
        if (passed || uTurn) {
          const n = this.nodeAt.get(Math.floor(v.y / TILE) * 1000 + Math.floor(v.x / TILE));
          v.dir = p.dir;
          v.line = p.dir === 0 || p.dir === 2 ? (n ? n.r : v.line) : n ? n.c : v.line;
          v.pending = null;
          v.speed *= v.kind === 'rider' ? 0.8 : 0.6;
        }
      }
      // leaving the road by mistake: turn around
      if (this.tile(Math.floor((v.x + DX[v.dir] * (v.half + 0.5)) / TILE), Math.floor((v.y + DY[v.dir] * (v.half + 0.5)) / TILE)) !== T.ROAD && !v.pending) {
        v.dir = ((v.dir + 2) % 4) as Dir;
        v.speed = 0;
      }

      // smooth visual heading
      const target = Math.atan2(DY[v.dir], DX[v.dir]);
      let d = target - v.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      v.heading += d * Math.min(1, dt * 7);
      v.steerVis = Math.max(-1, Math.min(1, d * 2));
      v.lean = v.steerVis * 0.6;
      if (v.kind === 'rider') {
        v.crank += v.speed * 1.3 * dt;
        v.wheel += (v.speed * dt) / 0.34;
      }

      // ---- did I hit the player?
      if (v.kind !== 'rider' && v.speed > 2) {
        const ax = Math.cos(v.heading);
        const ay = Math.sin(v.heading);
        const t = Math.max(-v.half, Math.min(v.half, (px - v.x) * ax + (py - v.y) * ay));
        const cx = v.x + ax * t;
        const cy = v.y + ay * t;
        if (Math.hypot(px - cx, py - cy) < v.width / 2 + 0.6) {
          out.push({ type: 'hit', v, power: v.speed });
          v.stopped = 2.5;
          v.honk = 4;
        }
      }
    }
  }
}
