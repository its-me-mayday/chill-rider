export type TileType =
  | "road"
  | "grass"
  | "tree"
  | "building"
  | "slow"
  | "coffee"
  | "shop"
  | "void"
  // nuovi ostacoli soft
  | "pothole" // buca
  | "rock"    // sasso
  | "bench"   // panchina
  | "leaf";   // foglie per terra

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
  score: number;
  activeTarget?: {
    houseColor: string;
    houseId: string;
    remainingTime: number; // NEW
  };
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
  const score = 0;

  return {
    score,
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

// ====== NUOVO helper per deviazione soft ======
function getDeviationPosition(
  from: Position,
  dir: Direction,
  map: TileType[][]
): Position | null {
  // se ti muovi su/giù, devia a sx o dx; se sx/dx, devia su o giù
  const sideDir: Direction =
    dir === "up" || dir === "down"
      ? Math.random() < 0.5
        ? "left"
        : "right"
      : Math.random() < 0.5
        ? "up"
        : "down";

  const sidePos = wrapPosition(getNextPosition(from, sideDir), map);
  const tile = map[sidePos.y][sidePos.x];
  if (isWalkable(tile)) {
    return sidePos;
  }
  return null;
}

function moveRider(state: GameState, direction: Direction): GameState {
  const { riderPosition, map, goalPosition } = state;

  const rawTarget = getNextPosition(riderPosition, direction);
  const target = wrapPosition(rawTarget, map);

  const tileAtTarget = map[target.y][target.x];

  if (!isWalkable(tileAtTarget)) {
    return {
      ...state,
      facing: direction,
    };
  }

  // posizione finale (può essere deviata per soft ostacoli)
  let nextRiderPosition: Position = target;

  // deviazione per buca/sasso/panchina
  if (
    tileAtTarget === "pothole" ||
    tileAtTarget === "rock" ||
    tileAtTarget === "bench"
  ) {
    const DEVIATION_CHANCE = 0.4;
    if (Math.random() < DEVIATION_CHANCE) {
      const deviated = getDeviationPosition(target, direction, map);
      if (deviated) {
        nextRiderPosition = deviated;
      }
    }
  }

  const tileAtFinal = map[nextRiderPosition.y][nextRiderPosition.x];

  // costo base del passo
  let stepCost = 1;

  // terreno lento
  if (tileAtFinal === "slow") {
    stepCost = 2;
  }

  // perishable target aggiornato
  let nextActiveTarget = state.activeTarget;

  // ---- malus/bonus per tile ----
  switch (tileAtTarget) {
    case "pothole": {
      // soft malus forte
      stepCost += 2;
      if (state.activeTarget) {
        nextActiveTarget = {
          ...state.activeTarget,
          remainingTime: Math.max(
            0,
            state.activeTarget.remainingTime - 2
          ),
        };
      }
      break;
    }
    case "rock": {
      // malus medio
      stepCost += 1;
      if (state.activeTarget) {
        nextActiveTarget = {
          ...state.activeTarget,
          remainingTime: Math.max(
            0,
            state.activeTarget.remainingTime - 1
          ),
        };
      }
      break;
    }
    case "bench": {
      // solo rallentamento, niente perishable
      stepCost += 1;
      break;
    }
    case "leaf": {
      const SLIP_CHANCE = 0.3; // 30% di malus
      if (Math.random() < SLIP_CHANCE) {
        stepCost += 1;
        if (state.activeTarget) {
          nextActiveTarget = {
            ...state.activeTarget,
            remainingTime: Math.max(
              0,
              state.activeTarget.remainingTime - 1
            ),
          };
        }
      }
      break;
    }
    default:
      break;
  }
  // -------------------------------

  let nextDistance = state.distance + stepCost;
  let nextDeliveries = state.deliveries;
  let nextLevel = state.level;
  let nextMap = map;
  let nextGoalPosition = goalPosition;
  let nextCoinsPositions = state.coins;
  let nextCoinsCollected = state.coinsCollected;

  // COIN: sulla posizione finale (dopo eventuale deviazione)
  const coinIndex = state.coins.findIndex(
    (c) => c.x === nextRiderPosition.x && c.y === nextRiderPosition.y
  );
  if (coinIndex !== -1) {
    const updatedCoins = [...state.coins];
    updatedCoins.splice(coinIndex, 1);
    nextCoinsPositions = updatedCoins;
    nextCoinsCollected = state.coinsCollected + 1;
  }

  // COFFEE: bonus se la tile finale è coffee
  if (tileAtFinal === "coffee") {
    nextDistance = Math.max(0, nextDistance - 4);
    nextCoinsCollected = nextCoinsCollected + 2;
  }

  const reachedGoal =
    nextRiderPosition.x === goalPosition.x &&
    nextRiderPosition.y === goalPosition.y;

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
      nextGoalPosition = pickGoalPosition(map, nextRiderPosition);
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
    activeTarget: nextActiveTarget,
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

  // base: tutto grass
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

  // poche strade verticali, non troppo dense
  const baseVertical = Math.max(2, Math.floor(width / 8));
  const extraByLevel = Math.min(2, Math.floor((level - 1) / 3));
  const verticalRoadCount = Math.min(4, baseVertical + extraByLevel);

  for (let i = 0; i < verticalRoadCount; i++) {
    const x = Math.floor(((i + 1) * width) / (verticalRoadCount + 1));
    for (let y = 0; y < height; y++) {
      if (level >= 4 && rng() < 0.08) continue;
      rows[y][x] = "road";

      if (rng() < 0.08 && x + 1 < width && rows[y][x + 1] === "grass") {
        rows[y][x + 1] = "road";
      }
    }
  }

  // === CASE (building) SEMPRE PRESENTI, ADIACENTI ALLA STRADA ===
  const houseCandidates: Position[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rows[y][x] !== "grass") continue;

      const nearRoad =
        (y > 0 && rows[y - 1][x] === "road") ||
        (y < height - 1 && rows[y + 1][x] === "road") ||
        (x > 0 && rows[y][x - 1] === "road") ||
        (x < width - 1 && rows[y][x + 1] === "road");

      if (nearRoad) {
        houseCandidates.push({ x, y });
      }
    }
  }

  // minimo 1 casa, ma in pratica:
  // - livelli 1–5: almeno 3
  // - dal 6 in poi: almeno 5
  const baseRequiredHouses = level <= 5 ? 3 : 5;
  const requiredHouses = Math.max(1, baseRequiredHouses);
  const targetHouses = Math.min(requiredHouses, houseCandidates.length);

  const chosenHouses: Position[] = [];
  while (chosenHouses.length < targetHouses && houseCandidates.length > 0) {
    const idx = Math.floor(rng() * houseCandidates.length);
    const pos = houseCandidates[idx];
    houseCandidates.splice(idx, 1);
    rows[pos.y][pos.x] = "building";
    chosenHouses.push(pos);
  }

  // fallback paranoico: se per qualche motivo non abbiamo potuto piazzare case
  if (chosenHouses.length === 0) {
    outer: for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (rows[y][x] === "grass") {
          rows[y][x] = "building";
          break outer;
        }
      }
    }
  }

  // alberi
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

  // slow
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

  // shop: come prima, sempre vicino alla strada
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
    const targetShops = Math.min(
      Math.max(minShops, maxShops),
      shopCandidates.length
    );

    const chosen: Position[] = [];
    while (chosen.length < targetShops && shopCandidates.length > 0) {
      const idx = Math.floor(rng() * shopCandidates.length);
      const candidate = shopCandidates[idx];
      shopCandidates.splice(idx, 1);
      rows[candidate.y][candidate.x] = "shop";
      chosen.push(candidate);
    }
  }

  // ===== NUOVO: ostacoli soft SOLO su road =====
  // probabilità basse ma scalano leggermente con il livello
  const softBase = 0.04;
  const softPerLevel = 0.01;
  const leafBase = 0.06;
  const leafPerLevel = 0.005;

  const softChance = Math.min(
    softBase + Math.max(level - 1, 0) * softPerLevel,
    0.15
  );
  const leafChance = Math.min(
    leafBase + Math.max(level - 1, 0) * leafPerLevel,
    0.2
  );

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rows[y][x] !== "road") continue;

      const roll = rng();

      if (roll < softChance) {
        // scegli un ostacolo soft a caso
        const r2 = rng();
        if (r2 < 1 / 3) {
          rows[y][x] = "pothole";
        } else if (r2 < 2 / 3) {
          rows[y][x] = "rock";
        } else {
          rows[y][x] = "bench";
        }
      } else if (roll < softChance + leafChance) {
        rows[y][x] = "leaf";
      }
    }
  }

  return rows;
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
    tile === "building" ||
    tile === "pothole" ||
    tile === "rock" ||
    tile === "bench" ||
    tile === "leaf"
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

export function getStatusMalusMessage(state: GameState): string {
  const { map, riderPosition } = state;
  const row = map[riderPosition.y];
  const tile = row ? row[riderPosition.x] : undefined;

  switch (tile) {
    case "pothole":
      return "⚠️ Pothole ahead: small time penalty.";
    case "rock":
      return "🪨 Rock on the road: slight slowdown.";
    case "bench":
      return "🪑 Bench in the way: small slowdown.";
    case "leaf":
      return "🍂 Slippery leaves: small time loss (chance).";
    case "tree":
      return "🌳 Tree collision: heavy time and coin penalty.";
    case "coffee":
      return "☕ Coffee tile: bonus coins and time.";
    case "slow":
      return "🌫️ Slow ground: steps cost more distance.";
    default:
      return "✅ No active maluses. Ride safe.";
  }
}

export function getTileMalusPopupLabel(
  tile: TileType | null | undefined
): string | null {
  switch (tile) {
    case "pothole":
      return "⚠️ Pothole · small time penalty";
    case "rock":
      return "🪨 Rock · slight slowdown";
    case "bench":
      return "🪑 Bench · small slowdown";
    case "leaf":
      return "🍂 Leaves · small time loss (chance)";
    case "tree":
      return "🌳 Tree · heavy time & coin loss";
    case "coffee":
      return "☕ Coffee · bonus coins & time";
    case "slow":
      return "🌫️ Slow ground · slower steps";
    default:
      return null;
  }
}
