/**
 * Everything that persists between sessions: wallet, XP, upgrades, cosmetics,
 * collection album, lifetime stats and achievements.
 */

export type UpgradeId = 'gears' | 'tires' | 'rack' | 'suspension' | 'light';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  desc: (lvl: number) => string;
  prices: number[]; // price of each next level
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'gears', name: 'Gears', desc: (l) => `Top speed +${l * 7}%`, prices: [18, 40, 80, 140] },
  { id: 'tires', name: 'Gravel tires', desc: (l) => `Grass & sand ${l * 15}% faster, better grip`, prices: [15, 35, 70] },
  { id: 'rack', name: 'Bigger rack', desc: (l) => `Carry ${3 + l} orders`, prices: [45, 110] },
  { id: 'suspension', name: 'Suspension', desc: (l) => `Fragile goods take ${l * 25}% less damage`, prices: [25, 55, 100] },
  { id: 'light', name: 'Headlight', desc: (l) => `Night light ${l === 0 ? 'basic' : `+${l * 40}%`}`, prices: [20, 50] },
];

export interface Cosmetic {
  id: string;
  slot: 'frame' | 'beanie' | 'scarf';
  name: string;
  color: string;
  /** -1 = can't be bought, only unlocked by a secret */
  price: number;
  secret?: string;
}

export const COSMETICS: Cosmetic[] = [
  { id: 'frame-mint', slot: 'frame', name: 'Mint', color: '#8fe0cc', price: 0 },
  { id: 'frame-peach', slot: 'frame', name: 'Peach', color: '#ffb38a', price: 12 },
  { id: 'frame-lilac', slot: 'frame', name: 'Lilac', color: '#c9b3f2', price: 12 },
  { id: 'frame-cherry', slot: 'frame', name: 'Cherry', color: '#e4677b', price: 20 },
  { id: 'frame-sky', slot: 'frame', name: 'Sky', color: '#7fc4e6', price: 20 },
  { id: 'frame-gold', slot: 'frame', name: 'Gold', color: '#f4c063', price: 60 },
  { id: 'beanie-rose', slot: 'beanie', name: 'Rose', color: '#e4677b', price: 0 },
  { id: 'beanie-sun', slot: 'beanie', name: 'Sun', color: '#f4c063', price: 8 },
  { id: 'beanie-moss', slot: 'beanie', name: 'Moss', color: '#7cbf86', price: 8 },
  { id: 'beanie-ink', slot: 'beanie', name: 'Ink', color: '#4b4a7a', price: 15 },
  { id: 'beanie-snow', slot: 'beanie', name: 'Snow', color: '#f6f1e4', price: 15 },
  { id: 'beanie-starry', slot: 'beanie', name: 'Starry', color: '#2e2a6e', price: -1, secret: 'Meet the stargazer at night' },
  { id: 'frame-treasure', slot: 'frame', name: 'Treasure', color: '#d9a441', price: -1, secret: 'Open 3 hidden chests' },
  { id: 'scarf-kitten', slot: 'scarf', name: 'Kitten', color: '#f0a25e', price: -1, secret: 'Find 3 lost kittens' },
  { id: 'scarf-coral', slot: 'scarf', name: 'Coral', color: '#ff8f8f', price: 0 },
  { id: 'scarf-teal', slot: 'scarf', name: 'Teal', color: '#4fb3a6', price: 8 },
  { id: 'scarf-butter', slot: 'scarf', name: 'Butter', color: '#ffe08a', price: 8 },
  { id: 'scarf-plum', slot: 'scarf', name: 'Plum', color: '#9b5fa6', price: 15 },
  { id: 'scarf-rainbow', slot: 'scarf', name: 'Rainbow', color: 'rainbow', price: 80 },
];

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  test: (p: Profile) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first', name: 'First drop', desc: 'Deliver your first order', test: (p) => p.stats.deliveries >= 1 },
  { id: 'ten', name: 'Regular', desc: 'Deliver 25 orders', test: (p) => p.stats.deliveries >= 25 },
  { id: 'hundred', name: 'Local legend', desc: 'Deliver 100 orders', test: (p) => p.stats.deliveries >= 100 },
  { id: 'streak5', name: 'In the zone', desc: 'Make 5 on-time deliveries in a row', test: (p) => p.stats.bestStreak >= 5 },
  { id: 'streak12', name: 'Clockwork', desc: 'Make 12 on-time deliveries in a row', test: (p) => p.stats.bestStreak >= 12 },
  { id: 'km10', name: 'Long ride', desc: 'Ride 10 km', test: (p) => p.stats.meters >= 10000 },
  { id: 'km50', name: 'Tour de town', desc: 'Ride 50 km', test: (p) => p.stats.meters >= 50000 },
  { id: 'town1', name: 'New in town', desc: 'Complete a town', test: (p) => p.stats.towns >= 1 },
  { id: 'town8', name: 'Wanderer', desc: 'Complete 8 towns', test: (p) => p.stats.towns >= 8 },
  { id: 'stars3', name: 'Five-star courier', desc: 'Finish a town with 3 stars', test: (p) => p.stats.perfectTowns >= 1 },
  { id: 'cards6', name: 'Collector', desc: 'Find 6 hidden postcards', test: (p) => p.stats.postcards >= 6 },
  { id: 'cards24', name: 'Postcard album', desc: 'Find 24 hidden postcards', test: (p) => p.stats.postcards >= 24 },
  { id: 'vip', name: 'Red carpet', desc: 'Deliver to 5 VIP customers', test: (p) => p.stats.vip >= 5 },
  { id: 'rush', name: 'Lightning', desc: 'Deliver 10 rush orders on time', test: (p) => p.stats.rush >= 10 },
  { id: 'night', name: 'Night owl', desc: 'Make 10 deliveries at night', test: (p) => p.stats.night >= 10 },
  { id: 'rain', name: 'Singing in the rain', desc: 'Make 10 deliveries in the rain', test: (p) => p.stats.rain >= 10 },
  { id: 'bell', name: 'Ring ring', desc: 'Ring the bell 50 times', test: (p) => p.stats.bells >= 50 },
  { id: 'garage', name: 'Tuned up', desc: 'Buy 5 upgrades', test: (p) => Object.values(p.upgrades).reduce((a, b) => a + b, 0) >= 5 },
  { id: 'style', name: 'Looking good', desc: 'Own 6 style items', test: (p) => p.owned.length >= 9 },
  { id: 'challenge', name: 'Overachiever', desc: 'Complete 10 town challenges', test: (p) => p.stats.challenges >= 10 },
  { id: 'quest1', name: 'Good neighbour', desc: 'Finish a side quest', test: (p) => p.stats.quests >= 1 },
  { id: 'quest10', name: 'Town hero', desc: 'Finish 10 side quests', test: (p) => p.stats.quests >= 10 },
  { id: 'secret1', name: 'Curious', desc: 'Discover a hidden secret', test: (p) => p.stats.secrets >= 1 },
  { id: 'secret12', name: 'Secret keeper', desc: 'Discover 12 hidden secrets', test: (p) => p.stats.secrets >= 12 },
  { id: 'stargazer', name: 'Starstruck', desc: 'Meet the stargazer at night', test: (p) => (p.secrets.stargazer ?? 0) >= 1 },
  { id: 'tourist', name: 'Tourist', desc: 'Ride past 5 famous sights', test: (p) => p.seen.length >= 5 },
  { id: 'londoner', name: 'Londoner', desc: 'See all 12 sights of London', test: (p) => p.seen.length >= 12 },
  { id: 'lanes', name: 'Superhighway', desc: 'Ride 2 km on cycle tracks', test: (p) => p.stats.bikeLane >= 2000 },
  { id: 'gnomes', name: 'Gnome collector', desc: 'Find 5 garden gnomes', test: (p) => (p.secrets.gnome ?? 0) >= 5 },
];

export interface Profile {
  v: 1;
  wallet: number;
  xp: number;
  level: number;
  townIndex: number;
  /** a chosen destination (theme id), '' = follow the town tour */
  place: string;
  /** names of the famous sights ridden past */
  seen: string[];
  upgrades: Record<UpgradeId, number>;
  owned: string[];
  equipped: { frame: string; beanie: string; scarf: string };
  achievements: string[];
  album: Record<string, number>; // town theme id → postcards found (lifetime)
  secrets: Record<string, number>; // secret kind → times found
  stats: {
    deliveries: number;
    onTime: number;
    meters: number;
    bestStreak: number;
    towns: number;
    perfectTowns: number;
    postcards: number;
    secrets: number;
    quests: number;
    redLights: number;
    vip: number;
    rush: number;
    night: number;
    rain: number;
    bells: number;
    challenges: number;
    tipsEarned: number;
    /** meters ridden on protected cycle tracks */
    bikeLane: number;
  };
}

const KEY = 'chill-rider:profile';

export function defaultProfile(): Profile {
  return {
    v: 1,
    wallet: 0,
    xp: 0,
    level: 1,
    townIndex: 0,
    place: '',
    seen: [],
    upgrades: { gears: 0, tires: 0, rack: 0, suspension: 0, light: 0 },
    owned: ['frame-mint', 'beanie-rose', 'scarf-coral'],
    equipped: { frame: 'frame-mint', beanie: 'beanie-rose', scarf: 'scarf-coral' },
    achievements: [],
    album: {},
    secrets: {},
    stats: {
      deliveries: 0, onTime: 0, meters: 0, bestStreak: 0, towns: 0, perfectTowns: 0, postcards: 0,
      vip: 0, rush: 0, night: 0, rain: 0, bells: 0, challenges: 0, tipsEarned: 0, secrets: 0, quests: 0, redLights: 0, bikeLane: 0,
    },
  };
}

export function loadProfile(): Profile {
  const d = defaultProfile();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const p = JSON.parse(raw) as Partial<Profile>;
    return {
      ...d,
      ...p,
      upgrades: { ...d.upgrades, ...(p.upgrades ?? {}) },
      equipped: { ...d.equipped, ...(p.equipped ?? {}) },
      stats: { ...d.stats, ...(p.stats ?? {}) },
      owned: Array.from(new Set([...(d.owned), ...(p.owned ?? [])])),
      achievements: p.achievements ?? [],
      album: p.album ?? {},
      secrets: p.secrets ?? {},
      seen: p.seen ?? [],
      place: p.place ?? '',
    };
  } catch {
    return d;
  }
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable — progress lives for this session only */
  }
}

/** XP needed to go from `level` to `level + 1`. */
export const xpForLevel = (level: number) => Math.round(80 * Math.pow(level, 1.35));

/** Adds XP, returns the number of levels gained. */
export function addXp(p: Profile, amount: number): number {
  p.xp += amount;
  let gained = 0;
  while (p.xp >= xpForLevel(p.level)) {
    p.xp -= xpForLevel(p.level);
    p.level++;
    gained++;
  }
  return gained;
}

/** New achievements unlocked since the last check. */
export function checkAchievements(p: Profile): AchievementDef[] {
  const out: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!p.achievements.includes(a.id) && a.test(p)) {
      p.achievements.push(a.id);
      out.push(a);
    }
  }
  return out;
}

export const LEVEL_UNLOCKS: Record<number, string> = {
  2: '⚡ Rush orders: short timer, big tip',
  3: '★ VIP customers: pay double, hate bumps',
  4: 'Town challenges pay +50%',
  5: 'Shops restock faster',
  7: 'Rainy-day bonus doubles',
};

export function cosmeticColor(id: string) {
  return COSMETICS.find((c) => c.id === id)?.color ?? '#ffffff';
}

/** Stats that the rider and orders read from the upgrades. */
export function bikeStats(p: Profile) {
  const u = p.upgrades;
  return {
    speedMul: 1 + u.gears * 0.07,
    offroadMul: 1 + u.tires * 0.15,
    grip: 1 + u.tires * 0.1,
    capacity: 3 + u.rack,
    fragileMul: 1 - u.suspension * 0.25,
    light: 1 + u.light * 0.4,
  };
}
export type BikeStats = ReturnType<typeof bikeStats>;
