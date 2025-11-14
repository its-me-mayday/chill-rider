export type TileType =
  | "road"
  | "grass"
  | "tree"
  | "building"
  | "slow"
  | "coffee"
  | "shop"
  | "void";

export interface Position {
  x: number;
  y: number;
}

export type Direction = "up" | "down" | "left" | "right";

export interface GameOptions {
  width: number;
  height: number;
  seed?: number;
}

export interface GameState {
  map: TileType[][];
  riderPosition: Position;
  goalPosition: Position;
  options: GameOptions;
  distance: number;
  deliveries: number;
  level: number;
  facing: Direction;
  coins: Position[];
  coinsCollected: number;
}

export type Command =
  | { type: "MOVE"; direction: Direction }
  | { type: "REGENERATE_MAP" }
  | { type: "DELIVERY_COMPLETED" };

const DELIVERIES_PER_LEVEL = 5;

export function createGame(options: GameOptions): GameState {
  const level = 1;
  const map = generateMap(options, level);

  const riderPosition: Position = {
    x: Math.floor(options.width / 2),
    y: Math.floor(options.height / 2),
  };

  const goalPosition = pickGoalPosition(map, riderPosition);
  const coins = generateCoins(map, level, options.seed);

  return {
    map,
    riderPosition,
    goalPosition,
    options,
    distance: 0,
    deliveries: 0,
    level,
    facing: "down",
    coins,
    coinsCollected: 0,
  };
}

export function applyCommand(
  state: GameState,
  command: Command
): GameState {
  switch (command.type) {
    case "MOVE":
      return moveRider(state, command.direction);
    case "REGENERATE_MAP":
      return regenerateMap(state);
    case "DELIVERY_COMPLETED":
      return onDeliveryCompleted(state);
    default:
      return state;
  }
}

function onDeliveryCompleted(state: GameState): GameState {
  const deliveries = state.deliveries + 1;
  const shouldLevelUp = deliveries % DELIVERIES_PER_LEVEL === 0;

  if (!shouldLevelUp) {
    return {
      ...state,
      deliveries,
    };
  }

  const nextLevel = state.level + 1;
  const map = generateMap(state.options, nextLevel);

  const riderPosition: Position = {
    x: Math.floor(state.options.width / 2),
    y: Math.floor(state.options.height / 2),
  };

  const goalPosition = pickGoalPosition(map, riderPosition);
  const coins = generateCoins(map, nextLevel, state.options.seed);

  return {
    ...state,
    map,
    riderPosition,
    goalPosition,
    level: nextLevel,
    deliveries,
    distance: 0,
    coins,
  };
}

function moveRider(state: GameState, direction: Direction): GameState {
  const { riderPosition, map, goalPosition } = state;

  const rawTarget = getNextPosition(riderPosition, direction);
  const target = wrapPosition(rawTarget, map);

  const tile = map[target.y][target.x];
  if (!isWalkable(tile)) {
    return {
      ...state,
      facing: direction,
    };
  }

  const stepCost = tile === "slow" ? 2 : 1;

  let nextDistance = state.distance + stepCost;
  let nextDeliveries = state.deliveries;
  let nextLevel = state.level;
  let nextMap = map;
  let nextRiderPosition = target;
  let nextGoalPosition = goalPosition;
  let nextCoinsPositions = state.coins;
  let nextCoinsCollected = state.coinsCollected;

  const coinIndex = state.coins.findIndex(
    (c) => c.x === target.x && c.y === target.y
  );
  if (coinIndex !== -1) {
    const updatedCoins = [...state.coins];
    updatedCoins.splice(coinIndex, 1);
    nextCoinsPositions = updatedCoins;
    nextCoinsCollected = state.coinsCollected + 1;
  }

  if (tile === "coffee") {
    nextDistance = Math.max(0, nextDistance - 4);
    nextCoinsCollected = nextCoinsCollected + 2;
  }

  const reachedGoal =
    target.x === goalPosition.x && target.y === goalPosition.y;

  if (reachedGoal) {
    nextDeliveries += 1;

    const shouldLevelUp = nextDeliveries % 5 === 0;
    if (shouldLevelUp) {
      nextLevel = state.level + 1;
      nextMap = generateMap(state.options, nextLevel);

      nextRiderPosition = {
        x: Math.floor(state.options.width / 2),
        y: Math.floor(state.options.height / 2),
      };

      nextGoalPosition = pickGoalPosition(nextMap, nextRiderPosition);
      nextDistance = 0;
      nextCoinsPositions = generateCoins(
        nextMap,
        nextLevel,
        state.options.seed
      );
    } else {
      nextGoalPosition = pickGoalPosition(map, target);
    }
  }

  return {
    ...state,
    map: nextMap,
    riderPosition: nextRiderPosition,
    goalPosition: nextGoalPosition,
    distance: nextDistance,
    deliveries: nextDeliveries,
    level: nextLevel,
    facing: direction,
    coins: nextCoinsPositions,
    coinsCollected: nextCoinsCollected,
  };
}


function regenerateMap(state: GameState): GameState {
  const map = generateMap(state.options, state.level);

  const riderPosition: Position = {
    x: Math.floor(state.options.width / 2),
    y: Math.floor(state.options.height / 2),
  };

  const goalPosition = pickGoalPosition(map, riderPosition);
  const coins = generateCoins(map, state.level, state.options.seed);

  return {
    ...state,
    map,
    riderPosition,
    goalPosition,
    distance: 0,
    deliveries: 0,
    coins,
  };
}

function generateMap(options: GameOptions, level: number): TileType[][] {
  const { width, height, seed } = options;
  const rng = createRng((seed ?? Date.now()) + level * 997);

  const rows: TileType[][] = [];
  for (let y = 0; y < height; y++) {
    const row: TileType[] = [];
    for (let x = 0; x < width; x++) {
      row.push("grass");
    }
    rows.push(row);
  }

  // main road orizzontale leggermente "wavy"
  let mainRoadY = Math.floor(height / 2);
  for (let x = 0; x < width; x++) {
    rows[mainRoadY][x] = "road";

    if (rng() < 0.12 && mainRoadY > 1) {
      mainRoadY -= 1;
    } else if (rng() < 0.24 && mainRoadY < height - 2) {
      mainRoadY += 1;
    }

    if (rng() < 0.1) {
      const dy = rng() < 0.5 ? -1 : 1;
      const y2 = mainRoadY + dy;
      if (y2 >= 0 && y2 < height) {
        rows[y2][x] = "road";
      }
    }
  }

  // poche strade verticali, controllate e non troppo dense
  const baseVertical = Math.max(2, Math.floor(width / 8));
  const extraByLevel = Math.min(2, Math.floor((level - 1) / 3));
  const verticalRoadCount = Math.min(4, baseVertical + extraByLevel);

  for (let i = 0; i < verticalRoadCount; i++) {
    const x = Math.floor(((i + 1) * width) / (verticalRoadCount + 1));
    for (let y = 0; y < height; y++) {
      if (level >= 4 && rng() < 0.08) {
        continue;
      }

      rows[y][x] = "road";

      if (rng() < 0.08 && x + 1 < width && rows[y][x + 1] === "grass") {
        rows[y][x + 1] = "road";
      }
    }
  }

  const buildingChance = Math.min(0.22 + (level - 1) * 0.03, 0.4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rows[y][x] !== "road") continue;
      if (rng() < buildingChance) {
        const dir = rng() < 0.5 ? -1 : 1;
        const by = y + dir;
        if (by >= 0 && by < height && rows[by][x] === "grass") {
          rows[by][x] = "building";
          if (rng() < 0.4) {
            const by2 = by + dir;
            if (by2 >= 0 && by2 < height && rows[by2][x] === "grass") {
              rows[by2][x] = "building";
            }
          }
        }
      }
    }
  }

  const treeChance = Math.min(0.14 + (level - 1) * 0.03, 0.3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rows[y][x] !== "grass") continue;
      if (rng() < treeChance) {
        rows[y][x] = "tree";
        if (rng() < 0.4 && x + 1 < width && rows[y][x + 1] === "grass") {
          rows[y][x + 1] = "tree";
        }
        if (rng() < 0.4 && y + 1 < height && rows[y + 1][x] === "grass") {
          rows[y + 1][x] = "tree";
        }
      }
    }
  }

  const slowBase = 0.06;
  const slowPerLevel = 0.02;
  const slowChance = Math.min(
    slowBase + Math.max(level - 1, 0) * slowPerLevel,
    0.18
  );

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rows[y][x] !== "grass") continue;
      if (rng() < slowChance) {
        rows[y][x] = "slow";
      }
    }
  }

  const coffeeBase = 0.03;
  const coffeePerLevel = 0.01;
  const coffeeChance = Math.min(
    coffeeBase + Math.max(level - 1, 0) * coffeePerLevel,
    0.1
  );

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rows[y][x] !== "grass") continue;
      if (rng() >= coffeeChance) continue;

      const nearRoad =
        (y > 0 && rows[y - 1][x] === "road") ||
        (y < height - 1 && rows[y + 1][x] === "road") ||
        (x > 0 && rows[y][x - 1] === "road") ||
        (x < width - 1 && rows[y][x + 1] === "road");

      if (nearRoad) {
        rows[y][x] = "coffee";
      }
    }
  }

  const shopCandidates: Position[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rows[y][x] !== "grass") continue;

      const nearRoad =
        (y > 0 && rows[y - 1][x] === "road") ||
        (y < height - 1 && rows[y + 1][x] === "road") ||
        (x > 0 && rows[y][x - 1] === "road") ||
        (x < width - 1 && rows[y][x + 1] === "road");

      if (nearRoad) {
        shopCandidates.push({ x, y });
      }
    }
  }

  if (shopCandidates.length > 0) {
    const minShops = level <= 5 ? 2 : 5;
    const maxShops = Math.min(
      level <= 5 ? 3 : 7,
      shopCandidates.length
    );
    const targetShops = Math.max(minShops, maxShops);

    const chosen: Position[] = [];
    while (chosen.length < targetShops && shopCandidates.length > 0) {
      const idx = Math.floor(rng() * shopCandidates.length);
      const candidate = shopCandidates[idx];
      shopCandidates.splice(idx, 1);
      rows[candidate.y][candidate.x] = "shop";
      chosen.push(candidate);
    }
  }

  return rows;
}


function isNearRoad(rows: TileType[][], x: number, y: number): boolean {
  const height = rows.length;
  const width = rows[0].length;

  if (y > 0 && rows[y - 1][x] === "road") return true;
  if (y < height - 1 && rows[y + 1][x] === "road") return true;
  if (x > 0 && rows[y][x - 1] === "road") return true;
  if (x < width - 1 && rows[y][x + 1] === "road") return true;

  return false;
}


function generateCoins(
  map: TileType[][],
  level: number,
  seed?: number
): Position[] {
  const rng = createRng((seed ?? Date.now()) + level * 4243 + 99);
  const roads: Position[] = [];

  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[0].length; x++) {
      if (map[y][x] === "road") {
        roads.push({ x, y });
      }
    }
  }

  if (roads.length === 0) {
    return [];
  }

  const baseCoins = 4;
  const targetCount = baseCoins + Math.max(level - 1, 0);
  const coinsCount = Math.min(targetCount, roads.length);

  const coins: Position[] = [];
  while (coins.length < coinsCount) {
    const idx = Math.floor(rng() * roads.length);
    const candidate = roads[idx];
    if (!coins.some((c) => c.x === candidate.x && c.y === candidate.y)) {
      coins.push(candidate);
    }
  }

  return coins;
}

function pickGoalPosition(
  map: TileType[][],
  riderPosition: Position
): Position {
  const candidates: Position[] = [];

  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[0].length; x++) {
      if (map[y][x] !== "road") continue;
      if (x === riderPosition.x && y === riderPosition.y) continue;
      candidates.push({ x, y });
    }
  }

  if (candidates.length === 0) {
    return riderPosition;
  }

  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
}

function getNextPosition(pos: Position, dir: Direction): Position {
  switch (dir) {
    case "up":
      return { x: pos.x, y: pos.y - 1 };
    case "down":
      return { x: pos.x, y: pos.y + 1 };
    case "left":
      return { x: pos.x - 1, y: pos.y };
    case "right":
      return { x: pos.x + 1, y: pos.y };
  }
}

function isWalkable(tile: TileType): boolean {
  return (
    tile === "road" ||
    tile === "grass" ||
    tile === "slow" ||
    tile === "coffee" ||
    tile === "shop" ||
    tile === "building"
  );
}

function wrapPosition(pos: Position, map: TileType[][]): Position {
  const height = map.length;
  const width = map[0].length;

  let x = pos.x;
  let y = pos.y;

  if (x < 0) x = width - 1;
  else if (x >= width) x = 0;

  if (y < 0) y = height - 1;
  else if (y >= height) y = 0;

  return { x, y };
}

function createRng(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;

  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}
