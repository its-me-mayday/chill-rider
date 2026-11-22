import { rng } from './math';

export type ChallengeId = 'secret' | 'nobump' | 'hot' | 'fragile' | 'streak' | 'cards' | 'ride' | 'bell' | 'rush' | 'vip' | 'speedy';

export interface Challenge {
  id: ChallengeId;
  text: string;
  target: number;
  progress: number;
  done: boolean;
  reward: number;
}

const DEFS: { id: ChallengeId; text: (n: number) => string; target: number; reward: number; minLevel: number }[] = [
  { id: 'nobump', text: (n) => `Deliver ${n} orders in a row without bumping`, target: 3, reward: 8, minLevel: 1 },
  { id: 'hot', text: (n) => `Deliver ${n} hot orders with half the time left`, target: 2, reward: 7, minLevel: 1 },
  { id: 'fragile', text: (n) => `Deliver ${n} fragile orders without a scratch`, target: 2, reward: 7, minLevel: 1 },
  { id: 'streak', text: (n) => `Reach an on-time streak of ${n}`, target: 4, reward: 8, minLevel: 1 },
  { id: 'cards', text: (n) => `Find all ${n} hidden postcards`, target: 3, reward: 10, minLevel: 1 },
  { id: 'secret', text: (n) => `Discover ${n} secrets in this town`, target: 2, reward: 10, minLevel: 1 },
  { id: 'ride', text: () => 'Ride 1.5 km in this town', target: 1500, reward: 5, minLevel: 1 },
  { id: 'bell', text: (n) => `Ring the bell so ${n} people step aside`, target: 5, reward: 5, minLevel: 1 },
  { id: 'speedy', text: (n) => `Deliver ${n} orders in under 25 s each`, target: 3, reward: 8, minLevel: 1 },
  { id: 'rush', text: (n) => `Deliver ${n} rush orders on time`, target: 2, reward: 9, minLevel: 2 },
  { id: 'vip', text: (n) => `Make ${n} VIP customers happy`, target: 2, reward: 9, minLevel: 3 },
];

export function pickChallenges(seed: number, level: number): Challenge[] {
  const R = rng(seed ^ 0xc4a11);
  const pool = DEFS.filter((d) => d.minLevel <= level).sort(() => R.next() - 0.5);
  return pool.slice(0, 2).map((d) => ({ id: d.id, text: d.text(d.target), target: d.target, progress: 0, done: false, reward: d.reward }));
}

/** Bump progress on a challenge; returns it if it just completed. */
export function advance(list: Challenge[], id: ChallengeId, amount = 1, absolute = false): Challenge | null {
  const c = list.find((x) => x.id === id);
  if (!c || c.done) return null;
  c.progress = absolute ? Math.max(c.progress, amount) : c.progress + amount;
  if (c.progress >= c.target) {
    c.progress = c.target;
    c.done = true;
    return c;
  }
  return null;
}

export function reset(list: Challenge[], id: ChallengeId) {
  const c = list.find((x) => x.id === id);
  if (c && !c.done) c.progress = 0;
}
