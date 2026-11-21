import type { Bike, BikeEvent } from './bike';

/**
 * Delivery loop: ride past a Chill Post office to load parcels, then slow
 * down in front of each customer's house to hand them over. Nothing fails —
 * missing a house just moves the meeting point further down the road for a
 * smaller tip, and rough landings dent fragile parcels (and the tip).
 */

export interface Order {
  id: number;
  customer: string;
  item: string;
  fragile: boolean;
  houseX: number;
  houseNo: number;
  color: [number, number, number];
  pickedAt: number;
  eta: number; // seconds for the on-time bonus
  condition: number; // 1 = perfect
  baseTip: number;
  missed: number;
}

export interface Depot {
  x: number;
}

export interface House {
  x: number;
  no: number;
  orderId: number;
  delivered: boolean;
  deliveredAt: number;
  style: number;
}

export type DeliveryEvent =
  | { type: 'pickup'; orders: Order[] }
  | { type: 'delivered'; order: Order; tip: number; onTime: boolean; perfect: boolean }
  | { type: 'missed'; order: Order }
  | { type: 'damaged'; order: Order }
  | { type: 'approach'; order: Order };

const CUSTOMERS = [
  'Nonna Rosa', 'Mr. Okafor', 'the Bakers', 'Lia & Tom', 'Professor Moss', 'Cat Café',
  'Signora Bianchi', 'Kenji', 'the Night Owls', 'Aunt Marta', 'Mrs. Dalloway', 'Leo the painter',
  'Studio Lumen', 'the Rossi twins', 'Old Jack', 'Pip & Fern',
];

const ITEMS: { name: string; fragile: boolean }[] = [
  { name: 'vinyl records', fragile: false },
  { name: 'sourdough starter', fragile: false },
  { name: 'a houseplant', fragile: true },
  { name: 'a teapot', fragile: true },
  { name: 'cassette tapes', fragile: false },
  { name: 'knitting yarn', fragile: false },
  { name: 'a birthday cake', fragile: true },
  { name: 'a telescope', fragile: true },
  { name: 'old postcards', fragile: false },
  { name: 'a ukulele', fragile: true },
  { name: 'tomato seeds', fragile: false },
  { name: 'a lava lamp', fragile: true },
  { name: 'comic books', fragile: false },
  { name: 'fresh lemons', fragile: false },
];

const BOX_COLORS: [number, number, number][] = [
  [214, 168, 112],
  [236, 196, 140],
  [190, 140, 96],
  [244, 214, 170],
];

const DELIVER_SPEED = 3.2; // m/s — roughly 11 km/h
const DELIVER_HOLD = 0.45; // seconds in the zone, slow
export const DROP_ZONE = 3.5; // meters either side of the door
const MISS_AFTER = 7; // meters past the house
const APPROACH = 45;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export class Deliveries {
  depot: Depot | null = { x: 45 };
  orders: Order[] = [];
  houses: House[] = [];
  lastDepotX = -1000;
  tips = 0;
  delivered = 0;
  streak = 0;
  private nextId = 1;
  private hold = 0;
  private approached = new Set<number>();
  private houseNo = 3;

  constructor(saved?: { tips: number; delivered: number }) {
    if (saved) {
      this.tips = saved.tips;
      this.delivered = saved.delivered;
    }
  }

  /** The next house to deliver to (closest ahead). */
  get target(): Order | null {
    let best: Order | null = null;
    for (const o of this.orders) if (!best || o.houseX < best.houseX) best = o;
    return best;
  }

  update(dt: number, bike: Bike, time: number, bikeEvents: BikeEvent[], out: DeliveryEvent[]) {
    // ---- pickup at the post office
    this.houses = this.houses.filter((h) => h.x > bike.x - 120);
    if (this.depot && bike.x >= this.depot.x - 2) {
      const fresh = this.makeOrders(this.depot.x, time);
      this.orders.push(...fresh);
      for (const o of fresh) this.addHouse(o);
      this.lastDepotX = this.depot.x;
      this.depot = null;
      out.push({ type: 'pickup', orders: fresh });
    }

    // ---- rough landings dent fragile parcels
    for (const ev of bikeEvents) {
      if (ev.type !== 'land') continue;
      const hit = !ev.clean ? 0.35 : ev.airtime > 0.7 ? (ev.airtime - 0.7) * 0.4 : 0;
      if (hit <= 0) continue;
      for (const o of this.orders) {
        const dmg = o.fragile ? hit : hit * 0.25;
        if (dmg < 0.02) continue;
        const before = o.condition;
        o.condition = Math.max(0.2, o.condition - dmg);
        if (o.fragile && before - o.condition > 0.05) out.push({ type: 'damaged', order: o });
      }
    }

    const t = this.target;
    if (!t) {
      this.hold = 0;
      // schedule the next post office a little way ahead
      if (!this.depot) this.depot = { x: Math.max(bike.x + 90, 0) + rnd(0, 60) };
      return;
    }

    if (!this.approached.has(t.id) && t.houseX - bike.x < APPROACH && t.houseX > bike.x) {
      this.approached.add(t.id);
      out.push({ type: 'approach', order: t });
    }

    // ---- delivering: be slow and on the ground near the door
    const near = Math.abs(bike.x - t.houseX) < DROP_ZONE;
    if (near && !bike.airborne && bike.displaySpeed < DELIVER_SPEED) {
      this.hold += dt;
      if (this.hold >= DELIVER_HOLD) {
        this.hold = 0;
        this.complete(t, time, out);
      }
    } else {
      this.hold = Math.max(0, this.hold - dt * 2);
    }

    // ---- rode past: they'll meet you further down the road
    if (bike.x > t.houseX + MISS_AFTER) {
      t.missed++;
      t.houseX = bike.x + rnd(110, 200);
      t.houseNo = this.houseNo += 2;
      this.addHouse(t);
      this.approached.delete(t.id);
      this.streak = 0;
      out.push({ type: 'missed', order: t });
    }
  }

  /** 0..1 progress of the hand-over, for the UI ring. */
  get handover() {
    return Math.min(1, this.hold / DELIVER_HOLD);
  }

  private complete(o: Order, time: number, out: DeliveryEvent[]) {
    const elapsed = time - o.pickedAt;
    const onTime = elapsed <= o.eta && o.missed === 0;
    const perfect = o.condition > 0.97;
    let tip = o.baseTip * o.condition * Math.pow(0.7, o.missed);
    if (onTime) tip *= 1.3;
    this.streak++;
    tip *= 1 + Math.min(this.streak - 1, 5) * 0.05;
    tip = Math.round(tip * 100) / 100;
    this.tips = Math.round((this.tips + tip) * 100) / 100;
    this.delivered++;
    this.orders = this.orders.filter((x) => x !== o);
    const h = this.houses.find((hh) => hh.orderId === o.id && Math.abs(hh.x - o.houseX) < 0.01);
    if (h) {
      h.delivered = true;
      h.deliveredAt = time;
    }
    out.push({ type: 'delivered', order: o, tip, onTime, perfect });
  }

  private addHouse(o: Order) {
    this.houses.push({ x: o.houseX, no: o.houseNo, orderId: o.id, delivered: false, deliveredAt: 0, style: Math.floor(Math.random() * 4) });
  }

  /** x positions where random roadside props should not be placed */
  reserved(): number[] {
    const r = this.houses.map((h) => h.x);
    if (this.depot) r.push(this.depot.x);
    r.push(this.lastDepotX);
    return r;
  }

  private makeOrders(fromX: number, time: number): Order[] {
    const n = this.delivered < 2 ? 2 : Math.random() < 0.45 ? 3 : 2;
    const used = new Set(this.orders.map((o) => o.customer));
    const list: Order[] = [];
    let x = fromX + rnd(90, 160);
    for (let i = 0; i < n; i++) {
      let customer = pick(CUSTOMERS);
      for (let k = 0; k < 6 && used.has(customer); k++) customer = pick(CUSTOMERS);
      used.add(customer);
      const item = pick(ITEMS);
      const dist = x - fromX;
      this.houseNo += 2 + Math.floor(Math.random() * 3) * 2;
      list.push({
        id: this.nextId++,
        customer,
        item: item.name,
        fragile: item.fragile,
        houseX: x,
        houseNo: this.houseNo,
        color: pick(BOX_COLORS),
        pickedAt: time,
        eta: dist / 7.5 + 20,
        condition: 1,
        baseTip: Math.round((1.5 + dist / 120 + (item.fragile ? 1.2 : 0)) * 100) / 100,
        missed: 0,
      });
      x += rnd(80, 220);
    }
    return list;
  }
}
