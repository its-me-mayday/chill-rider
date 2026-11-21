import { rng } from './math';
import { SHOPS, type ShopType, type Theme } from './themes';

/** World units are meters, x → right, y → down. The map is a grid of 4 m tiles. */
export const TILE = 4;

export const enum T {
  GRASS = 0,
  ROAD = 1,
  WATER = 2,
  SAND = 3,
  PLAZA = 4,
  PATH = 5,
}

export interface Building {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'house' | 'shop';
  /** point on the wall where the door is */
  doorX: number;
  doorY: number;
  /** outward unit normal of the door wall (towards the street) */
  nx: number;
  ny: number;
  /** where the rider stops to hand over / pick up */
  stopX: number;
  stopY: number;
  no: number;
  street: string;
  style: number;
  shop?: ShopType;
}

export interface Tree {
  x: number;
  y: number;
  r: number;
  kind: number; // 0 round, 1 pine, 2 blossom
  color: number;
}

export interface Lamp {
  x: number;
  y: number;
}

export type PropKind =
  | 'fountain' | 'bench' | 'boat'
  | 'cone' | 'barrier' | 'workSign' | 'bin' | 'pcar' | 'picnic' | 'bale' | 'log' | 'umbrella' | 'sandcastle';

export interface Prop {
  kind: PropKind;
  x: number;
  y: number;
  /** collision radius (0 = not solid) */
  r: number;
  angle: number;
  /** half length of a capsule along `angle` (0 = circle) */
  len?: number;
  color?: string;
}

export interface Spot {
  x: number;
  y: number;
}

export interface GameMap {
  seed: number;
  theme: Theme;
  cols: number;
  rows: number;
  width: number;
  height: number;
  tiles: Uint8Array;
  buildings: Building[];
  trees: Tree[];
  lamps: Lamp[];
  props: Prop[];
  roadRows: number[];
  roadCols: number[];
  spawn: { x: number; y: number; heading: number };
  /** hidden collectibles */
  postcards: Spot[];
  /** potholes in the asphalt: a jolt if you ride over them fast */
  potholes: (Spot & { r: number })[];
  /** pond centres (for ducks) and garden spots (for cats) */
  ponds: (Spot & { r: number })[];
  catSpots: Spot[];
  /** spatial hash of tree indices, 8 m cells */
  treeGrid: Map<number, number[]>;
}

const CELL = 8;

export function tileAt(m: GameMap, x: number, y: number): T {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= m.cols || ty >= m.rows) return T.WATER;
  return m.tiles[ty * m.cols + tx] as T;
}

export function nearbyTrees(m: GameMap, x: number, y: number): number[] {
  const cx = Math.floor(x / CELL);
  const cy = Math.floor(y / CELL);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const l = m.treeGrid.get((cy + dy) * 1000 + cx + dx);
      if (l) out.push(...l);
    }
  return out;
}

// ---------------------------------------------------------------- generation

export function generateMap(theme: Theme, seed: number): GameMap {
  const R = rng(seed);
  const cols = 46;
  const rows = 38;
  const tiles = new Uint8Array(cols * rows);
  const set = (tx: number, ty: number, t: T) => {
    if (tx >= 0 && ty >= 0 && tx < cols && ty < rows) tiles[ty * cols + tx] = t;
  };
  const get = (tx: number, ty: number) =>
    tx >= 0 && ty >= 0 && tx < cols && ty < rows ? (tiles[ty * cols + tx] as T) : T.WATER;

  // ---- sea along the bottom edge (seaside)
  let usableRows = rows;
  if (theme.sea) {
    const seaTop = rows - 7;
    for (let tx = 0; tx < cols; tx++) {
      const wobble = Math.round(Math.sin(tx * 0.35 + seed) * 0.8);
      for (let ty = seaTop + wobble; ty < rows; ty++) set(tx, ty, T.WATER);
      set(tx, seaTop + wobble - 1, T.SAND);
      set(tx, seaTop + wobble - 2, T.SAND);
    }
    usableRows = seaTop - 3;
  }

  // ---- road grid lines (each road is two tiles wide)
  const roadCols: number[] = [];
  for (let c = R.int(2, 4); c < cols - 4; c += R.int(theme.roadGap[0], theme.roadGap[1])) roadCols.push(c);
  const roadRows: number[] = [];
  for (let r = R.int(2, 4); r < usableRows - 3; r += R.int(theme.roadGap[0] - 1, theme.roadGap[1] - 1)) roadRows.push(r);

  // segments between neighbouring intersections
  type Seg = { a: number; b: number; horiz: boolean; i: number; j: number; on: boolean };
  const node = (i: number, j: number) => j * roadCols.length + i;
  const segs: Seg[] = [];
  for (let j = 0; j < roadRows.length; j++)
    for (let i = 0; i < roadCols.length - 1; i++) segs.push({ a: node(i, j), b: node(i + 1, j), horiz: true, i, j, on: true });
  for (let i = 0; i < roadCols.length; i++)
    for (let j = 0; j < roadRows.length - 1; j++) segs.push({ a: node(i, j), b: node(i, j + 1), horiz: false, i, j, on: true });

  const nodes = roadCols.length * roadRows.length;
  const connected = () => {
    const adj: number[][] = Array.from({ length: nodes }, () => []);
    for (const s of segs) if (s.on) {
      adj[s.a].push(s.b);
      adj[s.b].push(s.a);
    }
    const seen = new Uint8Array(nodes);
    const stack = [0];
    seen[0] = 1;
    let count = 1;
    while (stack.length) {
      const n = stack.pop()!;
      for (const k of adj[n]) if (!seen[k]) {
        seen[k] = 1;
        count++;
        stack.push(k);
      }
    }
    return count === nodes;
  };
  // Drop some segments for variety, but never leave a dead end: every
  // junction keeps at least two roads, so streets always lead somewhere.
  const degree = (n: number) => segs.reduce((d, sg) => d + (sg.on && (sg.a === n || sg.b === n) ? 1 : 0), 0);
  const order = segs.map((_, k) => k).sort(() => R.next() - 0.5);
  for (const k of order) {
    if (!R.chance(theme.removeRoads)) continue;
    const sg = segs[k];
    if (degree(sg.a) <= 2 || degree(sg.b) <= 2) continue;
    sg.on = false;
    if (!connected()) sg.on = true;
  }
  // safety net: re-open a road at any junction that still ended up alone
  for (let n = 0; n < nodes; n++) {
    if (degree(n) >= 2) continue;
    const back = segs.find((sg) => !sg.on && (sg.a === n || sg.b === n));
    if (back) back.on = true;
  }

  const paint = (x0: number, y0: number, x1: number, y1: number, t: T) => {
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) set(tx, ty, t);
  };
  for (const s of segs) {
    if (!s.on) continue;
    if (s.horiz) paint(roadCols[s.i], roadRows[s.j], roadCols[s.i + 1] + 1, roadRows[s.j] + 1, T.ROAD);
    else paint(roadCols[s.i], roadRows[s.j], roadCols[s.i] + 1, roadRows[s.j + 1] + 1, T.ROAD);
  }

  // ---- street names
  const names = [...theme.streets].sort(() => R.next() - 0.5);
  const rowName = roadRows.map((_, k) => names[k % names.length]);
  const colName = roadCols.map((_, k) => names[(k + roadRows.length) % names.length]);

  // ---- blocks between roads
  const xs = [-2, ...roadCols, cols];
  const ys = [-2, ...roadRows, usableRows];
  const buildings: Building[] = [];
  const trees: Tree[] = [];
  const props: Prop[] = [];
  const doorPoints: { x: number; y: number }[] = [];
  const ponds: (Spot & { r: number })[] = [];
  const parkSpots: Spot[] = [];
  let bid = 1;

  const overlapsBuilding = (x: number, y: number, w: number, h: number, pad: number) =>
    buildings.some((b) => x < b.x + b.w + pad && x + w > b.x - pad && y < b.y + b.h + pad && y + h > b.y - pad);

  const roadNear = (x: number, y: number, d: number) => {
    for (let a = 0; a < 8; a++) {
      const px = x + Math.cos((a / 8) * Math.PI * 2) * d;
      const py = y + Math.sin((a / 8) * Math.PI * 2) * d;
      const t = get(Math.floor(px / TILE), Math.floor(py / TILE));
      if (t === T.ROAD) return true;
    }
    return get(Math.floor(x / TILE), Math.floor(y / TILE)) === T.ROAD;
  };

  const treeOk = (x: number, y: number, r: number) => {
    const t = get(Math.floor(x / TILE), Math.floor(y / TILE));
    if (t !== T.GRASS && t !== T.SAND) return false;
    if (x < 3 || y < 3 || x > cols * TILE - 3 || y > rows * TILE - 3) return false;
    if (roadNear(x, y, r * 0.6 + 0.6)) return false;
    if (overlapsBuilding(x - r, y - r, r * 2, r * 2, 0.6)) return false;
    for (const d of doorPoints) if (Math.hypot(d.x - x, d.y - y) < r + 3.2) return false;
    for (const o of trees) if (Math.hypot(o.x - x, o.y - y) < (o.r + r) * 0.8) return false;
    for (const p of props) if (Math.hypot(p.x - x, p.y - y) < p.r + r + 1) return false;
    return true;
  };
  const addTree = (x: number, y: number, r: number) => {
    if (!treeOk(x, y, r)) return false;
    const kind = theme.id === 'woods' ? (R.chance(0.6) ? 1 : 0) : R.chance(0.25) ? 2 : R.chance(0.2) ? 1 : 0;
    trees.push({ x, y, r, kind, color: R.int(0, theme.tree.length - 1) });
    return true;
  };

  const segOn = (horiz: boolean, i: number, j: number) =>
    segs.some((s) => s.on && s.horiz === horiz && s.i === i && s.j === j);

  for (let bj = 0; bj < ys.length - 1; bj++) {
    for (let bi = 0; bi < xs.length - 1; bi++) {
      const tx0 = Math.max(0, xs[bi] + 2);
      const tx1 = Math.min(cols, xs[bi + 1]);
      const ty0 = Math.max(0, ys[bj] + 2);
      const ty1 = Math.min(usableRows, ys[bj + 1]);
      if (tx1 - tx0 < 2 || ty1 - ty0 < 2) continue;
      const x0 = tx0 * TILE;
      const x1 = tx1 * TILE;
      const y0 = ty0 * TILE;
      const y1 = ty1 * TILE;
      const ci = bi - 1; // index into roadCols of left boundary
      const rj = bj - 1; // index into roadRows of top boundary

      // which sides face a real, kept road
      const top = rj >= 0 && ci >= 0 && ci + 1 < roadCols.length && segOn(true, ci, rj);
      const bottom = rj + 1 < roadRows.length && ci >= 0 && ci + 1 < roadCols.length && segOn(true, ci, rj + 1);
      const left = ci >= 0 && rj >= 0 && rj + 1 < roadRows.length && segOn(false, ci, rj);
      const right = ci + 1 < roadCols.length && rj >= 0 && rj + 1 < roadRows.length && segOn(false, ci + 1, rj);

      const inner = top || bottom || left || right;
      const w = x1 - x0;
      const h = y1 - y0;

      // plazas in the old town, parks elsewhere
      if (inner && theme.plazas && w > 14 && h > 14 && R.chance(0.22)) {
        paint(tx0, ty0, tx1 - 1, ty1 - 1, T.PLAZA);
        props.push({ kind: 'fountain', x: (x0 + x1) / 2, y: (y0 + y1) / 2, r: 2.6, angle: 0 });
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
          props.push({ kind: 'bench', x: (x0 + x1) / 2 + Math.cos(a) * 6, y: (y0 + y1) / 2 + Math.sin(a) * 6, r: 0.9, angle: a });
        }
        continue;
      }
      const park = !inner || R.chance(theme.parkChance);
      if (park) {
        if (inner && w > 16 && h > 16 && R.chance(0.5)) {
          // pond
          const cx = x0 + w * R.range(0.35, 0.65);
          const cy = y0 + h * R.range(0.35, 0.65);
          const pr = Math.min(w, h) * 0.22;
          ponds.push({ x: cx, y: cy, r: pr });
          for (let ty = ty0; ty < ty1; ty++)
            for (let tx = tx0; tx < tx1; tx++) {
              const d = Math.hypot((tx + 0.5) * TILE - cx, (ty + 0.5) * TILE - cy);
              if (d < pr) set(tx, ty, T.WATER);
            }
        }
        if (inner && R.chance(0.6)) {
          // a dirt shortcut through the park
          const horiz = w > h;
          if (horiz) paint(tx0, Math.floor((ty0 + ty1) / 2), tx1 - 1, Math.floor((ty0 + ty1) / 2), T.PATH);
          else paint(Math.floor((tx0 + tx1) / 2), ty0, Math.floor((tx0 + tx1) / 2), ty1 - 1, T.PATH);
        }
        parkSpots.push({ x: R.range(x0 + 3, x1 - 3), y: R.range(y0 + 3, y1 - 3) });
        const n = Math.round(((w * h) / 70) * theme.treeDensity * (inner ? 1 : 0.8));
        for (let k = 0; k < n * 3 && n > 0; k++) {
          if (trees.length > 700) break;
          addTree(R.range(x0 + 1, x1 - 1), R.range(y0 + 1, y1 - 1), R.range(1.4, 2.4));
        }
        continue;
      }

      // ---- houses along each road-facing side
      const sides: { has: boolean; horiz: boolean; edge: number; out: number; street: string }[] = [
        { has: top, horiz: true, edge: y0, out: -1, street: rj >= 0 ? rowName[rj] : '' },
        { has: bottom, horiz: true, edge: y1, out: 1, street: rj + 1 < roadRows.length ? rowName[rj + 1] : '' },
        { has: left, horiz: false, edge: x0, out: -1, street: ci >= 0 ? colName[ci] : '' },
        { has: right, horiz: false, edge: x1, out: 1, street: ci + 1 < roadCols.length ? colName[ci + 1] : '' },
      ];
      for (const s of sides) {
        if (!s.has) continue;
        const span0 = s.horiz ? x0 : y0;
        const span1 = s.horiz ? x1 : y1;
        let p = span0 + R.range(1, 3);
        while (true) {
          const along = R.range(6.5, 9);
          const depth = R.range(6, 8);
          if (p + along > span1 - 1) break;
          const setback = 1.6;
          if (R.chance(theme.houseChance)) {
            let bx: number, by: number, bw: number, bh: number;
            if (s.horiz) {
              bw = along;
              bh = depth;
              bx = p;
              by = s.out < 0 ? s.edge + setback : s.edge - setback - depth;
            } else {
              bw = depth;
              bh = along;
              by = p;
              bx = s.out < 0 ? s.edge + setback : s.edge - setback - depth;
            }
            if (bx > x0 - 0.1 && by > y0 - 0.1 && bx + bw < x1 + 0.1 && by + bh < y1 + 0.1 && !overlapsBuilding(bx, by, bw, bh, 1.2)) {
              const nx = s.horiz ? 0 : s.out;
              const ny = s.horiz ? s.out : 0;
              const doorX = s.horiz ? bx + bw / 2 : s.out < 0 ? bx : bx + bw;
              const doorY = s.horiz ? (s.out < 0 ? by : by + bh) : by + bh / 2;
              const pos = s.horiz ? doorX : doorY;
              const b: Building = {
                id: bid++,
                x: bx, y: by, w: bw, h: bh,
                kind: 'house',
                doorX, doorY, nx, ny,
                stopX: doorX + nx * 2.2,
                stopY: doorY + ny * 2.2,
                no: Math.floor(pos / 7) * 2 + (s.out < 0 ? 2 : 1),
                street: s.street,
                style: R.int(0, 3),
              };
              buildings.push(b);
              doorPoints.push({ x: b.stopX, y: b.stopY });
            }
          }
          p += along + R.range(1.6, 4);
        }
      }
      // garden trees behind and between houses
      const n = Math.round(((w * h) / 110) * theme.treeDensity);
      for (let k = 0; k < n * 3 && n > 0; k++) addTree(R.range(x0 + 1, x1 - 1), R.range(y0 + 1, y1 - 1), R.range(1.2, 2));
    }
  }

  // ---- street trees on the verges: the obstacles you dodge when cutting corners
  for (const s of segs) {
    if (!s.on || !R.chance(0.55)) continue;
    const side = R.chance(0.5) ? -1 : 1;
    if (s.horiz) {
      const y = side < 0 ? roadRows[s.j] * TILE - 1.9 : (roadRows[s.j] + 2) * TILE + 1.9;
      for (let x = (roadCols[s.i] + 2) * TILE + 3; x < roadCols[s.i + 1] * TILE - 3; x += R.range(7, 12)) addTree(x, y, R.range(1.1, 1.5));
    } else {
      const x = side < 0 ? roadCols[s.i] * TILE - 1.9 : (roadCols[s.i] + 2) * TILE + 1.9;
      for (let y = (roadRows[s.j] + 2) * TILE + 3; y < roadRows[s.j + 1] * TILE - 3; y += R.range(7, 12)) addTree(x, y, R.range(1.1, 1.5));
    }
  }
  // palms / dune grass on the beach
  if (theme.sea) {
    for (let k = 0; k < 40; k++) {
      const tx = R.int(1, cols - 2);
      for (let ty = 0; ty < rows; ty++) {
        if (get(tx, ty) === T.SAND) {
          if (R.chance(0.35)) addTree(tx * TILE + R.range(0.5, 3.5), ty * TILE + 2, R.range(1, 1.4));
          break;
        }
      }
    }
    for (let k = 0; k < 4; k++) props.push({ kind: 'boat', x: R.range(15, cols * TILE - 15), y: (rows - 3) * TILE + R.range(-2, 6), r: 0, angle: R.range(-0.4, 0.4) });
  }

  // ---- shops: spread out over the map
  const houses = buildings.filter((b) => b.kind === 'house');
  const shopCount = Math.min(houses.length > 40 ? 6 : houses.length > 26 ? 5 : 4, houses.length);
  // pizzeria, café and comic shop are in every town; the rest rotate
  const core = SHOPS.filter((s) => s.id === 'pizza' || s.id === 'cafe' || s.id === 'comics').sort(() => R.next() - 0.5);
  const rest = SHOPS.filter((s) => !core.includes(s)).sort(() => R.next() - 0.5);
  const types = [...core, ...rest];
  const chosen: Building[] = [];
  if (houses.length) chosen.push(R.pick(houses));
  while (chosen.length < shopCount) {
    let best: Building | null = null;
    let bestD = -1;
    for (const h of houses) {
      if (chosen.includes(h)) continue;
      const d = Math.min(...chosen.map((c) => Math.hypot(c.x - h.x, c.y - h.y)));
      if (d > bestD) {
        bestD = d;
        best = h;
      }
    }
    if (!best) break;
    chosen.push(best);
  }
  chosen.forEach((b, k) => {
    b.kind = 'shop';
    b.shop = types[k % types.length];
    // shops are a bit wider than houses where the street allows it
    const along = b.nx === 0;
    for (const grow of [3, 2, 1]) {
      const nx = along ? b.x - grow / 2 : b.x;
      const ny = along ? b.y : b.y - grow / 2;
      const nw = along ? b.w + grow : b.w;
      const nh = along ? b.h : b.h + grow;
      const others = buildings.filter((o) => o !== b);
      const clash = others.some((o) => nx < o.x + o.w + 1 && nx + nw > o.x - 1 && ny < o.y + o.h + 1 && ny + nh > o.y - 1);
      const t0 = get(Math.floor(nx / TILE), Math.floor(ny / TILE));
      const t1 = get(Math.floor((nx + nw) / TILE), Math.floor((ny + nh) / TILE));
      if (!clash && t0 !== T.ROAD && t1 !== T.ROAD && t0 !== T.WATER && t1 !== T.WATER) {
        b.x = nx; b.y = ny; b.w = nw; b.h = nh;
        break;
      }
    }
  });
  // shops sit back from the street to leave a paved forecourt for tables, crates and flowers
  for (const b of chosen) {
    const depth = b.nx === 0 ? b.h : b.w;
    const cut = Math.min(1.8, depth - 4.4);
    if (cut <= 0.3) continue;
    if (b.nx === 0) {
      if (b.ny < 0) b.y += cut;
      b.h -= cut;
    } else {
      if (b.nx < 0) b.x += cut;
      b.w -= cut;
    }
    b.doorX -= b.nx * cut;
    b.doorY -= b.ny * cut;
  }
  // trees must not overlap the grown shops
  for (let k = trees.length - 1; k >= 0; k--) {
    const t = trees[k];
    if (chosen.some((b) => t.x > b.x - t.r * 0.6 && t.x < b.x + b.w + t.r * 0.6 && t.y > b.y - t.r * 0.6 && t.y < b.y + b.h + t.r * 0.6)) trees.splice(k, 1);
  }

  // ---- lamps at intersections
  const lamps: Lamp[] = [];
  for (let j = 0; j < roadRows.length; j++)
    for (let i = 0; i < roadCols.length; i++) {
      if (!segs.some((s) => s.on && (s.a === node(i, j) || s.b === node(i, j)))) continue;
      lamps.push({ x: roadCols[i] * TILE - 1.2, y: roadRows[j] * TILE - 1.2 });
    }

  // ---- hidden postcards: tucked away in parks and quiet corners
  const clearSpot = (x: number, y: number) => {
    const t = get(Math.floor(x / TILE), Math.floor(y / TILE));
    if (t === T.WATER || t === T.ROAD) return false;
    if (x < 4 || y < 4 || x > cols * TILE - 4 || y > rows * TILE - 4) return false;
    if (overlapsBuilding(x - 1, y - 1, 2, 2, 1)) return false;
    for (const o of trees) if (Math.hypot(o.x - x, o.y - y) < o.r * 0.5 + 1.5) return false;
    for (const p of props) if (Math.hypot(p.x - x, p.y - y) < p.r + 1.5) return false;
    return true;
  };
  // ---- extra obstacles -------------------------------------------------
  const stops = buildings.map((b) => ({ x: b.stopX, y: b.stopY }));
  const nearStop = (x: number, y: number, d: number) => stops.some((p) => Math.hypot(p.x - x, p.y - y) < d);
  const CAR_COLORS = ['#e86a5a', '#7fc4e6', '#f4c063', '#9fd3c7', '#c9b3f2', '#f6f1e4', '#5a6fb0'];

  // roadworks along the curb of a few streets
  const kept = segs.filter((sg) => sg.on);
  const works = kept.sort(() => R.next() - 0.5);
  const wantWorks = Math.min(4, Math.floor(kept.length / 6) + 2);
  let placedWorks = 0;
  for (const sg of works) {
    if (placedWorks >= wantWorks) break;
    const side = R.chance(0.5) ? -1 : 1;
    if (sg.horiz) {
      const xa = (roadCols[sg.i] + 2) * TILE + 4;
      const xb = roadCols[sg.i + 1] * TILE - 4;
      if (xb - xa < 12) continue;
      const mid = R.range(xa + 6, xb - 6);
      const y = side < 0 ? roadRows[sg.j] * TILE + 0.7 : (roadRows[sg.j] + 2) * TILE - 0.7;
      if (nearStop(mid, y, 9)) continue;
      placedWorks++;
      for (let x = mid - 5; x <= mid + 5; x += 1.7) props.push({ kind: 'cone', x, y, r: 0.28, angle: 0 });
      props.push({ kind: 'barrier', x: mid, y: y + side * -0.2, r: 0.22, angle: 0, len: 1.2 });
      props.push({ kind: 'workSign', x: mid - 7, y, r: 0.35, angle: 0 });
    } else {
      const ya = (roadRows[sg.j] + 2) * TILE + 4;
      const yb = roadRows[sg.j + 1] * TILE - 4;
      if (yb - ya < 12) continue;
      const mid = R.range(ya + 6, yb - 6);
      const x = side < 0 ? roadCols[sg.i] * TILE + 0.7 : (roadCols[sg.i] + 2) * TILE - 0.7;
      if (nearStop(x, mid, 9)) continue;
      placedWorks++;
      for (let y = mid - 5; y <= mid + 5; y += 1.7) props.push({ kind: 'cone', x, y, r: 0.28, angle: 0 });
      props.push({ kind: 'barrier', x: x + side * -0.2, y: mid, r: 0.22, angle: Math.PI / 2, len: 1.2 });
      props.push({ kind: 'workSign', x, y: mid - 7, r: 0.35, angle: 0 });
    }
  }

  const free = (x: number, y: number, r: number) => {
    const t = get(Math.floor(x / TILE), Math.floor(y / TILE));
    if (t === T.WATER || t === T.ROAD) return false;
    if (x < 3 || y < 3 || x > cols * TILE - 3 || y > rows * TILE - 3) return false;
    if (overlapsBuilding(x - r, y - r, r * 2, r * 2, 0.3)) return false;
    if (nearStop(x, y, r + 2.4)) return false;
    for (const o of trees) if (Math.hypot(o.x - x, o.y - y) < o.r * 0.6 + r + 0.6) return false;
    for (const p of props) if (Math.hypot(p.x - x, p.y - y) < p.r + (p.len ?? 0) + r + 0.6) return false;
    return true;
  };

  // bins and parked cars around the houses
  for (const b of buildings) {
    if (b.kind !== 'house') continue;
    const L = b.nx === 0 ? b.w : b.h;
    const tx = -b.ny;
    const ty = b.nx;
    const sideU = R.chance(0.5) ? 1 : -1;
    if (R.chance(0.45)) {
      const u = sideU * (L / 2 - 0.6);
      const x = b.doorX + tx * u + b.nx * 0.7;
      const y = b.doorY + ty * u + b.ny * 0.7;
      if (free(x, y, 0.35)) props.push({ kind: 'bin', x, y, r: 0.35, angle: 0, color: R.pick(['#5a8f6a', '#4b6a9a', '#7a7a8a']) });
    }
    if (R.chance(0.4)) {
      const u = -sideU * (L / 2 + 1.5);
      const x = b.doorX + tx * u - b.nx * 1.0;
      const y = b.doorY + ty * u - b.ny * 1.0;
      const ax = b.nx * 1.15;
      const ay = b.ny * 1.15;
      const ok = [[0, 0], [ax, ay], [-ax, -ay]].every(([ox, oy]) => free(x + ox, y + oy, 1.0)) && !roadNear(x, y, 2.2) && !roadNear(x + ax, y + ay, 1.0);
      if (ok) {
        props.push({ kind: 'pcar', x, y, r: 0.95, angle: Math.atan2(b.ny, b.nx), len: 1.15, color: R.pick(CAR_COLORS) });
      }
    }
  }

  // park furniture, woodland clutter, beach life
  for (const sp of parkSpots) {
    for (let k = 0; k < 3; k++) {
      const x = sp.x + R.range(-8, 8);
      const y = sp.y + R.range(-8, 8);
      if (R.chance(0.5)) {
        if (free(x, y, 1.3)) props.push({ kind: 'picnic', x, y, r: 0.75, angle: R.range(0, Math.PI), len: 0.55 });
      } else if (free(x, y, 1.0)) props.push({ kind: 'bench', x, y, r: 0.45, angle: R.range(0, Math.PI), len: 0.55 });
    }
  }
  if (theme.id === 'woods' || theme.id === 'village') {
    const n = theme.id === 'woods' ? 26 : 10;
    for (let k = 0; k < n * 4 && n > 0; k++) {
      const x = R.range(6, cols * TILE - 6);
      const y = R.range(6, rows * TILE - 6);
      if (!free(x, y, 1.6) || roadNear(x, y, 2)) continue;
      if (R.chance(theme.id === 'woods' ? 0.65 : 0.3)) props.push({ kind: 'log', x, y, r: 0.38, angle: R.range(0, Math.PI), len: 1.1 });
      else props.push({ kind: 'bale', x, y, r: 0.85, angle: 0 });
      if (props.filter((p) => p.kind === 'log' || p.kind === 'bale').length >= n) break;
    }
  }
  if (theme.sea) {
    for (let k = 0; k < 120; k++) {
      const tx = R.int(1, cols - 2);
      const ty = R.int(0, rows - 1);
      if (get(tx, ty) !== T.SAND) continue;
      const x = tx * TILE + R.range(0.5, 3.5);
      const y = ty * TILE + R.range(0.5, 3.5);
      if (!free(x, y, 1.2)) continue;
      if (R.chance(0.6)) props.push({ kind: 'umbrella', x, y, r: 0.25, angle: 0, color: R.pick(['#e4677b', '#7fc4e6', '#f4c063', '#8fd6c8']) });
      else props.push({ kind: 'sandcastle', x, y, r: 0.6, angle: 0 });
      if (props.filter((p) => p.kind === 'umbrella' || p.kind === 'sandcastle').length > 14) break;
    }
  }

  // ---- potholes: worn asphalt, more of them in the old town
  const potholes: (Spot & { r: number })[] = [];
  const wantHoles = theme.id === 'oldtown' ? 26 : theme.id === 'woods' ? 18 : 16;
  for (let k = 0; k < 600 && potholes.length < wantHoles; k++) {
    const tx = R.int(0, cols - 1);
    const ty = R.int(0, rows - 1);
    if (get(tx, ty) !== T.ROAD) continue;
    const x = tx * TILE + R.range(0.9, 3.1);
    const y = ty * TILE + R.range(0.9, 3.1);
    if (nearStop(x, y, 3.5)) continue;
    const home = chosen[0];
    if (home && Math.hypot(x - home.stopX, y - home.stopY) < 14) continue;
    if (props.some((p) => Math.hypot(p.x - x, p.y - y) < 2.5)) continue;
    if (potholes.some((p) => Math.hypot(p.x - x, p.y - y) < 6)) continue;
    potholes.push({ x, y, r: R.range(0.5, 0.85) });
  }

  const postcards: Spot[] = [];
  const candidates = [...parkSpots].sort(() => R.next() - 0.5);
  for (let k = 0; k < 400 && postcards.length < 3; k++) {
    const c = candidates[k] ?? { x: R.range(8, cols * TILE - 8), y: R.range(8, rows * TILE - 8) };
    const x = c.x + (k < candidates.length ? 0 : 0);
    const y = c.y;
    if (!clearSpot(x, y) || roadNear(x, y, 5)) continue;
    if (postcards.some((p) => Math.hypot(p.x - x, p.y - y) < 40)) continue;
    postcards.push({ x, y });
  }
  for (let k = 0; k < 600 && postcards.length < 3; k++) {
    const x = R.range(8, cols * TILE - 8);
    const y = R.range(8, rows * TILE - 8);
    if (clearSpot(x, y) && postcards.every((p) => Math.hypot(p.x - x, p.y - y) > 30)) postcards.push({ x, y });
  }

  // ---- cats nap in gardens
  const catSpots: Spot[] = [];
  for (let k = 0; k < 300 && catSpots.length < 6; k++) {
    const b = buildings[Math.floor(R.next() * buildings.length)];
    if (!b) break;
    const x = b.x + R.range(-2.5, b.w + 2.5);
    const y = b.y + R.range(-2.5, b.h + 2.5);
    if (clearSpot(x, y) && !roadNear(x, y, 1.5)) catSpots.push({ x, y });
  }

  const treeGrid = new Map<number, number[]>();
  trees.forEach((t, k) => {
    const key = Math.floor(t.y / CELL) * 1000 + Math.floor(t.x / CELL);
    const l = treeGrid.get(key);
    if (l) l.push(k);
    else treeGrid.set(key, [k]);
  });

  const first = chosen[0] ?? buildings[0];
  const spawn = first
    ? {
        // on the road in front of the first shop, a few meters along the street
        x: first.stopX + first.nx * 2.5 - first.ny * 7,
        y: first.stopY + first.ny * 2.5 + first.nx * 7,
        heading: Math.atan2(first.nx, -first.ny),
      }
    : { x: roadCols[0] * TILE + 4, y: roadRows[0] * TILE + 4, heading: 0 };

  return {
    seed, theme, cols, rows,
    width: cols * TILE, height: rows * TILE,
    tiles, buildings, trees, lamps, props, roadRows, roadCols, spawn, treeGrid, postcards, ponds, catSpots, potholes,
  };
}
