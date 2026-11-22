import type { Building, GameMap } from './map';
import { rng } from './math';
import type { BikeStats } from './profile';
import { isOpen, isService } from './themes';
import type { BumpEvent, Rider } from './rider';

export type OrderKind = 'normal' | 'rush' | 'vip';

export interface Order {
  id: number;
  kind: OrderKind;
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
  customer: string;
  /** guide colour while carried: arrow, doormat, card and minimap dot share it */
  color: [number, number, number];
}

/** Distinct, friendly colours for the deliveries you carry. */
export const GUIDE_COLORS: [number, number, number][] = [
  [255, 209, 102], // butter
  [123, 223, 242], // sky
  [255, 143, 171], // pink
  [168, 230, 140], // mint
  [195, 166, 255], // lilac
];

/** one line of the receipt shown after a delivery */
export interface TipPart {
  label: string;
  amount: number;
}

export type OrderEvent =
  | { type: 'pickup'; order: Order }
  | { type: 'full' }
  | { type: 'near'; order: Order }
  | { type: 'late'; order: Order }
  | { type: 'delivered'; order: Order; tip: number; onTime: boolean; left: number; elapsed: number; streak: number; parts: TipPart[] }
  | { type: 'damaged'; order: Order }
  | { type: 'complete'; stars: number; tips: number; onTime: number; total: number };

export interface OrdersOptions {
  level: number;
  town: number; // how many towns completed — difficulty
  stats: BikeStats;
  rain: boolean;
}

const PICKUP_R = 3.4;
const DROP_R = 3.2;
const SLOW = 3.6;
const HOLD = 0.35;

const NAMES = [
  'Nonna Rosa', 'Mr. Okafor', 'the Bakers', 'Lia & Tom', 'Prof. Moss', 'Kenji', 'Signora Bianchi', 'Aunt Marta',
  'Leo the painter', 'the Rossi twins', 'Old Jack', 'Pip & Fern', 'Dr. Amari', 'Mila', 'Captain Gull', 'Studio Lumen',
];

export class Orders {
  waiting = new Map<number, Order | null>(); // shop building id → order
  private restock = new Map<number, number>();
  carried: Order[] = [];
  delivered = 0;
  onTime = 0;
  mapTips = 0;
  streak = 0;
  done = false;
  goal: number;
  capacity: number;
  private nextId = 1;
  private hold = 0;
  private holdTarget = 0;
  private R;
  private timeMul: number;

  constructor(private map: GameMap, private opt: OrdersOptions) {
    this.R = rng(map.seed ^ 0x5eed);
    this.goal = 8 + Math.min(4, Math.floor(opt.town / 2));
    this.capacity = opt.stats.capacity;
    this.timeMul = Math.max(0.68, 1 - opt.town * 0.035);
    for (const b of map.buildings) if (b.kind === 'shop' && !isService(b.shop)) this.waiting.set(b.id, this.make(b));
  }

  /** houses that customers must not be sent to (quest givers) */
  exclude = new Set<number>();

  get shops() {
    return this.map.buildings.filter((b) => b.kind === 'shop' && !isService(b.shop));
  }

  get streakMul() {
    return 1 + Math.min(this.streak, 5) * 0.1;
  }

  /** What the rider should head to next. */
  /** Carried orders sorted by distance from the rider — nearest first. */
  byDistance(rider: Rider): Order[] {
    const d = (o: Order) => Math.hypot(o.house.stopX - rider.x, o.house.stopY - rider.y);
    return [...this.carried].sort((a, b) => d(a) - d(b));
  }

  target(rider: Rider): { x: number; y: number; kind: 'house' | 'shop'; order?: Order } | null {
    if (this.carried.length) {
      const o = this.byDistance(rider)[0];
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

  get progress() {
    return this.hold / HOLD;
  }

  /** current clock hour, set by the game every frame */
  hour = 9;

  isOpen(shop: Building) {
    return isOpen(shop.shop!, this.hour);
  }

  update(dt: number, rider: Rider, time: number, bumps: BumpEvent[], out: OrderEvent[]) {
    if (this.done) return;

    // opening hours: closed shops drop their waiting order, open ones get one soon
    for (const s of this.shops) {
      const open = this.isOpen(s);
      if (!open) {
        if (this.waiting.get(s.id)) this.waiting.set(s.id, null);
        this.restock.delete(s.id);
      } else if (!this.waiting.get(s.id) && !this.restock.has(s.id)) {
        this.restock.set(s.id, time + this.R.range(1.5, 4));
      }
    }

    for (const [id, t] of this.restock) {
      if (time >= t) {
        this.restock.delete(id);
        const shop = this.map.buildings.find((b) => b.id === id)!;
        this.waiting.set(id, this.make(shop));
      }
    }

    for (const b of bumps) {
      for (const o of this.carried) {
        const before = o.condition;
        const vipMul = o.kind === 'vip' ? 1.5 : 1;
        const dmg = b.power * (o.fragile ? 0.07 * this.opt.stats.fragileMul : 0.015) * vipMul;
        o.condition = Math.max(0.2, o.condition - dmg);
        if ((o.fragile || o.kind === 'vip') && before - o.condition > 0.05) out.push({ type: 'damaged', order: o });
      }
    }

    for (const o of this.carried) {
      if (time > o.deadline && !o.late) {
        o.late = true;
        this.streak = 0;
        out.push({ type: 'late', order: o });
      }
      if (!o.near && Math.hypot(o.house.stopX - rider.x, o.house.stopY - rider.y) < 22) {
        o.near = true;
        out.push({ type: 'near', order: o });
      }
    }

    const slow = rider.speed < SLOW;

    for (const s of this.shops) {
      const o = this.waiting.get(s.id);
      if (!o) continue;
      if (Math.hypot(s.stopX - rider.x, s.stopY - rider.y) > PICKUP_R) continue;
      if (this.carried.length >= this.capacity) {
        if (this.holdTarget !== -s.id) out.push({ type: 'full' });
        this.holdTarget = -s.id;
        continue;
      }
      if (!slow) continue;
      this.tick(dt, -s.id, () => {
        o.pickedAt = time;
        const d = Math.hypot(o.house.stopX - s.stopX, o.house.stopY - s.stopY);
        let limit = (22 + (d * 1.45) / 6.5) * this.timeMul;
        if (o.kind === 'rush') limit *= 0.62;
        o.limit = Math.round(limit);
        o.deadline = time + o.limit;
        const used = new Set(this.carried.map((c) => c.color));
        o.color = GUIDE_COLORS.find((c) => !used.has(c)) ?? GUIDE_COLORS[o.id % GUIDE_COLORS.length];
        this.carried.push(o);
        this.waiting.set(s.id, null);
        // late-night pizza is the busiest thing in town
        const nightRush = s.shop!.id === 'pizza' && (this.hour >= 19 || this.hour < 2) ? 0.55 : 1;
        const fast = (this.opt.level >= 5 ? 0.6 : 1) * nightRush;
        this.restock.set(s.id, time + this.R.range(4, 9) * fast);
        out.push({ type: 'pickup', order: o });
      });
      return;
    }

    for (const o of this.carried) {
      if (Math.hypot(o.house.stopX - rider.x, o.house.stopY - rider.y) > DROP_R || !slow) continue;
      this.tick(dt, o.id, () => this.complete(o, time, out));
      return;
    }

    this.hold = Math.max(0, this.hold - dt * 3);
  }

  private complete(o: Order, time: number, out: OrderEvent[]) {
    const left = o.deadline - time;
    const onTime = left >= 0;
    if (onTime) this.streak++;
    else this.streak = 0;
    // build the receipt line by line so the delivery card can show it
    const parts: TipPart[] = [];
    const r2 = (v: number) => Math.round(v * 100) / 100;
    let tip = o.baseTip;
    parts.push({ label: o.kind === 'vip' ? 'VIP fare' : o.kind === 'rush' ? 'Rush fare' : 'Delivery fare', amount: r2(tip) });
    if (o.condition < 0.99) {
      const loss = tip * (1 - o.condition);
      tip -= loss;
      parts.push({ label: `Damaged (${Math.round(o.condition * 100)}%)`, amount: -r2(loss) });
    }
    if (onTime) {
      const speed = tip * 0.6 * (left / o.limit);
      tip += speed;
      if (speed >= 0.01) parts.push({ label: 'Speedy bonus', amount: r2(speed) });
    } else {
      const late = tip * 0.7;
      tip -= late;
      parts.push({ label: 'Late', amount: -r2(late) });
    }
    const hm = this.opt.stats.hotMul ?? 1;
    if (o.hot && onTime && left / o.limit > 0.4 / hm) {
      const hot = 1 + (hm - 1) * 1.2;
      tip += hot;
      parts.push({ label: 'Still hot!', amount: r2(hot) });
    }
    const mul = (label: string, m: number) => {
      if (Math.abs(m - 1) < 0.001) return;
      const extra = tip * (m - 1);
      tip += extra;
      parts.push({ label, amount: r2(extra) });
    };
    if (onTime) mul(`Streak ×${this.streakMul.toFixed(1)}`, this.streakMul);
    if (this.opt.rain) mul('Rainy day', this.opt.level >= 7 ? 1.4 : 1.2);
    mul('Bell charm', this.opt.stats.tipMul ?? 1);
    tip = r2(tip);
    this.carried = this.carried.filter((c) => c !== o);
    this.delivered++;
    if (onTime) this.onTime++;
    this.mapTips = Math.round((this.mapTips + tip) * 100) / 100;
    out.push({ type: 'delivered', order: o, tip, onTime, left, elapsed: time - o.pickedAt, streak: this.streak, parts });
    if (this.delivered >= this.goal) {
      this.done = true;
      const ratio = this.onTime / this.delivered;
      const stars = ratio >= 0.95 ? 3 : ratio >= 0.7 ? 2 : 1;
      out.push({ type: 'complete', stars, tips: this.mapTips, onTime: this.onTime, total: this.delivered });
    }
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
      (b) => b.kind === 'house' && Math.hypot(b.x - shop.x, b.y - shop.y) > 35 && !this.isBusy(b) && !this.exclude.has(b.id),
    );
    const pool = houses.length ? houses : this.map.buildings.filter((b) => b.kind === 'house');
    const house = R.pick(pool);
    const item = R.pick(shop.shop!.items);
    const d = Math.hypot(house.x - shop.x, house.y - shop.y);
    let kind: OrderKind = 'normal';
    if (this.opt.level >= 3 && R.chance(0.15)) kind = 'vip';
    else if (this.opt.level >= 2 && R.chance(0.22)) kind = 'rush';
    let baseTip = 1.6 + d / 70 + (item.fragile ? 1 : 0);
    if (kind === 'rush') baseTip *= 1.8;
    if (kind === 'vip') baseTip *= 2;
    return {
      id: this.nextId++,
      kind,
      shop,
      house,
      item: item.name,
      fragile: item.fragile,
      hot: !!item.hot,
      limit: 0,
      deadline: 0,
      pickedAt: 0,
      condition: 1,
      baseTip: Math.round(baseTip * 100) / 100,
      near: false,
      late: false,
      customer: R.pick(NAMES),
      color: GUIDE_COLORS[0],
    };
  }

  private isBusy(b: Building) {
    if (this.carried.some((o) => o.house === b)) return true;
    for (const o of this.waiting.values()) if (o && o.house === b) return true;
    return false;
  }
}
