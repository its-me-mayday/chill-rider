import { T, TILE, tileAt, type Building, type GameMap, type Spot } from './map';
import { rng } from './math';
import { isOpen, isService } from './themes';

/**
 * Side quests handed out by townsfolk waiting at their front door.
 * Each quest is a short chain of steps; the current step has a place to go.
 */

export type QuestKind = 'lost' | 'letter' | 'errand' | 'tour';
export type QuestState = 'available' | 'active' | 'done';

export interface QuestStep {
  text: string;
  x: number;
  y: number;
  /** ring you have to ride through (tour), otherwise stop there */
  ring?: boolean;
  /** shop that must be open for this step */
  shop?: Building;
  icon?: string;
}

export interface Quest {
  id: number;
  kind: QuestKind;
  state: QuestState;
  giver: Building;
  name: string; // the person asking
  title: string;
  intro: string;
  thanks: string;
  steps: QuestStep[];
  step: number;
  reward: number;
  xp: number;
  /** optional time limit (seconds) for the whole quest once accepted */
  limit: number;
  startedAt: number;
}

export type QuestEvent =
  | { type: 'offer'; quest: Quest }
  | { type: 'step'; quest: Quest }
  | { type: 'done'; quest: Quest }
  | { type: 'failed'; quest: Quest }
  | { type: 'closed'; quest: Quest; shop: Building };

const NAMES = ['Nonna Rosa', 'Mr. Okafor', 'Aunt Marta', 'Kenji', 'Signora Bianchi', 'Leo the painter', 'Mila', 'Old Jack', 'Pip', 'Dr. Amari'];
const LOST = [
  { item: 'reading glasses', icon: '👓' },
  { item: 'house keys', icon: '🔑' },
  { item: 'favourite hat', icon: '👒' },
  { item: "grandson's teddy bear", icon: '🧸' },
  { item: 'lucky harmonica', icon: '🎵' },
];
const ERRANDS: Record<string, string> = {
  pizza: 'a slice of pizza', cafe: 'a cappuccino', comics: 'the new issue of their comic', gelato: 'a cone of gelato',
  bakery: 'a warm loaf', florist: 'a bunch of daisies', records: 'a jazz record', books: 'a detective novel',
};

export const QUEST_COLOR: [number, number, number] = [201, 163, 255];

export class Quests {
  list: Quest[] = [];
  private R;
  private near = new Set<number>();

  constructor(private map: GameMap, exclude: Set<number>) {
    this.R = rng(map.seed ^ 0x9e57);
    const R = this.R;
    const houses = map.buildings.filter((b) => b.kind === 'house' && !exclude.has(b.id)).sort(() => R.next() - 0.5);
    const kinds: QuestKind[] = (['lost', 'letter', 'errand', 'tour'] as QuestKind[]).sort(() => R.next() - 0.5).slice(0, 3);
    let id = 1;
    for (const kind of kinds) {
      const giver = houses.find((h) => !this.list.some((q) => Math.hypot(q.giver.x - h.x, q.giver.y - h.y) < 40));
      if (!giver) break;
      houses.splice(houses.indexOf(giver), 1);
      const q = this.make(kind, giver, id++, houses);
      if (q) this.list.push(q);
    }
  }

  get givers() {
    return this.list.filter((q) => q.state === 'available').map((q) => q.giver);
  }

  get active() {
    return this.list.filter((q) => q.state === 'active');
  }

  current(q: Quest): QuestStep | null {
    return q.state === 'active' ? q.steps[q.step] ?? null : null;
  }

  accept(q: Quest, time: number) {
    q.state = 'active';
    q.startedAt = time;
  }

  private spotInPark(): Spot | null {
    const R = this.R;
    for (let k = 0; k < 400; k++) {
      const x = R.range(10, this.map.width - 10);
      const y = R.range(10, this.map.height - 10);
      const t = tileAt(this.map, x, y);
      if (t !== T.GRASS && t !== T.PATH && t !== T.SAND) continue;
      if (this.map.buildings.some((b) => x > b.x - 2 && x < b.x + b.w + 2 && y > b.y - 2 && y < b.y + b.h + 2)) continue;
      if (this.map.trees.some((tr) => Math.hypot(tr.x - x, tr.y - y) < tr.r * 0.5 + 1.4)) continue;
      if (this.map.props.some((p) => Math.hypot(p.x - x, p.y - y) < p.r + (p.len ?? 0) + 1.2)) continue;
      return { x, y };
    }
    return null;
  }

  private make(kind: QuestKind, giver: Building, id: number, houses: Building[]): Quest | null {
    const R = this.R;
    const name = R.pick(NAMES);
    const base = { id, kind, state: 'available' as QuestState, giver, name, step: 0, limit: 0, startedAt: 0 };
    const back: QuestStep = { text: `Bring it back to ${name} at ${giver.no} ${giver.street}`, x: giver.stopX, y: giver.stopY, icon: '🏠' };
    switch (kind) {
      case 'lost': {
        const spot = this.spotInPark();
        if (!spot) return null;
        const it = R.pick(LOST);
        return {
          ...base, title: `${name}'s ${it.item}`,
          intro: `Oh dear, I lost my ${it.item} somewhere in the park this morning. Could you have a look for me?`,
          thanks: `My ${it.item}! You're an angel. Here, take this.`,
          steps: [{ text: `Find the ${it.item} (look for the sparkle)`, x: spot.x, y: spot.y, icon: it.icon }, back],
          reward: 12, xp: 45,
        };
      }
      case 'letter': {
        const to = houses.find((h) => Math.hypot(h.x - giver.x, h.y - giver.y) > 60) ?? houses[0];
        if (!to) return null;
        houses.splice(houses.indexOf(to), 1);
        return {
          ...base, title: 'A letter for an old friend',
          intro: `Would you take this letter to my old friend at ${to.no} ${to.street}? Quickly please, before they go out!`,
          thanks: '',
          steps: [{ text: `Deliver the letter to ${to.no} ${to.street}`, x: to.stopX, y: to.stopY, icon: '💌' }],
          reward: 10, xp: 40, limit: Math.round(30 + Math.hypot(to.x - giver.x, to.y - giver.y) / 4.5),
        };
      }
      case 'errand': {
        const shops = this.map.buildings.filter((b) => b.kind === 'shop' && !isService(b.shop));
        const shop = shops.sort((a, b) => Math.hypot(b.x - giver.x, b.y - giver.y) - Math.hypot(a.x - giver.x, a.y - giver.y))[0];
        if (!shop) return null;
        const what = ERRANDS[shop.shop!.id] ?? 'something nice';
        return {
          ...base, title: `${what[0].toUpperCase()}${what.slice(1)} for ${name}`,
          intro: `I can't leave the house today. Could you fetch me ${what} from ${shop.shop!.name}? I'll pay you back, promise.`,
          thanks: 'Just what I needed. Grazie mille!',
          steps: [{ text: `Get ${what} at ${shop.shop!.name}`, x: shop.stopX, y: shop.stopY, shop, icon: '🛍' }, back],
          reward: 11, xp: 40,
        };
      }
      case 'tour': {
        // a ring of checkpoints on the roads around the giver
        const steps: QuestStep[] = [];
        const cands: Spot[] = [];
        for (const r of this.map.roadRows)
          for (const c of this.map.roadCols) {
            const x = c * TILE + TILE;
            const y = r * TILE + TILE;
            if (tileAt(this.map, x, y) !== T.ROAD) continue;
            const d = Math.hypot(x - giver.x, y - giver.y);
            if (d > 25 && d < 110) cands.push({ x, y });
          }
        cands.sort(() => R.next() - 0.5);
        const pts: Spot[] = [];
        for (const p of cands) {
          if (pts.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > 30)) pts.push(p);
          if (pts.length === 4) break;
        }
        if (pts.length < 3) return null;
        // visit them in a sensible order (nearest next)
        let cur: Spot = { x: giver.stopX, y: giver.stopY };
        const left = [...pts];
        while (left.length) {
          left.sort((a, b) => Math.hypot(a.x - cur.x, a.y - cur.y) - Math.hypot(b.x - cur.x, b.y - cur.y));
          const p = left.shift()!;
          steps.push({ text: `Ride through checkpoint ${steps.length + 1}/${pts.length}`, x: p.x, y: p.y, ring: true, icon: '🏁' });
          cur = p;
        }
        let len = 0;
        cur = { x: giver.stopX, y: giver.stopY };
        for (const st of steps) {
          len += Math.hypot(st.x - cur.x, st.y - cur.y);
          cur = st;
        }
        return {
          ...base, title: 'The town tour challenge',
          intro: `Bet you can't ride through all my ${steps.length} checkpoints in time! The clock starts when you say yes.`,
          thanks: '',
          steps, reward: 14, xp: 55, limit: Math.round(12 + (len * 1.3) / 7),
        };
      }
    }
  }

  /**
   * `talk` is called when the player stops by a giver; returns an offer event once per visit.
   */
  update(px: number, py: number, speed: number, time: number, hour: number, out: QuestEvent[]) {
    for (const q of this.list) {
      if (q.state === 'available') {
        const d = Math.hypot(q.giver.stopX - px, q.giver.stopY - py);
        if (d < 3.2 && speed < 1.6) {
          if (!this.near.has(q.id)) {
            this.near.add(q.id);
            out.push({ type: 'offer', quest: q });
          }
        } else if (d > 6) this.near.delete(q.id);
        continue;
      }
      if (q.state !== 'active') continue;
      if (q.limit > 0 && time - q.startedAt > q.limit) {
        q.state = 'available';
        q.step = 0;
        this.near.delete(q.id);
        out.push({ type: 'failed', quest: q });
        continue;
      }
      const st = q.steps[q.step];
      const d = Math.hypot(st.x - px, st.y - py);
      const reached = st.ring ? d < 3.4 : d < 2.6 && speed < 3.6;
      if (!reached) continue;
      if (st.shop && !isOpen(st.shop.shop!, hour)) {
        const key = q.id * 100 + q.step;
        if (!this.near.has(key)) {
          this.near.add(key);
          out.push({ type: 'closed', quest: q, shop: st.shop });
        }
        continue;
      }
      q.step++;
      if (q.step >= q.steps.length) {
        q.state = 'done';
        out.push({ type: 'done', quest: q });
      } else out.push({ type: 'step', quest: q });
    }
  }
}
