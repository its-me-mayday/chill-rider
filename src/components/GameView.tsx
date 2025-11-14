import { useEffect, useRef, useState } from "react";
import {
  type Direction,
  type Position,
  type TileType,
  type GameState,
} from "../engine/localEngine";
import { useGame } from "../hooks/useGame";
import { HudBar } from "./HudBar";
import { MapView } from "./MapView";
import { HelpPanel } from "./HelpPanel";
import { IntroOverlay } from "./IntroOverlay";
import { PauseOverlay } from "./PauseOverlay";
import type { PackageItem, PackageColor } from "../types/Package";

type UiPhase = "intro" | "playing" | "paused";
export type Skin = "rider" | "dustin";
export type Theme = "chill" | "hawkins";

type HouseMarker = {
  position: Position;
  color: PackageColor;
  packageId: string;
};

type RewardPopup = {
  id: string;
  text: string;
  x: number;
  y: number;
  variant: "coins" | "coffee" | "level";
};

const DELIVERIES_PER_LEVEL = 5;
const DELIVERY_COIN_REWARD = 3;

export function GameView() {
  const { game, move, newMap, addCoins, completeDelivery } = useGame();

  const tilesX = game.options.width;
  const tilesY = game.options.height;

  const viewportWidth =
    typeof window !== "undefined" ? window.innerWidth : 1024;
  const viewportHeight =
    typeof window !== "undefined" ? window.innerHeight : 768;

  // leave some room for HUD + inventory
  const maxMapWidth = viewportWidth - 200;
  const maxMapHeight = viewportHeight - 220;

  const rawTileSize = Math.min(
    maxMapWidth / tilesX,
    maxMapHeight / tilesY
  );

  const tileSize = Math.max(24, Math.floor(rawTileSize));
  const mapPixelWidth = tilesX * tileSize;
  const mapPixelHeight = tilesY * tileSize;

  const [recentDelivery, setRecentDelivery] = useState(false);
  const [recentLevelUp, setRecentLevelUp] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [uiPhase, setUiPhase] = useState<UiPhase>("intro");
  const [selectedSkin, setSelectedSkin] = useState<Skin>("rider");

  const [inventory, setInventory] = useState<PackageItem[]>([]);
  const [houses, setHouses] = useState<HouseMarker[]>([]);
  const [packagesSpawnedThisLevel, setPackagesSpawnedThisLevel] =
    useState(0);

  const [rewardPopups, setRewardPopups] = useState<RewardPopup[]>([]);

  const prevDeliveriesRef = useRef(game.deliveries);
  const prevLevelRef = useRef(game.level);
  const prevCoinsRef = useRef(game.coinsCollected);
  const prevPositionRef = useRef<Position>(game.riderPosition);
  const levelRef = useRef(game.level);

  const theme: Theme =
    selectedSkin === "dustin" ? "hawkins" : "chill";

  const rootClass =
    theme === "hawkins"
      ? "relative flex h-screen w-screen flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-black to-slate-950 text-slate-100"
      : "relative flex h-screen w-screen flex-col items-center justify-center bg-gradient-to-b from-sky-100 via-sky-200 to-emerald-200 text-slate-900";

  const bottomGlowClass =
    theme === "hawkins"
      ? "absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-red-900/90 via-red-900/0 to-transparent"
      : "absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-emerald-300/90 via-emerald-200/0 to-transparent";

  const activePackage = inventory[0] ?? null;
  const targetHouse = activePackage
    ? houses.find((h) => h.packageId === activePackage.id)
    : null;
  const targetHousePosition = targetHouse ? targetHouse.position : null;

  // ---------- reward popups ----------

  function spawnRewardPopup(
    text: string,
    variant: "coins" | "coffee" | "level"
  ) {
    const centerX = game.riderPosition.x * tileSize + tileSize / 2;
    const centerY = game.riderPosition.y * tileSize + tileSize / 2;

    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    const popup: RewardPopup = {
      id,
      text,
      x: centerX,
      y: centerY,
      variant,
    };

    setRewardPopups((prev) => [...prev, popup]);

    setTimeout(() => {
      setRewardPopups((prev) => prev.filter((p) => p.id !== id));
    }, 800);
  }

  // ---------- houses & packages ----------

  function findFreeBuildingPosition(
    map: TileType[][],
    currentHouses: HouseMarker[]
  ): Position | null {
    const candidates: Position[] = [];

    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[0].length; x++) {
        if (map[y][x] !== "building") continue;

        const alreadyUsed = currentHouses.some(
          (h) => h.position.x === x && h.position.y === y
        );
        if (!alreadyUsed) {
          candidates.push({ x, y });
        }
      }
    }

    if (!candidates.length) return null;

    const idx = Math.floor(Math.random() * candidates.length);
    return candidates[idx];
  }

  function pickPackage(currentGame: GameState) {
    // limit packages per level
    if (packagesSpawnedThisLevel >= DELIVERIES_PER_LEVEL) return;

    // only one active package / delivery at a time
    if (inventory.length > 0 || houses.length > 0) return;

    const colors: PackageColor[] = [
      "red",
      "blue",
      "green",
      "yellow",
      "purple",
    ];
    const color =
      colors[Math.floor(Math.random() * colors.length)];

    const position = findFreeBuildingPosition(currentGame.map, houses);
    if (!position) {
      return;
    }

    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    const pkg: PackageItem = {
      id,
      color,
    };

    setInventory((prev) => [...prev, pkg]);
    setHouses((prev) => [
      ...prev,
      { position, color: pkg.color, packageId: pkg.id },
    ]);
    setPackagesSpawnedThisLevel((count) => count + 1);
  }

  function deliverPackage(house: HouseMarker) {
    // remove package from inventory
    setInventory((prev) =>
      prev.filter((p) => p.id !== house.packageId)
    );
    // remove marker so building becomes solid again
    setHouses((prev) =>
      prev.filter((h) => h.packageId !== house.packageId)
    );

    addCoins(DELIVERY_COIN_REWARD);
    completeDelivery();
  }

  // ---------- effects: coins / deliveries / level up ----------

  // coins change → popup +X coins (for coins, coffee, delivery)
  useEffect(() => {
    if (game.coinsCollected > prevCoinsRef.current) {
      const gained = game.coinsCollected - prevCoinsRef.current;
      spawnRewardPopup(
        `+${gained} coin${gained > 1 ? "s" : ""}`,
        "coins"
      );
    }
    prevCoinsRef.current = game.coinsCollected;
  }, [game.coinsCollected]);

  // deliveries banner
  useEffect(() => {
    if (game.deliveries > prevDeliveriesRef.current) {
      setRecentDelivery(true);
      const timeout = setTimeout(() => {
        setRecentDelivery(false);
      }, 900);
      prevDeliveriesRef.current = game.deliveries;
      return () => clearTimeout(timeout);
    }
    prevDeliveriesRef.current = game.deliveries;
  }, [game.deliveries]);

  // level up banner + popup
  useEffect(() => {
    if (game.level > prevLevelRef.current) {
      setRecentLevelUp(true);
      spawnRewardPopup(`Level ${game.level}!`, "level");

      const timeout = setTimeout(() => {
        setRecentLevelUp(false);
      }, 1100);

      prevLevelRef.current = game.level;
      return () => clearTimeout(timeout);
    }
    prevLevelRef.current = game.level;
  }, [game.level]);

  // reset per-level package state on level change
  useEffect(() => {
    if (game.level !== levelRef.current) {
      levelRef.current = game.level;
      setPackagesSpawnedThisLevel(0);
      setHouses([]);
      setInventory([]);
    }
  }, [game.level]);

  // ---------- rider movement: shop + coffee + houses ----------

  useEffect(() => {
    const prev = prevPositionRef.current;
    const current = game.riderPosition;

    if (prev.x === current.x && prev.y === current.y) {
      return;
    }

    const tile = game.map[current.y][current.x];

    if (tile === "coffee") {
      // distance / coins effect is handled in engine; we just show popup
      spawnRewardPopup("Coffee break!", "coffee");
    }

    if (tile === "shop") {
      pickPackage(game);
    }

    const house = houses.find(
      (h) =>
        h.position.x === current.x && h.position.y === current.y
    );
    if (house) {
      deliverPackage(house);
    }

    prevPositionRef.current = current;
  }, [game.riderPosition, game.map, houses]);

  // ---------- keyboard ----------

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "h" || e.key === "H") {
        setShowHelp((prev) => !prev);
        return;
      }

      // when help is open, ignore other controls
      if (showHelp) {
        return;
      }

      if (e.key === "Enter" || e.key === " ") {
        if (uiPhase === "intro") {
          setUiPhase("playing");
        }
        return;
      }

      if (e.key === "p" || e.key === "P" || e.key === "Escape") {
        if (uiPhase === "playing") {
          setUiPhase("paused");
        } else if (uiPhase === "paused") {
          setUiPhase("playing");
        }
        return;
      }

      const direction = keyToDirection(e.key);
      if (!direction) return;
      if (uiPhase !== "playing") return;

      const nextPos = getNextPosition(game.riderPosition, direction);
      if (!isInsideMap(nextPos, game.map)) {
        return;
      }

      const tile = game.map[nextPos.y][nextPos.x];

      // buildings are walls unless they are the active delivery house
      if (tile === "building") {
        const hasDeliveryHere = houses.some(
          (h) =>
            h.position.x === nextPos.x &&
            h.position.y === nextPos.y
        );
        if (!hasDeliveryHere) {
          return;
        }
      }

      move(direction);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    move,
    uiPhase,
    showHelp,
    game.riderPosition,
    game.map,
    houses,
  ]);

  // ---------- UI handlers ----------

  function handleStartRide() {
    setUiPhase("playing");
  }

  function handlePauseToggle() {
    setUiPhase((prev) => (prev === "paused" ? "playing" : "paused"));
  }

  function handleNewMap() {
    newMap();
    setInventory([]);
    setHouses([]);
    setPackagesSpawnedThisLevel(0);
  }

  function handleEndRun() {
    handleNewMap();
    setUiPhase("intro");
  }

  const isIntro = uiPhase === "intro";
  const isPaused = uiPhase === "paused";

  // ---------- render ----------

  return (
    <div className={rootClass}>
      <div className={bottomGlowClass} />

      {recentDelivery && uiPhase === "playing" && (
        <div className="pointer-events-none fixed top-6 right-6 z-30 rounded-xl bg-white/90 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-lg backdrop-blur">
          Delivery completed!
        </div>
      )}

      {recentLevelUp && uiPhase === "playing" && (
        <div className="pointer-events-none fixed top-16 right-6 z-30 rounded-xl bg-sky-500/95 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur">
          Level up!
        </div>
      )}

      <HudBar
        level={game.level}
        distance={game.distance}
        deliveries={game.deliveries}
        coins={game.coinsCollected}
        theme={theme}
      />

      <div className="z-10 flex items-start gap-4">
        <div
          className="relative"
          style={{ width: mapPixelWidth, height: mapPixelHeight }}
        >
          <MapView
            map={game.map}
            riderPosition={game.riderPosition}
            coins={game.coins}
            facing={game.facing}
            skin={selectedSkin}
            tileSize={tileSize}
            width={mapPixelWidth}
            height={mapPixelHeight}
            theme={theme}
            houses={houses}
            targetHousePosition={targetHousePosition}
          />

          {rewardPopups.map((popup) => {
            let colorClasses = "";

            if (popup.variant === "coins") {
              colorClasses =
                "bg-amber-400/95 text-slate-900 border-amber-200";
            } else if (popup.variant === "coffee") {
              colorClasses =
                "bg-rose-500/95 text-white border-rose-200";
            } else if (popup.variant === "level") {
              colorClasses =
                "bg-sky-500/95 text-white border-sky-200";
            }

            const popupClass =
              "reward-popup absolute -translate-x-1/2 text-xs font-semibold px-2 py-1 rounded-full border shadow " +
              colorClasses;

            return (
              <div
                key={popup.id}
                className={popupClass}
                style={{
                  left: popup.x,
                  top: popup.y - 10,
                }}
              >
                {popup.text}
              </div>
            );
          })}
        </div>

        {/* Inventory panel */}
        <div className="w-40 rounded-2xl border border-slate-700 bg-slate-900/80 p-3 text-xs text-slate-100 shadow-lg">
          <div className="mb-2 text-center text-sm font-semibold tracking-[0.18em] uppercase text-slate-300">
            Inventory
          </div>
          <div className="grid gap-2">
            {Array.from({ length: 5 }).map((_, i) => {
              const item = inventory[i];
              return (
                <div
                  key={i}
                  className="flex h-10 items-center justify-center rounded-lg bg-slate-800/70"
                  style={{
                    border: item
                      ? "2px solid rgba(248, 250, 252, 0.95)"
                      : "1px dashed rgba(148, 163, 184, 0.8)",
                  }}
                >
                  {item ? (
                    <div
                      className="h-5 w-5 rounded-sm shadow"
                      style={{
                        backgroundColor: colorForPackage(
                          item.color,
                          theme
                        ),
                      }}
                    />
                  ) : (
                    <span className="text-[0.65rem] text-slate-500">
                      Empty
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="z-10 mt-4 flex gap-3">
        <button
          className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-600 hover:shadow-lg"
          onClick={handleNewMap}
        >
          New map
        </button>
        <button
          className={`rounded-full px-5 py-2 text-sm font-semibold shadow-md transition ${
            showHelp
              ? "bg-sky-600 text-white hover:bg-sky-700"
              : "bg-white/80 text-sky-700 hover:bg-white"
          }`}
          onClick={() => setShowHelp((prev) => !prev)}
        >
          Help (H)
        </button>
        <button
          className={`rounded-full px-5 py-2 text-sm font-semibold shadow-md transition ${
            isPaused
              ? "bg-emerald-600 text-white hover:bg-emerald-700"
              : "bg-slate-900/80 text-slate-50 hover:bg-slate-900"
          }`}
          onClick={handlePauseToggle}
        >
          {isPaused ? "Resume (P)" : "Pause (P)"}
        </button>
      </div>

      <HelpPanel visible={showHelp} />

      <IntroOverlay
        visible={isIntro}
        selectedSkin={selectedSkin}
        onSelectSkin={setSelectedSkin}
        onStartRide={handleStartRide}
        onShowHelp={() => setShowHelp(true)}
      />

      <PauseOverlay
        visible={isPaused}
        level={game.level}
        distance={game.distance}
        deliveries={game.deliveries}
        coins={game.coinsCollected}
        onResume={handlePauseToggle}
        onEndRun={handleEndRun}
      />

      <p className="z-10 mt-2 text-[0.7rem] text-slate-700">
        Ride into a shop to grab a package, follow the matching colored
        building, deliver, earn coins and level up the city.
      </p>
    </div>
  );
}

function keyToDirection(key: string): Direction | null {
  switch (key) {
    case "ArrowUp":
    case "w":
    case "W":
      return "up";
    case "ArrowDown":
    case "s":
    case "S":
      return "down";
    case "ArrowLeft":
    case "a":
    case "A":
      return "left";
    case "ArrowRight":
    case "d":
    case "D":
      return "right";
    default:
      return null;
  }
}

function colorForPackage(color: PackageColor, theme: Theme): string {
  if (theme === "hawkins") {
    switch (color) {
      case "red":
        return "#b91c1c";
      case "blue":
        return "#1d4ed8";
      case "green":
        return "#15803d";
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
