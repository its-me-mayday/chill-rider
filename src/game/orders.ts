import type { Building, GameMap } from './map';
import { rng } from './math';
import type { BumpEvent, Rider } from './rider';

export interface Order {
  id: number;
  shop: Building;
  house: Building;
  item: string;
  fragile: boolean;
  hot: boolean;
  limit: number; // seconds allowed, set when picked up
  deadline: number;
  pickedAt: number;
  condition: number;
  baseTip: number;
  near: boolean;
  late: boolean;
}

export type OrderEvent =
  | { type: 'pickup'; order: Order }
  | { type: 'full' }
  | { type: 'near'; order: Order }
  | { type: 'late'; order: Order }
  | { type: 'delivered'; order: Order; tip: number; onTime: boolean; left: number }
  | { type: 'damaged'; order: Order }
  | { type: 'complete'; stars: number; tips: number; onTime: number; total: number };

export const CAPACITY = 3;
export const MAP_GOAL = 8;
const PICKUP_R = 3.4;
const DROP_R = 3.2;
const SLOW = 3.6;
const HOLD = 0.35;

export class Orders {
  waiting = new Map<number, Order | null>(); // shop building id → order
  private restock = new Map<number, number>();
  carried: Order[] = [];
  delivered = 0;
  onTime = 0;
  mapTips = 0;
  done = false;
  private nextId = 1;
  private hold = 0;
  private holdTarget = 0;
  private R;

  constructor(private map: GameMap) {
    this.R = rng(map.seed ^ 0x5eed);
    for (const b of map.buildings) if (b.kind === 'shop') this.waiting.set(b.id, this.make(b));
  }

  get shops() {
    return this.map.buildings.filter((b) => b.kind === 'shop');
  }

  /** What the rider should head to next. */
  target(rider: Rider): { x: number; y: number; kind: 'house' | 'shop'; order?: Order } | null {
    if (this.carried.length) {
      const o = [...this.carried].sort((a, b) => a.deadline - b.deadline)[0];
      return { x: o.house.stopX, y: o.house.stopY, kind: 'house', order: o };
    }
    let best: Building | null = null;
    let bd = Infinity;
    for (const s of this.shops) {
      if (!this.waiting.get(s.id)) continue;
      const d = Math.hypot(s.stopX - rider.x, s.stopY - rider.y);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best ? { x: best.stopX, y: best.stopY, kind: 'shop' } : null;
  }

  /** hand-over progress 0..1 */
  get progress() {
    return this.hold / HOLD;
  }

  update(dt: number, rider: Rider, time: number, bumps: BumpEvent[], out: OrderEvent[]) {
    if (this.done) return;

    // ---- shops restock
    for (const [id, t] of this.restock) {
      if (time >= t) {
        this.restock.delete(id);
        const shop = this.map.buildings.find((b) => b.id === id)!;
        this.waiting.set(id, this.make(shop));
      }
    }

    // ---- bumps shake the parcels
    for (const b of bumps) {
      for (const o of this.carried) {
        const before = o.condition;
        o.condition = Math.max(0.2, o.condition - b.power * (o.fragile ? 0.07 : 0.015));
        if (o.fragile && before - o.condition > 0.05) out.push({ type: 'damaged', order: o });
      }
    }

    // ---- deadlines
    for (const o of this.carried) {
      if (time > o.deadline && o.deadline > 0 && !o.late) {
        o.late = true;
        out.push({ type: 'late', order: o });
      }
      if (!o.near && Math.hypot(o.house.stopX - rider.x, o.house.stopY - rider.y) < 22) {
        o.near = true;
        out.push({ type: 'near', order: o });
      }
    }

    const slow = rider.speed < SLOW;

    // ---- pick up at shops
    for (const s of this.shops) {
      const o = this.waiting.get(s.id);
      if (!o) continue;
      if (Math.hypot(s.stopX - rider.x, s.stopY - rider.y) > PICKUP_R) continue;
      if (this.carried.length >= CAPACITY) {
        if (this.holdTarget !== -s.id) out.push({ type: 'full' });
        this.holdTarget = -s.id;
        continue;
      }
      if (!slow) continue;
      this.tick(dt, -s.id, () => {
        o.pickedAt = time;
        const d = Math.hypot(o.house.stopX - s.stopX, o.house.stopY - s.stopY);
        o.limit = Math.round(22 + (d * 1.45) / 6.5);
        o.deadline = time + o.limit;
        this.carried.push(o);
        this.waiting.set(s.id, null);
        this.restock.set(s.id, time + this.R.range(4, 9));
        out.push({ type: 'pickup', order: o });
      });
      return;
    }

    // ---- deliver at doors
    for (const o of this.carried) {
      if (Math.hypot(o.house.stopX - rider.x, o.house.stopY - rider.y) > DROP_R || !slow) continue;
      this.tick(dt, o.id, () => {
        const left = o.deadline - time;
        const onTime = left >= 0;
        let tip = o.baseTip * o.condition;
        if (onTime) tip *= 1 + 0.6 * (left / o.limit);
        else tip *= 0.3;
        if (o.hot && onTime && left / o.limit > 0.4) tip += 1;
        tip = Math.round(tip * 100) / 100;
        this.carried = this.carried.filter((c) => c !== o);
        this.delivered++;
        if (onTime) this.onTime++;
        this.mapTips = Math.round((this.mapTips + tip) * 100) / 100;
        out.push({ type: 'delivered', order: o, tip, onTime, left });
        if (this.delivered >= MAP_GOAL) {
          this.done = true;
          const ratio = this.onTime / this.delivered;
          const stars = ratio >= 0.95 ? 3 : ratio >= 0.7 ? 2 : 1;
          out.push({ type: 'complete', stars, tips: this.mapTips, onTime: this.onTime, total: this.delivered });
        }
      });
      return;
    }

    this.hold = Math.max(0, this.hold - dt * 3);
  }

  private tick(dt: number, target: number, done: () => void) {
    if (this.holdTarget !== target) {
      this.holdTarget = target;
      this.hold = 0;
    }
    this.hold += dt;
    if (this.hold >= HOLD) {
      this.hold = 0;
      this.holdTarget = 0;
      done();
    }
  }

  private make(shop: Building): Order {
    const R = this.R;
    const houses = this.map.buildings.filter(
      (b) => b.kind === 'house' && Math.hypot(b.x - shop.x, b.y - shop.y) > 35 && !this.isBusy(b),
    );
    const pool = houses.length ? houses : this.map.buildings.filter((b) => b.kind === 'house');
    const house = R.pick(pool);
    const item = R.pick(shop.shop!.items);
    const d = Math.hypot(house.x - shop.x, house.y - shop.y);
    return {
      id: this.nextId++,
      shop,
      house,
      item: item.name,
      fragile: item.fragile,
      hot: !!item.hot,
      limit: 0,
      deadline: 0,
      pickedAt: 0,
      condition: 1,
      baseTip: Math.round((1.6 + d / 70 + (item.fragile ? 1 : 0)) * 100) / 100,
      near: false,
      late: false,
    };
  }

  private isBusy(b: Building) {
    if (this.carried.some((o) => o.house === b)) return true;
    for (const o of this.waiting.values()) if (o && o.house === b) return true;
    return false;
  }
}
