import { hex, type RGB } from './math';

export type ThemeId = 'village' | 'seaside' | 'woods' | 'oldtown';

export interface Theme {
  id: ThemeId;
  name: string;
  grass: RGB;
  grass2: RGB;
  road: RGB;
  roadEdge: RGB;
  line: RGB;
  sand: RGB;
  water: RGB;
  water2: RGB;
  plaza: RGB;
  path: RGB;
  tree: RGB[];
  roofs: RGB[];
  walls: RGB[];
  /** generation knobs */
  roadGap: [number, number]; // tiles between roads
  removeRoads: number; // chance of dropping a road segment
  treeDensity: number;
  parkChance: number;
  houseChance: number;
  sea: boolean;
  plazas: boolean;
  streets: string[];
}

export const THEMES: Theme[] = [
  {
    id: 'village',
    name: 'Peach Village',
    grass: hex('#a9c98a'), grass2: hex('#9cbf7e'),
    road: hex('#6f6577'), roadEdge: hex('#e9d8c4'), line: hex('#fff1d0'),
    sand: hex('#f1d9a7'), water: hex('#7fc4d6'), water2: hex('#9fd8e4'),
    plaza: hex('#e8cfb3'), path: hex('#d8b98d'),
    tree: [hex('#6fa66a'), hex('#e6977e'), hex('#89b86a'), hex('#f2b28a')],
    roofs: [hex('#e07a6b'), hex('#f0a868'), hex('#c96f86'), hex('#8fa6c9')],
    walls: [hex('#fbe3cf'), hex('#f6efe2'), hex('#fde2e2')],
    roadGap: [7, 10], removeRoads: 0.22, treeDensity: 0.5, parkChance: 0.18, houseChance: 0.85,
    sea: false, plazas: false,
    streets: ['Peach Lane', 'Lemon Street', 'Apricot Road', 'Honey Way', 'Cherry Row', 'Mint Avenue', 'Fig Street', 'Plum Close', 'Orchard Road', 'Marigold Way'],
  },
  {
    id: 'seaside',
    name: 'Seashell Bay',
    grass: hex('#b8d39a'), grass2: hex('#aacb8c'),
    road: hex('#77708a'), roadEdge: hex('#f3e6cf'), line: hex('#ffffff'),
    sand: hex('#f6e2b3'), water: hex('#5fb7d4'), water2: hex('#8fd3e6'),
    plaza: hex('#f0dcc0'), path: hex('#e8cf9e'),
    tree: [hex('#5fa68a'), hex('#7cbf86'), hex('#f0a58f')],
    roofs: [hex('#5aa3c9'), hex('#f3f0e8'), hex('#e58b7b'), hex('#7fc4b8')],
    walls: [hex('#ffffff'), hex('#f5f0e6'), hex('#e6f2f5')],
    roadGap: [7, 11], removeRoads: 0.2, treeDensity: 0.35, parkChance: 0.12, houseChance: 0.85,
    sea: true, plazas: false,
    streets: ['Shell Road', 'Harbour Lane', 'Salt Street', 'Lighthouse Way', 'Coral Avenue', 'Gull Row', 'Driftwood Lane', 'Tide Street', 'Pier Road', 'Anchor Way'],
  },
  {
    id: 'woods',
    name: 'Pine Hollow',
    grass: hex('#8fb57c'), grass2: hex('#83aa71'),
    road: hex('#6b6470'), roadEdge: hex('#d9c7a8'), line: hex('#f5e7c8'),
    sand: hex('#d8c08c'), water: hex('#6aaec0'), water2: hex('#8cc4d0'),
    plaza: hex('#d9c3a1'), path: hex('#c9a77a'),
    tree: [hex('#3f7f5c'), hex('#4f8f62'), hex('#5c9a6a'), hex('#c98f5f')],
    roofs: [hex('#a65f4f'), hex('#7d6a5a'), hex('#c98a5a'), hex('#6f8a6a')],
    walls: [hex('#efe0c8'), hex('#e6d2b5')],
    roadGap: [9, 13], removeRoads: 0.32, treeDensity: 1.25, parkChance: 0.3, houseChance: 0.6,
    sea: false, plazas: false,
    streets: ['Pine Road', 'Fern Trail', 'Mossy Lane', 'Acorn Way', 'Owl Street', 'Birch Row', 'Cedar Path', 'Hollow Road', 'Bramble Lane', 'Elk Way'],
  },
  {
    id: 'oldtown',
    name: 'Old Town',
    grass: hex('#b3c98f'), grass2: hex('#a6bf82'),
    road: hex('#7a6e72'), roadEdge: hex('#e6d3bd'), line: hex('#fff3d6'),
    sand: hex('#ecd6a8'), water: hex('#7cbfd0'), water2: hex('#a2d6e2'),
    plaza: hex('#e3c7a5'), path: hex('#d6b68c'),
    tree: [hex('#78a865'), hex('#e3a07f'), hex('#94b96f')],
    roofs: [hex('#c8664f'), hex('#d98157'), hex('#b5584a'), hex('#e09a6a')],
    walls: [hex('#f6dcc0'), hex('#f2cfa8'), hex('#fbe6cf')],
    roadGap: [5, 8], removeRoads: 0.18, treeDensity: 0.3, parkChance: 0.1, houseChance: 0.95,
    sea: false, plazas: true,
    streets: ['Via del Sole', 'Bell Street', 'Clocktower Lane', 'Market Row', 'Fountain Way', 'Lantern Street', 'Cobble Lane', 'Arch Road', 'Guild Street', 'Old Wall Way'],
  },
];

export type ShopId = 'bakery' | 'florist' | 'pizza' | 'records' | 'books' | 'cafe' | 'comics' | 'gelato';

export interface ShopItem {
  name: string;
  fragile: boolean;
  /** time-sensitive: hot food or melting gelato pays a bonus when it arrives quickly */
  hot?: boolean;
}

export interface ShopType {
  id: ShopId;
  name: string;
  roof: RGB;
  awning: RGB;
  awning2: RGB;
  /** how the time-sensitive items are described */
  hotWord: string;
  /** opening hours as [open, close] pairs on a 24 h clock (close may pass midnight, e.g. 26 = 2 am) */
  hours: [number, number][];
  items: ShopItem[];
}

export const SHOPS: ShopType[] = [
  {
    id: 'pizza', name: 'Pizzeria Da Mayday', roof: hex('#e86a5a'), awning: hex('#d94a3d'), awning2: hex('#fff6e6'), hotWord: 'piping hot', hours: [[11, 15], [18, 26]],
    items: [
      { name: 'a margherita', fragile: false, hot: true },
      { name: 'a spicy diavola', fragile: false, hot: true },
      { name: 'two calzoni', fragile: false, hot: true },
      { name: 'a family pizza tower', fragile: true, hot: true },
      { name: 'a tiramisù', fragile: true },
    ],
  },
  {
    id: 'cafe', name: 'Caffè Lo-Fi', roof: hex('#9b6b4f'), awning: hex('#6b4a3a'), awning2: hex('#f4d6b0'), hotWord: 'still steaming', hours: [[6, 21]],
    items: [
      { name: 'two cappuccini', fragile: true, hot: true },
      { name: 'a flat white', fragile: true, hot: true },
      { name: 'warm cornetti', fragile: false, hot: true },
      { name: 'a box of biscotti', fragile: false },
      { name: 'a bag of coffee beans', fragile: false },
    ],
  },
  {
    id: 'comics', name: 'Nuvola Comics', roof: hex('#6f6ad1'), awning: hex('#ffd23f'), awning2: hex('#3d3a8f'), hotWord: 'release day', hours: [[10, 22.5]],
    items: [
      { name: 'a stack of manga', fragile: false },
      { name: 'a comic bundle', fragile: false },
      { name: 'a collector figure', fragile: true },
      { name: 'a board game', fragile: false },
      { name: 'a first-edition variant', fragile: true },
    ],
  },
  {
    id: 'gelato', name: 'Gelateria Luna', roof: hex('#f7b2c4'), awning: hex('#8fd6c8'), awning2: hex('#fff4f7'), hotWord: 'melting', hours: [[11, 24]],
    items: [
      { name: 'a tub of pistachio gelato', fragile: false, hot: true },
      { name: 'four gelato cones', fragile: true, hot: true },
      { name: 'an ice-cream cake', fragile: true, hot: true },
      { name: 'a box of granita', fragile: false, hot: true },
    ],
  },
  {
    id: 'bakery', name: 'Forno Pesca', roof: hex('#f2b56b'), awning: hex('#e4677b'), awning2: hex('#fff6e6'), hotWord: 'fresh from the oven', hours: [[4, 19]],
    items: [
      { name: 'warm croissants', fragile: false, hot: true },
      { name: 'a sourdough loaf', fragile: false },
      { name: 'a birthday cake', fragile: true },
      { name: 'a focaccia', fragile: false, hot: true },
    ],
  },
  {
    id: 'florist', name: 'Petali Fiori', roof: hex('#f3a6bd'), awning: hex('#5fa68a'), awning2: hex('#eaf7ef'), hotWord: 'freshly cut', hours: [[8, 19.5]],
    items: [
      { name: 'a bunch of tulips', fragile: false },
      { name: 'a potted fern', fragile: true },
      { name: 'sunflowers', fragile: false },
      { name: 'a little bonsai', fragile: true },
    ],
  },
  {
    id: 'records', name: 'Side B Records', roof: hex('#4b4a7a'), awning: hex('#f4c063'), awning2: hex('#2e2a46'), hotWord: 'just pressed', hours: [[10, 27]],
    items: [
      { name: 'vinyl records', fragile: true },
      { name: 'a cassette box', fragile: false },
      { name: 'a turntable', fragile: true },
    ],
  },
  {
    id: 'books', name: 'Dog-ear Books', roof: hex('#4f9a8a'), awning: hex('#2f6b5f'), awning2: hex('#f3e0b5'), hotWord: 'hot off the press', hours: [[9, 21]],
    items: [
      { name: 'a stack of novels', fragile: false },
      { name: 'a poetry book', fragile: false },
      { name: 'an atlas', fragile: false },
    ],
  },
];

export function isOpen(shop: ShopType, hour: number): boolean {
  return shop.hours.some(([o, c]) => (hour >= o && hour < c) || (hour + 24 >= o && hour + 24 < c));
}

export function hoursLabel(shop: ShopType): string {
  const f = (h: number) => {
    const hh = Math.floor(h % 24);
    const mm = Math.round((h - Math.floor(h)) * 60);
    return `${hh}${mm ? ':' + String(mm).padStart(2, '0') : ''}`;
  };
  return shop.hours.map(([o, c]) => `${f(o)}–${f(c)}`).join(', ');
}
