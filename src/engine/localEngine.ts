export type TileType = "road" | "grass" | "tree" | "building" | "void";

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
  options: GameOptions;
  distance: number;
}

export type Command =
  | { type: "MOVE"; direction: Direction }
  | { type: "REGENERATE_MAP" };

export function createGame(options: GameOptions): GameState {
  const map = generateMap(options);

  const riderPosition: Position = {
    x: Math.floor(options.width / 2),
    y: Math.floor(options.height / 2),
  };

  return {
    map,
    riderPosition,
    options,
    distance: 0,
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
    default:
      return state;
  }
}

function moveRider(state: GameState, direction: Direction): GameState {
  const { riderPosition, map } = state;
  const target = getNextPosition(riderPosition, direction);

  if (!isInsideMap(target, map)) return state;

  const tile = map[target.y][target.x];
  if (!isWalkable(tile)) return state;

  return {
    ...state,
    riderPosition: target,
    distance: state.distance + 1,
  };
}

function regenerateMap(state: GameState): GameState {
  const map = generateMap(state.options);

  const riderPosition: Position = {
    x: Math.floor(state.options.width / 2),
    y: Math.floor(state.options.height / 2),
  };

  return {
    ...state,
    map,
    riderPosition,
    distance: 0,
  };
}

function generateMap(options: GameOptions): TileType[][] {
  const { width, height, seed } = options;
  const rng = createRng(seed ?? Date.now());

  const rows: TileType[][] = [];
  for (let y = 0; y < height; y++) {
    const row: TileType[] = [];
    for (let x = 0; x < width; x++) {
      row.push("grass");
    }
    rows.push(row);
  }

  const mainRoadY = Math.floor(height / 2);
  for (let x = 0; x < width; x++) {
    rows[mainRoadY][x] = "road";
    if (rng() < 0.15 && mainRoadY + 1 < height) {
      rows[mainRoadY + 1][x] = "road";
    }
  }

  const verticalRoadCount = Math.max(1, Math.floor(width / 6));
  for (let i = 0; i < verticalRoadCount; i++) {
    const x = Math.floor(((i + 1) * width) / (verticalRoadCount + 1));
    for (let y = 0; y < height; y++) {
      rows[y][x] = "road";
      if (rng() < 0.15 && x + 1 < width) {
        rows[y][x + 1] = "road";
      }
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rows[y][x] !== "road") continue;
      if (rng() < 0.25) {
        const dir = rng() < 0.5 ? -1 : 1;
        const by = y + dir;
        if (by >= 0 && by < height && rows[by][x] === "grass") {
          rows[by][x] = "building";
          if (rng() < 0.5) {
            const by2 = by + dir;
            if (
              by2 >= 0 &&
              by2 < height &&
              rows[by2][x] === "grass"
            ) {
              rows[by2][x] = "building";
            }
          }
        }
      }
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rows[y][x] !== "grass") continue;
      if (rng() < 0.12) {
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

  return rows;
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

function isInsideMap(pos: Position, map: TileType[][]): boolean {
  return (
    pos.y >= 0 &&
    pos.y < map.length &&
    pos.x >= 0 &&
    pos.x < map[0].length
  );
}

function isWalkable(tile: TileType): boolean {
  return tile === "road" || tile === "grass";
}

function createRng(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;

  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}
