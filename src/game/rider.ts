import { angleDiff, clamp, damp } from './math';
import { nearbyTrees, T, tileAt, type GameMap } from './map';
import type { BikeStats } from './profile';

export interface Mover {
  x: number;
  y: number;
  r: number;
  onHit?: () => void;
}

export interface Controls {
  pedal: number; // 0..1
  brake: boolean;
  steer: number; // -1..1 (keyboard)
  /** joystick: absolute heading to steer towards, or null */
  aim: number | null;
}

export interface BumpEvent {
  type: 'bump';
  power: number; // impact speed m/s
  x: number;
  y: number;
  person: boolean;
}

const DEFAULT_STATS = { speedMul: 1, offroadMul: 1, grip: 1, capacity: 3, fragileMul: 1, light: 1 };

const TOP: Record<number, number> = {
  [T.ROAD]: 9.5,
  [T.PLAZA]: 8,
  [T.PATH]: 7.5,
  [T.GRASS]: 5.6,
  [T.SAND]: 4.2,
  [T.WATER]: 2,
};

export const RIDER_R = 0.55;

export class Rider {
  x = 0;
  y = 0;
  heading = 0;
  speed = 0;
  steerVis = 0;
  crank = 0;
  wheel = 0;
  pedalling = false;
  braking = false;
  surface: T = T.ROAD;
  bumpCooldown = 0;
  wobble = 0;
  odometer = 0;
  lean = 0;
  stats: BikeStats = DEFAULT_STATS;
  wet = false;

  place(x: number, y: number, heading: number) {
    this.x = x;
    this.y = y;
    this.heading = heading;
    this.speed = 0;
  }

  update(dt: number, c: Controls, map: GameMap, events: BumpEvent[], movers: Mover[] = []) {
    this.surface = tileAt(map, this.x, this.y);
    const st = this.stats;
    const onRoad = this.surface === T.ROAD || this.surface === T.PLAZA;
    const base = TOP[this.surface] ?? 5;
    const top = (onRoad ? base : Math.min(base * st.offroadMul, 9)) * st.speedMul * (this.wet ? 0.95 : 1);
    this.braking = c.brake;
    this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);
    this.wobble = Math.max(0, this.wobble - dt * 2);

    // ---- steering
    let steer = c.steer;
    if (c.aim !== null) steer = clamp(angleDiff(this.heading, c.aim) * 2.2, -1, 1);
    const grip = clamp(0.45 + this.speed / 6, 0.45, 1.1) * st.grip * (this.wet && !onRoad ? 0.85 : 1);
    const turnRate = 2.7 * grip * (this.speed < 0.3 && c.pedal === 0 ? 0.35 : 1);
    this.heading += steer * turnRate * dt;
    this.steerVis += (steer - this.steerVis) * damp(10, dt);
    this.lean += (steer * clamp(this.speed / 7, 0, 1) - this.lean) * damp(6, dt);

    // ---- speed
    this.pedalling = c.pedal > 0 && !c.brake;
    let a = 0;
    if (this.pedalling) a += 4.2 * c.pedal * clamp((top - this.speed) / 2.5, -0.6, 1);
    else if (this.speed > top) a -= (this.speed - top) * 1.5; // off-road slows you down
    if (c.brake) a -= 9;
    a -= 0.25 + 0.012 * this.speed * this.speed;
    this.speed = Math.max(0, this.speed + a * dt);

    // ---- move with collision
    const vx = Math.cos(this.heading) * this.speed;
    const vy = Math.sin(this.heading) * this.speed;
    this.x += vx * dt;
    this.y += vy * dt;
    this.collide(map, vx, vy, events, movers);

    const dist = this.speed * dt;
    this.odometer += dist;
    this.wheel += dist / 0.34;
    if (this.pedalling) this.crank += Math.max(3, this.speed * 1.3) * dt;
  }

  private collide(map: GameMap, vx: number, vy: number, events: BumpEvent[], movers: Mover[]) {
    let hit = false;
    let person: Mover | null = null;
    let nxSum = 0;
    let nySum = 0;
    const push = (nx: number, ny: number, depth: number) => {
      this.x += nx * depth;
      this.y += ny * depth;
      nxSum += nx;
      nySum += ny;
      hit = true;
    };

    // trees: collide with the trunk + lower canopy, so you can brush the leaves
    for (const k of nearbyTrees(map, this.x, this.y)) {
      const t = map.trees[k];
      const rr = t.r * 0.5 + RIDER_R;
      const dx = this.x - t.x;
      const dy = this.y - t.y;
      const d = Math.hypot(dx, dy);
      if (d < rr && d > 1e-4) push(dx / d, dy / d, rr - d);
    }
    for (const m of movers) {
      const rr = m.r + RIDER_R;
      const dx = this.x - m.x;
      const dy = this.y - m.y;
      const d = Math.hypot(dx, dy);
      if (d < rr && d > 1e-4) {
        push(dx / d, dy / d, rr - d);
        person = m;
      }
    }
    for (const p of map.props) {
      if (p.r <= 0) continue;
      const rr = p.r + RIDER_R;
      const dx = this.x - p.x;
      const dy = this.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < rr && d > 1e-4) push(dx / d, dy / d, rr - d);
    }
    // buildings (axis-aligned rectangles)
    for (const b of map.buildings) {
      if (this.x < b.x - 2 || this.x > b.x + b.w + 2 || this.y < b.y - 2 || this.y > b.y + b.h + 2) continue;
      const cx = clamp(this.x, b.x, b.x + b.w);
      const cy = clamp(this.y, b.y, b.y + b.h);
      const dx = this.x - cx;
      const dy = this.y - cy;
      const d = Math.hypot(dx, dy);
      if (d < RIDER_R) {
        if (d > 1e-4) push(dx / d, dy / d, RIDER_R - d);
        else push(0, -1, RIDER_R);
      }
    }
    // water and map edge: sample around the rider
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const px = this.x + Math.cos(a) * RIDER_R;
      const py = this.y + Math.sin(a) * RIDER_R;
      if (tileAt(map, px, py) === T.WATER) push(-Math.cos(a), -Math.sin(a), 0.12);
    }

    if (!hit) return;
    const n = Math.hypot(nxSum, nySum) || 1;
    const nx = nxSum / n;
    const ny = nySum / n;
    const into = -(vx * nx + vy * ny); // speed towards the obstacle
    if (into > 0.2) {
      // slide along the surface, lose some speed, wobble
      const tx = vx + nx * into;
      const ty = vy + ny * into;
      const keep = Math.hypot(tx, ty);
      this.speed = keep * 0.85 + into * 0.1;
      if (keep > 0.3) this.heading = Math.atan2(ty, tx);
      if ((into > 1.8 || (person && into > 0.6)) && this.bumpCooldown <= 0) {
        this.bumpCooldown = 0.5;
        this.wobble = Math.min(1, into / 6);
        (person as Mover | null)?.onHit?.();
        events.push({ type: 'bump', power: into, x: this.x - nx * RIDER_R, y: this.y - ny * RIDER_R, person: !!person });
      }
    }
  }
}
