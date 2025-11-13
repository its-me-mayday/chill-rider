import {
  type Direction,
  type Position,
  type TileType,
} from "../engine/localEngine";
import { RiderSprite } from "./RiderSprite";
import { GoalSprite } from "./GoalSprite";
import { CoinSprite } from "./CoinSprite";
import type { Skin, Theme } from "./GameView";

type MapViewProps = {
  map: TileType[][];
  riderPosition: Position;
  goalPosition: Position;
  coins: Position[];
  facing: Direction;
  skin: Skin;
  tileSize: number;
  width: number;
  height: number;
  theme: Theme;
};

export function MapView({
  map,
  riderPosition,
  goalPosition,
  coins,
  facing,
  skin,
  tileSize,
  width,
  height,
  theme,
}: MapViewProps) {
  const frameClass =
    theme === "hawkins"
      ? "map-glow z-10 inline-block overflow-hidden rounded-2xl border border-red-500/60 bg-slate-950"
      : "map-glow z-10 inline-block overflow-hidden rounded-2xl border border-slate-400/40 bg-slate-900";

  const buildingSprite = buildingSpriteForTheme(theme);
  const treeSprite = treeSpriteForTheme(theme);
  const slowSprite = slowSpriteForTheme(theme);
  const shopSprite = shopSpriteForTheme(theme);

  return (
    <div
      className={frameClass}
      style={{
        width,
        height,
      }}
    >
      {map.map((row, y) => (
        <div key={y} className="flex">
          {row.map((tile, x) => {
            const isRider =
              riderPosition.x === x && riderPosition.y === y;
            const isGoal =
              goalPosition.x === x && goalPosition.y === y;
            const isCoin = coins.some(
              (c) => c.x === x && c.y === y
            );
            const isBuilding = tile === "building";
            const isTree = tile === "tree";
            const isSlow = tile === "slow";
            const isShop = tile === "shop";

            return (
              <div
                key={x}
                className="relative"
                style={{ width: tileSize, height: tileSize }}
              >
                <div className={tileToClass(tile, theme)} />

                {isSlow && (
                  <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                    <img
                      src={slowSprite}
                      alt="dirt"
                      style={{
                        width: "120%",
                        height: "120%",
                        imageRendering: "pixelated",
                      }}
                    />
                  </div>
                )}

                {isBuilding && (
                  <div className="absolute inset-[10%] flex items-center justify-center">
                    <img
                      src={buildingSprite}
                      alt="building"
                      style={{
                        width: "100%",
                        height: "100%",
                        imageRendering: "pixelated",
                      }}
                    />
                  </div>
                )}

                {isTree && (
                  <div className="absolute inset-[12%] flex items-center justify-center">
                    <img
                      src={treeSprite}
                      alt="tree"
                      style={{
                        width: "100%",
                        height: "100%",
                        imageRendering: "pixelated",
                      }}
                    />
                  </div>
                )}

                {isShop && (
                  <div className="absolute inset-[10%] flex items-center justify-center">
                    <img
                      src={shopSprite}
                      alt="shop"
                      style={{
                        width: "100%",
                        height: "100%",
                        imageRendering: "pixelated",
                      }}
                    />
                  </div>
                )}

                {isCoin && (
                  <div className="absolute inset-[22%] flex items-center justify-center">
                    <CoinSprite size={tileSize * 0.5} />
                  </div>
                )}

                {isGoal && (
                  <div className="absolute inset-[18%] flex items-center justify-center">
                    <GoalSprite size={tileSize * 0.6} />
                  </div>
                )}

                {isRider && (
                  <div className="absolute inset-[12%] flex items-center justify-center">
                    <RiderSprite
                      size={tileSize * 0.7}
                      direction={facing}
                      skin={skin}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function buildingSpriteForTheme(theme: Theme): string {
  const prefix = theme === "hawkins" ? "hawkins" : "chill";
  return `/chill-rider/tiles/${prefix}-building.png`;
}

function treeSpriteForTheme(theme: Theme): string {
  const prefix = theme === "hawkins" ? "hawkins" : "chill";
  return `/chill-rider/tiles/${prefix}-tree.png`;
}

function slowSpriteForTheme(theme: Theme): string {
  const prefix = theme === "hawkins" ? "hawkins" : "chill";
  return `/chill-rider/tiles/${prefix}-slow.png`;
}

function shopSpriteForTheme(theme: Theme): string {
  const prefix = theme === "hawkins" ? "hawkins" : "chill";
  return `/chill-rider/tiles/${prefix}-shop.png`;
}

function tileToClass(tile: TileType, theme: Theme): string {
  const base = "h-full w-full";

  if (theme === "hawkins") {
    switch (tile) {
      case "road":
        return `${base} bg-gradient-to-b from-slate-900 to-slate-800`;
      case "grass":
        return `${base} bg-gradient-to-b from-emerald-950 to-emerald-800`;
      case "tree":
        return `${base} bg-gradient-to-b from-emerald-900 to-emerald-950`;
      case "shop":
        return `${base} bg-gradient-to-b from-emerald-900 to-emerald-950`;
      case "building":
        return `${base} bg-gradient-to-b from-emerald-900 to-emerald-950`;
      case "slow":
        return `${base} bg-slate-900`;
      case "coffee":
        return `${base} bg-gradient-to-b from-amber-900 to-rose-800`;
      default:
        return `${base} bg-black`;
    }
  }

  switch (tile) {
    case "road":
      return `${base} bg-gradient-to-b from-slate-100 to-slate-300`;
    case "grass":
      return `${base} bg-gradient-to-b from-emerald-200 to-emerald-300`;
    case "tree":
      return `${base} bg-gradient-to-b from-emerald-300 to-emerald-500`;
    case "shop":
      return `${base} bg-gradient-to-b from-emerald-300 to-emerald-400`;
    case "building":
      return `${base} bg-gradient-to-b from-emerald-300 to-emerald-400`;
    case "slow":
      return `${base} bg-amber-200`;
    case "coffee":
      return `${base} bg-gradient-to-b from-amber-300 to-orange-400`;
    default:
      return `${base} bg-slate-900`;
  }
}
