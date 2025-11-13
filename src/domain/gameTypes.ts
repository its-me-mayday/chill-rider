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
}
