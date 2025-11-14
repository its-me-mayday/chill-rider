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
  pickupShopPosition: Position | null;
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
  pickupShopPosition,
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
            const isCoin = coins.some(
              (c) => c.x === x && c.y === y
            );
            const isBuilding = tile === "building";
            const isTree = tile === "tree";
            const isSlow = tile === "slow";
            const isShop = tile === "shop";

            const isTargetHouse =
              targetHousePosition &&
              targetHousePosition.x === x &&
              targetHousePosition.y === y;

            const isPickupShop =
              pickupShopPosition &&
              pickupShopPosition.x === x &&
              pickupShopPosition.y === y;

            const houseMarker = houses.find(
              (h) =>
                h.position.x === x && h.position.y === y
            );

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
                    {houseMarker && (
                      <div
                        className="absolute inset-0 rounded-md opacity-70 mix-blend-screen"
                        style={{
                          backgroundColor:
                            houseColorHex[houseMarker.color],
                        }}
                      />
                    )}
                    {isTargetHouse && (
                      <>
                        <div className="pointer-events-none absolute inset-[-14%] rounded-2xl border-4 border-amber-300/95 shadow-[0_0_30px_rgba(252,211,77,1)] animate-pulse" />
                        <div className="pointer-events-none absolute inset-[-6%] rounded-2xl bg-amber-300/18 blur-sm" />
                      </>
                    )}
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
                    {isPickupShop && (
                      <>
                        <div className="pointer-events-none absolute inset-[-16%] rounded-2xl border-4 border-sky-300/95 shadow-[0_0_32px_rgba(125,211,252,1)] animate-pulse" />
                        <div className="pointer-events-none absolute inset-[-8%] rounded-2xl bg-sky-300/22 blur-sm" />
                      </>
                    )}
                  </div>
                )}

                {isCoin && (
                  <div className="absolute inset-[22%] flex items-center justify-center">
                    <CoinSprite size={tileSize * 0.5} />
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

const houseColorHex: Record<PackageColor, string> = {
  red: "#f97373",
  blue: "#38bdf8",
  green: "#22c55e",
  yellow: "#eab308",
  purple: "#a855f7",
};

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
