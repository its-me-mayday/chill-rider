import { angleDiff, clamp, damp } from './math';
import { nearbyTrees, T, tileAt, type GameMap } from './map';
import type { BikeStats } from './profile';

export interface Mover {
  x: number;
  y: number;
  r: number;
  /** capsule half-length along `angle` */
  len?: number;
  angle?: number;
  kind?: 'person' | 'car' | 'rider';
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
  type: 'bump' | 'slip';
  power: number; // impact speed m/s
  x: number;
  y: number;
  person: boolean;
  what: 'obstacle' | 'person' | 'car' | 'rider' | 'ground' | 'pothole';
}

export type Mood = 'happy' | 'focused' | 'dizzy' | 'hurt' | 'fallen' | 'tired' | 'resting';

const DEFAULT_STATS = { speedMul: 1, offroadMul: 1, grip: 1, capacity: 3, fragileMul: 1, light: 1 };

const TOP: Record<number, number> = {
  [T.ROAD]: 9.5,
  [T.BIKE]: 10.3,
  [T.CLOSED]: 8.5,
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
  /** 0..100 — bruises from bumps and falls; heals while resting */
  health = 100;
  dizzy = 0; // seconds of seeing stars after a knock
  fallen = 0; // seconds lying on the ground after a slip
  fallAngle = 0;
  hurtFlash = 0; // drives the portrait shake
  private slipRisk = 0;
  resting = false; // set by the game while recovering at a café
  private lastHole = -1;

  get mood(): Mood {
    if (this.fallen > 0) return 'fallen';
    if (this.dizzy > 0) return 'dizzy';
    if (this.resting && this.health < 100) return 'resting';
    if (this.health < 35) return 'hurt';
    if (this.health < 65) return 'tired';
    if (this.speed > 7) return 'focused';
    return 'happy';
  }

  hurt(amount: number) {
    this.health = Math.max(5, this.health - amount);
    this.hurtFlash = 0.6;
  }

  place(x: number, y: number, heading: number) {
    this.x = x;
    this.y = y;
    this.heading = heading;
    this.speed = 0;
  }

  update(dt: number, c: Controls, map: GameMap, events: BumpEvent[], movers: Mover[] = []) {
    this.surface = tileAt(map, this.x, this.y);
    const st = this.stats;
    const onRoad = this.surface === T.ROAD || this.surface === T.PLAZA || this.surface === T.CLOSED || this.surface === T.BIKE;
    const base = TOP[this.surface] ?? 5;
    const hurtMul = this.health < 35 ? 0.85 : 1;
    const top = (onRoad ? base : Math.min(base * st.offroadMul, 9)) * st.speedMul * (this.wet ? 0.95 : 1) * hurtMul;
    this.braking = c.brake;
    this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);
    this.wobble = Math.max(0, this.wobble - dt * 2);
    this.dizzy = Math.max(0, this.dizzy - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);

    // healing: fast while resting, slow while cruising gently
    const heal = this.resting ? 14 : this.speed < 0.5 ? 1.6 : this.speed < 6 ? 0.45 : 0.15;
    this.health = Math.min(100, this.health + heal * dt);

    // lying on the ground after a slip: no control until we get back up
    if (this.fallen > 0) {
      this.fallen -= dt;
      this.speed = Math.max(0, this.speed - 12 * dt);
      this.x += Math.cos(this.heading) * this.speed * dt;
      this.y += Math.sin(this.heading) * this.speed * dt;
      if (this.fallen <= 0) this.dizzy = Math.max(this.dizzy, 0.8);
      return;
    }
    if (this.dizzy > 0) {
      // seeing stars: steering wanders a little
      c = { ...c, steer: c.steer + Math.sin(this.dizzy * 9) * 0.35 };
    }

    // ---- steering
    let steer = c.steer;
    if (c.aim !== null) steer = clamp(angleDiff(this.heading, c.aim) * 2.2, -1, 1);
    const grip = clamp(0.45 + this.speed / 6, 0.45, 1.1) * st.grip * (this.wet && !onRoad ? 0.85 : 1);
    const turnRate = 2.7 * grip * (this.speed < 0.3 && c.pedal === 0 ? 0.35 : 1);
    this.heading += steer * turnRate * dt;
    this.steerVis += (steer - this.steerVis) * damp(10, dt);
    this.lean += (steer * clamp(this.speed / 7, 0, 1) - this.lean) * damp(6, dt);

    // slipping: sharp turns at speed on wet grass, sand or gravel paths
    const slippery = this.surface === T.SAND || (this.wet && !onRoad) || (this.wet && this.surface === T.PLAZA) || this.surface === T.PATH;
    const risk = slippery && this.speed > 5.2 && Math.abs(steer) > 0.75 ? (this.speed - 5) * Math.abs(steer) * (this.surface === T.SAND ? 1.3 : 1) / st.grip : 0;
    this.slipRisk = risk > 0 ? this.slipRisk + risk * dt : Math.max(0, this.slipRisk - dt * 2);
    if (this.slipRisk > 2.2) {
      this.slipRisk = 0;
      this.fallen = 1.3;
      this.fallAngle = steer > 0 ? 1 : -1;
      const power = this.speed;
      this.speed *= 0.45;
      this.heading += steer * 0.5;
      this.hurt(6 + power * 1.2);
      events.push({ type: 'slip', power, x: this.x, y: this.y, person: false, what: 'ground' });
      return;
    }

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
    this.potholes(map, events);

    const dist = this.speed * dt;
    this.odometer += dist;
    this.wheel += dist / 0.34;
    if (this.pedalling) this.crank += Math.max(3, this.speed * 1.3) * dt;
  }

  /** riding through a pothole jolts the bike: small hurt, a wobble and lost speed */
  private potholes(map: GameMap, events: BumpEvent[]) {
    let inside = -1;
    for (let k = 0; k < map.potholes.length; k++) {
      const h = map.potholes[k];
      if (Math.abs(h.x - this.x) > 1.5 || Math.abs(h.y - this.y) > 1.5) continue;
      if (Math.hypot(h.x - this.x, h.y - this.y) < h.r + 0.15) {
        inside = k;
        break;
      }
    }
    if (inside === -1) {
      this.lastHole = -1;
      return;
    }
    if (inside === this.lastHole) return;
    this.lastHole = inside;
    if (this.speed < 2.2) return;
    const power = this.speed * 0.45;
    this.speed *= 0.78;
    this.wobble = Math.min(1, 0.4 + this.speed / 12);
    this.hurt(1.5 + this.speed * 0.35);
    const h = map.potholes[inside];
    events.push({ type: 'bump', power, x: h.x, y: h.y, person: false, what: 'pothole' });
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
      let mx = m.x;
      let my = m.y;
      if (m.len && m.angle !== undefined) {
        const ax = Math.cos(m.angle);
        const ay = Math.sin(m.angle);
        const t = clamp((this.x - m.x) * ax + (this.y - m.y) * ay, -m.len, m.len);
        mx = m.x + ax * t;
        my = m.y + ay * t;
      }
      if (Math.abs(this.x - mx) > rr || Math.abs(this.y - my) > rr) continue;
      const dx = this.x - mx;
      const dy = this.y - my;
      const d = Math.hypot(dx, dy);
      if (d < rr && d > 1e-4) {
        push(dx / d, dy / d, rr - d);
        person = m;
      }
    }
    for (const p of map.props) {
      if (p.r <= 0) continue;
      const len = p.len ?? 0;
      if (Math.abs(this.x - p.x) > p.r + len + 2 || Math.abs(this.y - p.y) > p.r + len + 2) continue;
      // capsule: closest point on the segment, then a circle test
      let cx = p.x;
      let cy = p.y;
      if (len > 0) {
        const ax = Math.cos(p.angle);
        const ay = Math.sin(p.angle);
        const t = clamp((this.x - p.x) * ax + (this.y - p.y) * ay, -len, len);
        cx = p.x + ax * t;
        cy = p.y + ay * t;
      }
      const rr = p.r + RIDER_R;
      const dx = this.x - cx;
      const dy = this.y - cy;
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
    // landmarks: walls, towers and the column in the square
    for (const l of map.landmarks) {
      if (this.x < l.x - 4 || this.x > l.x + l.w + 4 || this.y < l.y - 4 || this.y > l.y + l.h + 4) continue;
      for (const b of l.solids) {
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
      for (const c of l.circles) {
        const dx = this.x - c.x;
        const dy = this.y - c.y;
        const d = Math.hypot(dx, dy);
        if (d < c.r + RIDER_R && d > 1e-4) push(dx / d, dy / d, c.r + RIDER_R - d);
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
      const car = (person as Mover | null)?.kind === 'car';
      if ((into > 1.8 || (person && into > 0.6) || car) && this.bumpCooldown <= 0) {
        this.bumpCooldown = 0.5;
        this.wobble = Math.min(1, into / 6);
        (person as Mover | null)?.onHit?.();
        const pm = person as Mover | null;
        const what = pm ? (pm.kind ?? 'person') : 'obstacle';
        const dmg = what === 'car' ? 12 + into * 2.5 : what === 'rider' ? 2 + into : pm ? 3 + into : into * 3.2;
        this.hurt(dmg);
        if (into > 3 || what === 'car') this.dizzy = Math.min(2.2, 0.6 + into * 0.18 + (what === 'car' ? 0.8 : 0));
        events.push({ type: 'bump', power: what === 'car' ? into + 3 : into, x: this.x - nx * RIDER_R, y: this.y - ny * RIDER_R, person: !!pm, what });
      }
    }
  }
}
