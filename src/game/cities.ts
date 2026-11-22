/**
 * Famous cities, split into neighbourhoods. Each neighbourhood is a generated
 * map with a river, bridges, protected cycle tracks and the real landmarks of
 * that part of town placed roughly where they are relative to each other.
 */

export type LandmarkKind =
  | 'bigben' | 'parliament' | 'abbey' | 'eye' | 'trafalgar'
  | 'stpauls' | 'tate' | 'globe' | 'shard'
  | 'tower' | 'gherkin' | 'belfast';

export type BridgeKind = 'westminster' | 'plain' | 'foot' | 'towerbridge' | 'blackfriars';

export interface LandmarkDef {
  kind: LandmarkKind;
  name: string;
  /** one-line fact shown when you ride past it the first time */
  fact: string;
  /** which side of the river */
  bank: 'north' | 'south' | 'river';
  /** where along the river, 0 = west edge, 1 = east edge */
  at: number;
  /** 0 = the block right on the embankment, 1 = the one behind it, … */
  ring: number;
  /** footprint in meters (clamped to the block) */
  w: number;
  h: number;
  /** fill the whole block (squares, castles) */
  fill?: boolean;
}

export interface BridgeDef {
  name: string;
  at: number;
  kind: BridgeKind;
}

export interface District {
  id: string;
  city: string;
  cityName: string;
  flag: string;
  name: string;
  blurb: string;
  river: string;
  embankments: [north: string, south: string];
  bridges: BridgeDef[];
  landmarks: LandmarkDef[];
}

export const DISTRICTS: District[] = [
  {
    id: 'westminster',
    city: 'london', cityName: 'London', flag: '🇬🇧',
    name: 'Westminster',
    blurb: 'Big Ben, Parliament and the Eye across the Thames',
    river: 'River Thames',
    embankments: ['Victoria Embankment', 'Albert Embankment'],
    bridges: [
      { name: 'Westminster Bridge', at: 0.42, kind: 'westminster' },
      { name: 'Lambeth Bridge', at: 0.08, kind: 'plain' },
      { name: 'Hungerford Bridge', at: 0.82, kind: 'foot' },
    ],
    landmarks: [
      { kind: 'bigben', name: 'Big Ben', fact: 'The Elizabeth Tower — the bell inside is the real Big Ben', bank: 'north', at: 0.36, ring: 0, w: 11, h: 11 },
      { kind: 'parliament', name: 'Houses of Parliament', fact: 'The Palace of Westminster has over 1,100 rooms', bank: 'north', at: 0.2, ring: 0, w: 40, h: 16 },
      { kind: 'abbey', name: 'Westminster Abbey', fact: 'Every coronation since 1066 has happened here', bank: 'north', at: 0.24, ring: 1, w: 34, h: 22 },
      { kind: 'trafalgar', name: 'Trafalgar Square', fact: "Nelson's Column is guarded by four bronze lions", bank: 'north', at: 0.7, ring: 2, w: 40, h: 30, fill: true },
      { kind: 'eye', name: 'London Eye', fact: '32 capsules, one for each London borough', bank: 'south', at: 0.56, ring: 0, w: 26, h: 22 },
    ],
  },
  {
    id: 'southbank',
    city: 'london', cityName: 'London', flag: '🇬🇧',
    name: 'South Bank',
    blurb: "St Paul's, Tate Modern, the Globe and the Shard",
    river: 'River Thames',
    embankments: ['Paul’s Walk', 'Bankside'],
    bridges: [
      { name: 'Blackfriars Bridge', at: 0.12, kind: 'blackfriars' },
      { name: 'Millennium Bridge', at: 0.45, kind: 'foot' },
      { name: 'Southwark Bridge', at: 0.72, kind: 'plain' },
    ],
    landmarks: [
      { kind: 'stpauls', name: "St Paul's Cathedral", fact: "Wren's dome has been on the skyline since 1710", bank: 'north', at: 0.45, ring: 1, w: 40, h: 26 },
      { kind: 'tate', name: 'Tate Modern', fact: 'A power station turned into an art gallery', bank: 'south', at: 0.42, ring: 0, w: 34, h: 18 },
      { kind: 'globe', name: "Shakespeare's Globe", fact: 'A rebuilt open-air theatre, thatched like in 1599', bank: 'south', at: 0.62, ring: 0, w: 17, h: 17 },
      { kind: 'shard', name: 'The Shard', fact: '310 metres of glass — the tallest building in the UK', bank: 'south', at: 0.9, ring: 1, w: 18, h: 18 },
    ],
  },
  {
    id: 'city',
    city: 'london', cityName: 'London', flag: '🇬🇧',
    name: 'Tower & the City',
    blurb: 'Tower Bridge, the Tower of London and the Gherkin',
    river: 'River Thames',
    embankments: ['Lower Thames Street', 'Tooley Street'],
    bridges: [
      { name: 'London Bridge', at: 0.12, kind: 'plain' },
      { name: 'Tower Bridge', at: 0.72, kind: 'towerbridge' },
    ],
    landmarks: [
      { kind: 'tower', name: 'Tower of London', fact: 'Home of the Crown Jewels — and six ravens', bank: 'north', at: 0.56, ring: 0, w: 38, h: 30, fill: true },
      { kind: 'gherkin', name: 'The Gherkin', fact: '30 St Mary Axe: the only curved glass is the lens on top', bank: 'north', at: 0.3, ring: 2, w: 16, h: 16 },
      { kind: 'belfast', name: 'HMS Belfast', fact: 'A Second World War cruiser, now a floating museum', bank: 'river', at: 0.4, ring: 0, w: 36, h: 6 },
      { kind: 'shard', name: 'The Shard', fact: '310 metres of glass — the tallest building in the UK', bank: 'south', at: 0.05, ring: 1, w: 18, h: 18 },
    ],
  },
];

export const STREETS: Record<string, string[]> = {
  westminster: ['Whitehall', 'Parliament Street', 'Victoria Street', 'Horseferry Road', 'Great Smith Street', 'Birdcage Walk', 'The Mall', 'Strand', 'Northumberland Avenue', 'Millbank', 'Tothill Street', 'Marsham Street', 'Belvedere Road', 'York Road', 'Lambeth Palace Road', 'Westminster Bridge Road', 'Baylis Road', 'Lower Marsh'],
  southbank: ['Queen Victoria Street', 'Cannon Street', 'Ludgate Hill', 'Carter Lane', 'Upper Thames Street', 'Godliman Street', 'Southwark Street', 'Sumner Street', 'Park Street', 'Hopton Street', 'Great Guildford Street', 'Borough High Street', 'Stamford Street', 'Union Street', 'Holland Street', 'Ewer Street'],
  city: ['Eastcheap', 'Fenchurch Street', 'Leadenhall Street', 'Bishopsgate', 'Lime Street', 'St Mary Axe', 'Minories', 'Great Tower Street', 'Mark Lane', 'Crutched Friars', 'Shad Thames', 'Gainsford Street', 'Queen Elizabeth Street', 'Druid Street', 'Tanner Street', 'Horselydown Lane'],
};

export const districtById = (id: string) => DISTRICTS.find((d) => d.id === id);
