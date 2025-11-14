import {
  type Direction,
  type Position,
  type TileType,
} from "../engine/localEngine";
import { RiderSprite } from "./RiderSprite";
import { CoinSprite } from "./CoinSprite";
import type { Skin, Theme } from "./GameView";
import type { PackageColor } from "../types/Package";

type HouseMarker = {
  position: Position;
  color: PackageColor;
  packageId: string;
};

type MapViewProps = {
  map: TileType[][];
  riderPosition: Position;
  coins: Position[];
  facing: Direction;
  skin: Skin;
  tileSize: number;
  width: number;
  height: number;
  theme: Theme;
  houses: HouseMarker[];
  targetHousePosition: Position | null;
};

export function MapView({
  map,
  riderPosition,
  coins,
  facing,
  skin,
  tileSize,
  width,
  height,
  theme,
  houses,
  targetHousePosition,
}: MapViewProps) {
  const frameClass =
    theme === "hawkins"
      ? "map-glow z-10 relative inline-block overflow-hidden rounded-2xl border border-red-500/60 bg-slate-950"
      : "map-glow z-10 relative inline-block overflow-hidden rounded-2xl border border-slate-400/40 bg-slate-900";

  const buildingSprite = buildingSpriteForTheme(theme);
  const treeSprite = treeSpriteForTheme(theme);
  const slowSprite = slowSpriteForTheme(theme);
  const shopSprite = shopSpriteForTheme(theme);

  const riderLeft = riderPosition.x * tileSize;
  const riderTop = riderPosition.y * tileSize;

  return (
    <div
      className={frameClass}
      style={{
        width,
        height,
      }}
    >
      {/* TILES */}
      {map.map((row, y) => (
        <div key={y} className="flex">
          {row.map((tile, x) => {
            const isCoin = coins.some(
              (c) => c.x === x && c.y === y
            );
            const isBuilding = tile === "building";
            const isTree = tile === "tree";
            const isSlow = tile === "slow";
            const isShop = tile === "shop";

            const houseMarker = houses.find(
              (h) =>
                h.position.x === x && h.position.y === y
            );
            const isTargetHouse =
              targetHousePosition &&
              targetHousePosition.x === x &&
              targetHousePosition.y === y;

            return (
              <div
                key={x}
                className="relative"
                style={{ width: tileSize, height: tileSize }}
              >
                {/* base tile */}
                <div
                  className={tileToClass(
                    tile,
                    theme,
                    Boolean(isTargetHouse)
                  )}
                />

                {/* slow dirt */}
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

                {/* trees */}
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

                {/* shops */}
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

                {/* buildings */}
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

                {/* overlay colorata per le houses legate a pacchi */}
                {houseMarker && (
                  <div
                    className="absolute inset-[14%] rounded-lg opacity-70 mix-blend-screen"
                    style={{
                      backgroundColor: houseColorOverlay(
                        houseMarker.color,
                        theme
                      ),
                    }}
                  />
                )}

                {/* target house super evidente */}
                {isTargetHouse && (
                  <>
                    <div className="pointer-events-none absolute inset-[4%] rounded-xl ring-2 ring-amber-300/80 shadow-[0_0_20px_rgba(251,191,36,0.7)] animate-pulse" />
                    <div className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 text-[0.55rem] font-bold text-amber-200 drop-shadow">
                      ★
                    </div>
                  </>
                )}

                {/* coins */}
                {isCoin && (
                  <div className="absolute inset-[22%] flex items-center justify-center">
                    <CoinSprite size={tileSize * 0.5} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* RIDER overlay, con movimento smooth */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: riderLeft,
          top: riderTop,
          width: tileSize,
          height: tileSize,
          transition: "left 140ms ease-out, top 140ms ease-out",
        }}
      >
        <div className="absolute inset-[12%] flex items-center justify-center">
          <RiderSprite
            size={tileSize * 0.7}
            direction={facing}
            skin={skin}
          />
        </div>
      </div>
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

function tileToClass(
  tile: TileType,
  theme: Theme,
  isTargetHouse: boolean
): string {
  const base = "h-full w-full";

  if (theme === "hawkins") {
    if (isTargetHouse && tile === "building") {
      return `${base} bg-gradient-to-b from-amber-900 to-rose-900`;
    }
    switch (tile) {
      case "road":
        return `${base} bg-gradient-to-b from-slate-900 to-slate-800`;
      case "grass":
        return `${base} bg-gradient-to-b from-emerald-950 to-emerald-800`;
      case "tree":
      case "shop":
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

  if (isTargetHouse && tile === "building") {
    return `${base} bg-gradient-to-b from-amber-200 to-orange-300`;
  }

  switch (tile) {
    case "road":
      return `${base} bg-gradient-to-b from-slate-100 to-slate-300`;
    case "grass":
      return `${base} bg-gradient-to-b from-emerald-200 to-emerald-300`;
    case "tree":
      return `${base} bg-gradient-to-b from-emerald-300 to-emerald-500`;
    case "shop":
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

function houseColorOverlay(color: PackageColor, theme: Theme): string {
  if (theme === "hawkins") {
    switch (color) {
      case "red":
        return "#b91c1c";
      case "blue":
        return "#1d4ed8";
      case "green":
        return "#166534";
      case "yellow":
        return "#ca8a04";
      case "purple":
        return "#6d28d9";
    }
  }

  switch (color) {
    case "red":
      return "#f97373";
    case "blue":
      return "#60a5fa";
    case "green":
      return "#4ade80";
    case "yellow":
      return "#facc15";
    case "purple":
      return "#c4b5fd";
  }

  return "#ffffff";
}
