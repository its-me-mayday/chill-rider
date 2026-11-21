import { clamp, damp } from './math';
import { groundAngle, groundCurvature, groundSlope, groundY } from './terrain';

export interface Controls {
  pedal: boolean;
  brake: boolean;
  /** -1 = lean back, +1 = lean forward */
  lean: number;
  cruise: boolean;
}

export type BikeEvent =
  | { type: 'takeoff' }
  | { type: 'land'; airtime: number; flips: number; clean: boolean };

export const G = 9.81;
export const MAX_PEDAL_SPEED = 13.5; // m/s ≈ 49 km/h on the flat
const PEDAL_FORCE = 3.2; // m/s² at low speed
const PEDAL_POWER = 26; // caps acceleration at high speed (a = P / v)
const BRAKE_DECEL = 7.5;
const ROLL_RESIST = 0.12;
const AIR_DRAG = 0.0045;
const AIR_SPIN = 6.5; // rad/s when leaning in the air

export class Bike {
  x = 0;
  y = groundY(0);
  /** speed along the ground (m/s) while grounded */
  speed = 0;
  vx = 0;
  vy = 0;
  angle = 0; // radians, counter-clockwise, 0 = level
  angVel = 0;
  airborne = false;
  airtime = 0;
  airSpin = 0;
  wheelRot = 0;
  crank = 0;
  pedalling = false;
  braking = false;
  lean = 0; // smoothed rider lean for animation
  wobble = 0; // >0 after a sloppy landing
  distance = 0;
  cruiseSpeed = 0;

  update(dt: number, c: Controls, events: BikeEvent[]) {
    this.lean += (c.lean - this.lean) * damp(10, dt);
    this.braking = c.brake;
    this.wobble = Math.max(0, this.wobble - dt * 1.4);
    if (this.airborne) this.updateAir(dt, c, events);
    else this.updateGround(dt, c, events);

    this.distance = Math.max(this.distance, this.x);
  }

  private updateGround(dt: number, c: Controls, events: BikeEvent[]) {
    const theta = groundAngle(this.x);
    let accel = -G * Math.sin(theta);
    const v = this.speed;

    if (c.cruise && !c.brake) {
      if (this.cruiseSpeed === 0) this.cruiseSpeed = Math.max(4, v);
    } else {
      this.cruiseSpeed = 0;
    }
    const wantsPedal = (c.pedal || (this.cruiseSpeed > 0 && v < this.cruiseSpeed)) && !c.brake;
    this.pedalling = wantsPedal && v < MAX_PEDAL_SPEED + 1;

    if (this.pedalling) {
      const a = Math.min(PEDAL_FORCE, PEDAL_POWER / Math.max(1, v));
      // fade out as we approach top pedalling speed
      accel += a * clamp((MAX_PEDAL_SPEED - v) / 3, 0, 1) + (v < MAX_PEDAL_SPEED ? 0.2 : 0);
    }
    if (c.brake) accel -= Math.sign(v) * BRAKE_DECEL;

    // leaning forward tucks (less drag), leaning back sits up
    const drag = AIR_DRAG * (1 - c.lean * 0.35);
    accel -= Math.sign(v) * (ROLL_RESIST + drag * v * v);

    let next = v + accel * dt;
    if (c.brake && Math.sign(next) !== Math.sign(v)) next = 0;
    if (Math.abs(next) < 0.02 && !this.pedalling && Math.abs(theta) < 0.02) next = 0;
    // a tiny bit of rolling back is fine, but no riding backwards
    this.speed = clamp(next, -3, 30);

    const cos = Math.cos(theta);
    this.x += this.speed * cos * dt;
    this.y = groundY(this.x);
    this.angle = groundAngle(this.x);
    this.angVel = 0;

    this.spin(dt);

    // Take off over crests: needed centripetal accel exceeds gravity
    const slope = groundSlope(this.x);
    const k = -groundCurvature(this.x) / Math.pow(1 + slope * slope, 1.5);
    if (this.speed > 5 && k > 0 && this.speed * this.speed * k > G * Math.cos(theta) * 1.05) {
      this.airborne = true;
      this.airtime = 0;
      this.airSpin = 0;
      this.vx = this.speed * Math.cos(theta);
      this.vy = this.speed * Math.sin(theta) + 0.6;
      this.y += 0.02;
      events.push({ type: 'takeoff' });
    }
  }

  private updateAir(dt: number, c: Controls, events: BikeEvent[]) {
    this.airtime += dt;
    this.vy -= G * dt;
    this.vx -= AIR_DRAG * this.vx * Math.abs(this.vx) * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const target = c.lean * AIR_SPIN * -1; // lean forward = nose down (clockwise)
    this.angVel += (target - this.angVel) * damp(6, dt);
    if (c.lean === 0) {
      // gently self-level towards the trajectory when not leaning
      const travel = Math.atan2(this.vy, this.vx);
      this.angVel += (travel - this.angle) * dt * 2.2;
    }
    this.angle += this.angVel * dt;
    this.airSpin += this.angVel * dt;
    this.pedalling = c.pedal;
    this.spin(dt, 0.4);

    const gy = groundY(this.x);
    if (this.y <= gy) {
      const theta = groundAngle(this.x);
      // project velocity onto the slope
      const along = this.vx * Math.cos(theta) + this.vy * Math.sin(theta);
      const flips = Math.round(Math.abs(this.airSpin) / (Math.PI * 2));
      let rel = (this.angle - theta) % (Math.PI * 2);
      if (rel > Math.PI) rel -= Math.PI * 2;
      if (rel < -Math.PI) rel += Math.PI * 2;
      const clean = Math.abs(rel) < 0.55;

      this.airborne = false;
      this.y = gy;
      this.angle = theta;
      this.speed = clean ? along : along * 0.45;
      if (!clean) this.wobble = 1;
      events.push({ type: 'land', airtime: this.airtime, flips: clean ? flips : 0, clean });
    }
  }

  private spin(dt: number, crankFactor = 1) {
    const v = this.airborne ? Math.hypot(this.vx, this.vy) : this.speed;
    this.wheelRot -= (v / 0.34) * dt;
    // cranks turn with the wheel while pedalling, otherwise freewheel (slow drift)
    if (this.pedalling) this.crank += Math.max(2.5, (v / 0.34) * 0.42) * dt * crankFactor;
  }

  /** speed for display purposes (m/s) */
  get displaySpeed() {
    return this.airborne ? Math.hypot(this.vx, this.vy) : Math.abs(this.speed);
  }
}
