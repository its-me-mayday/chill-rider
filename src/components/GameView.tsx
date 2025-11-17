import { useEffect, useRef, useState } from "react";
import {
  type Direction,
  type Position,
  type TileType,
} from "../engine/localEngine";
import { useGame } from "../hooks/useGame";
import { HudBar } from "./HudBar";
import { MapView } from "./MapView";
import { HelpPanel } from "./HelpPanel";
import { IntroOverlay } from "./IntroOverlay";
import { PauseOverlay } from "./PauseOverlay";
import { InventoryPanel } from "./InventoryPanel";
import { RewardPopupsLayer } from "./RewardPopupsLayer";
import { RunSummaryOverlay } from "./RunSummaryOverlay";
import type {
  PackageItem,
  PackageColor,
  PackageKind,
} from "../types/Package";
import { sfx } from "./soundEffects";
import { bgm } from "./backgroundMusic";

type UiPhase = "intro" | "playing" | "paused" | "summary";
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

type RunSummary = {
  level: number;
  distance: number;
  deliveries: number;
  coins: number;
};

const DELIVERIES_PER_LEVEL = 5;
const DELIVERY_COIN_REWARD = 3;
const PERISHABLE_TIMEOUT_PENALTY = 3;

export function GameView() {
  const { game, move, newMap, addCoins, completeDelivery, resetGame } =
    useGame();

  const tilesX = game.options.width;
  const tilesY = game.options.height;

  const viewportWidth =
    typeof window !== "undefined" ? window.innerWidth : 1024;
  const viewportHeight =
    typeof window !== "undefined" ? window.innerHeight : 768;

  const maxMapWidth = viewportWidth - 200;
  const maxMapHeight = viewportHeight - 260;

  const rawTileSize = Math.min(maxMapWidth / tilesX, maxMapHeight / tilesY);
  const tileSize = Math.max(24, Math.floor(rawTileSize));
  const mapPixelWidth = tilesX * tileSize;
  const mapPixelHeight = tilesY * tileSize;

  const [recentDelivery, setRecentDelivery] = useState(false);
  const [recentLevelUp, setRecentLevelUp] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [uiPhase, setUiPhase] = useState<UiPhase>("intro");
  const [selectedSkin, setSelectedSkin] = useState<Skin>("rider");

  const [activePackageTimer, setActivePackageTimer] =
    useState<number | null>(null);

  const [inventory, setInventory] = useState<PackageItem[]>([]);
  const [houses, setHouses] = useState<HouseMarker[]>([]);
  const [packagesSpawnedThisLevel, setPackagesSpawnedThisLevel] =
    useState(0);

  const [rewardPopups, setRewardPopups] = useState<RewardPopup[]>([]);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [musicVolume, setMusicVolume] = useState(70);
  const [showSettings, setShowSettings] = useState(false);

  const [activeShopPosition, setActiveShopPosition] =
    useState<Position | null>(null);

  const [warningFlash, setWarningFlash] = useState(false);

  const prevDeliveriesRef = useRef(game.deliveries);
  const prevLevelRef = useRef(game.level);
  const prevCoinsRef = useRef(game.coinsCollected);
  const prevPositionRef = useRef<Position>(game.riderPosition);
  const levelRef = useRef(game.level);
  const prevDistanceRef = useRef(game.distance);

  const theme: Theme =
    selectedSkin === "dustin" ? "hawkins" : "chill";

  const rootClass =
    theme === "hawkins"
      ? "relative flex h-screen w-screen flex-col items-center justify-start pt-10 bg-gradient-to-b from-slate-900 via-black to-slate-950 text-slate-100"
      : "relative flex h-screen w-screen flex-col items-center justify-start pt-10 bg-gradient-to-b from-sky-100 via-sky-200 to-emerald-200 text-slate-900";

  const bottomGlowClass =
    theme === "hawkins"
      ? "absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-red-900/90 via-red-900/0 to-transparent"
      : "absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-emerald-300/90 via-emerald-200/0 to-transparent";

  const activePackage = inventory[0] ?? null;
  const targetHouse = activePackage
    ? houses.find((h) => h.packageId === activePackage.id)
    : null;
  const targetHousePosition = targetHouse ? targetHouse.position : null;

  const houseDirection = computeDirectionLabel(
    game.riderPosition,
    targetHousePosition
  );
  const shopDirection = computeDirectionLabel(
    game.riderPosition,
    activeShopPosition
  );

  const deliveriesThisLevel = game.deliveries % DELIVERIES_PER_LEVEL;

  const isIntro = uiPhase === "intro";
  const isPaused = uiPhase === "paused";
  const isSummary = uiPhase === "summary";

  let housesCount = 0;
  let shopsCount = 0;
  for (let y = 0; y < game.map.length; y++) {
    for (let x = 0; x < game.map[0].length; x++) {
      const tile = game.map[y][x];
      if (tile === "building") housesCount++;
      if (tile === "shop") shopsCount++;
    }
  }

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

  function pickPackage(currentGame: typeof game) {
    if (packagesSpawnedThisLevel >= DELIVERIES_PER_LEVEL) return;
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
    if (!position) return;

    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    const kind: PackageKind = decidePackageKind(currentGame.level);

    const pkg: PackageItem = {
      id,
      color,
      kind,
    };

    setInventory((prev) => [...prev, pkg]);
    setHouses((prev) => [
      ...prev,
      { position, color: pkg.color, packageId: pkg.id },
    ]);
    setPackagesSpawnedThisLevel((count) => count + 1);

    if (kind === "perishable") {
      setActivePackageTimer(initialPerishableTimer(currentGame.level));
    } else {
      setActivePackageTimer(null);
    }
  }

  function deliverPackage(house: HouseMarker) {
    setInventory((prev) =>
      prev.filter((p) => p.id !== house.packageId)
    );
    setHouses((prev) =>
      prev.filter((h) => h.packageId !== house.packageId)
    );

    if (activePackage && activePackage.id === house.packageId) {
      setActivePackageTimer(null);
    }

    addCoins(DELIVERY_COIN_REWARD);
    completeDelivery();

    if (sfxEnabled) {
      sfx.playDelivery(theme);
    }

    if (packagesSpawnedThisLevel < DELIVERIES_PER_LEVEL) {
      const nextShop = pickRandomShop(game.map);
      if (nextShop) {
        setActiveShopPosition(nextShop);
      } else {
        setActiveShopPosition(null);
      }
    } else {
      setActiveShopPosition(null);
    }
  }

  useEffect(() => {
    if (game.coinsCollected > prevCoinsRef.current) {
      const gained = game.coinsCollected - prevCoinsRef.current;

      spawnRewardPopup(
        `+${gained} coin${gained > 1 ? "s" : ""}`,
        "coins"
      );

      if (sfxEnabled) {
        sfx.playCoin(theme);
      }
    }
    prevCoinsRef.current = game.coinsCollected;
  }, [game.coinsCollected, sfxEnabled, theme]);

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

  useEffect(() => {
    if (game.level > prevLevelRef.current) {
      setRecentLevelUp(true);
      spawnRewardPopup(`Level ${game.level}!`, "level");

      const timeout = setTimeout(() => {
        setRecentLevelUp(false);
      }, 1400);

      prevLevelRef.current = game.level;
      return () => clearTimeout(timeout);
    }
    prevLevelRef.current = game.level;
  }, [game.level]);

  useEffect(() => {
    if (game.level !== levelRef.current) {
      levelRef.current = game.level;
      setPackagesSpawnedThisLevel(0);
      setHouses([]);
      setInventory([]);
      setActiveShopPosition(null);
      setActivePackageTimer(null);
    }
  }, [game.level]);

  useEffect(() => {
    const prev = prevPositionRef.current;
    const current = game.riderPosition;

    if (prev.x === current.x && prev.y === current.y) {
      return;
    }

    const tile = game.map[current.y][current.x];

    if (tile === "coffee") {
      spawnRewardPopup("Coffee break!", "coffee");
    }

    if (tile === "shop") {
      const isActiveShop =
        activeShopPosition &&
        activeShopPosition.x === current.x &&
        activeShopPosition.y === current.y;

      if (isActiveShop) {
        if (sfxEnabled) {
          sfx.playShop(theme);
        }
        pickPackage(game);
        setActiveShopPosition(null);
      }
    }

    const house = houses.find(
      (h) =>
        h.position.x === current.x && h.position.y === current.y
    );
    if (house) {
      deliverPackage(house);
    }

    prevPositionRef.current = current;
  }, [
    game.riderPosition,
    game.map,
    houses,
    sfxEnabled,
    theme,
    game,
    activeShopPosition,
  ]);

  useEffect(() => {
    if (
      inventory.length === 0 &&
      houses.length === 0 &&
      packagesSpawnedThisLevel < DELIVERIES_PER_LEVEL &&
      !activeShopPosition
    ) {
      const shop = pickRandomShop(game.map);
      if (shop) {
        setActiveShopPosition(shop);
      }
    }
  }, [
    inventory.length,
    houses.length,
    packagesSpawnedThisLevel,
    activeShopPosition,
    game.map,
  ]);

  // distance-based perishable timer
  useEffect(() => {
    const prev = prevDistanceRef.current;
    const current = game.distance;

    if (current <= prev) {
      prevDistanceRef.current = current;
      return;
    }

    const movedSteps = current - prev;
    prevDistanceRef.current = current;

    if (!activePackage) return;
    if (activePackage.kind !== "perishable") return;
    if (activePackageTimer === null) return;

    setActivePackageTimer((currentTimer) => {
      if (currentTimer === null) return currentTimer;
      const next = currentTimer - movedSteps;
      return next > 0 ? next : 0;
    });
  }, [game.distance, activePackage, activePackageTimer]);

  // subtle red flash when timer is low
  useEffect(() => {
    if (!activePackage || activePackage.kind !== "perishable") {
      setWarningFlash(false);
      return;
    }

    if (
      activePackageTimer !== null &&
      activePackageTimer > 0 &&
      activePackageTimer <= 3
    ) {
      setWarningFlash(true);
    } else {
      setWarningFlash(false);
    }
  }, [activePackage, activePackageTimer]);

  // penalty on perishable timeout
  useEffect(() => {
    if (!activePackage) return;
    if (activePackage.kind !== "perishable") return;
    if (activePackageTimer === null || activePackageTimer > 0) return;

    const expiredId = activePackage.id;

    setInventory((prev) => prev.filter((p) => p.id !== expiredId));
    setHouses((prev) => prev.filter((h) => h.packageId !== expiredId));
    setActivePackageTimer(null);

    addCoins(-PERISHABLE_TIMEOUT_PENALTY);
    spawnRewardPopup(
      `-${PERISHABLE_TIMEOUT_PENALTY} (expired)`,
      "coins"
    );
  }, [activePackage, activePackageTimer, addCoins]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (uiPhase === "summary") {
        return;
      }

      if (e.key === "h" || e.key === "H") {
        setShowHelp((prev) => !prev);
        return;
      }

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

      const rawNextPos = getNextPosition(
        game.riderPosition,
        direction
      );
      const nextPos = wrapPosition(rawNextPos, game.map);

      const tile = game.map[nextPos.y][nextPos.x];

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

  useEffect(() => {
    if (musicEnabled) {
      bgm.play(theme);
    } else {
      bgm.stop();
    }
  }, [musicEnabled, theme]);

  useEffect(() => {
    const normalized = musicVolume / 100;
    bgm.setVolume(normalized);
  }, [musicVolume]);

  useEffect(() => {
    return () => {
      bgm.stop();
    };
  }, []);

  function handleStartRide() {
    setUiPhase("playing");
  }

  function handlePauseToggle() {
    setUiPhase((prev) =>
      prev === "paused" ? "playing" : "paused"
    );
  }

  function handleNewMap() {
    newMap();
    setInventory([]);
    setHouses([]);
    setPackagesSpawnedThisLevel(0);
    setActiveShopPosition(null);
    setActivePackageTimer(null);
  }

  function handleEndRun() {
    setRunSummary({
      level: game.level,
      distance: game.distance,
      deliveries: game.deliveries,
      coins: game.coinsCollected,
    });
    setUiPhase("summary");
  }

  function handleSummaryPlayAgain() {
    resetGame();
    setInventory([]);
    setHouses([]);
    setPackagesSpawnedThisLevel(0);
    setActiveShopPosition(null);
    setRunSummary(null);
    setActivePackageTimer(null);
    setUiPhase("playing");
  }

  function handleSummaryBackToTitle() {
    resetGame();
    setInventory([]);
    setHouses([]);
    setPackagesSpawnedThisLevel(0);
    setActiveShopPosition(null);
    setRunSummary(null);
    setActivePackageTimer(null);
    setUiPhase("intro");
  }

  return (
    <div className={rootClass}>
      <div className={bottomGlowClass} />

      {warningFlash && (
        <div className="pointer-events-none absolute inset-0 z-0 animate-pulse bg-red-500/8" />
      )}

      {/* CENTERED LEVEL-UP ANIMATION */}
      {recentLevelUp && uiPhase === "playing" && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
          <div className="animate-[bounce_0.8s_ease-out] rounded-3xl border border-amber-400/80 bg-black/70 px-10 py-6 text-center shadow-2xl backdrop-blur">
            <div className="text-[0.7rem] uppercase tracking-[0.2em] text-amber-200/80">
              Level Up
            </div>
            <div className="mt-1 text-3xl font-extrabold text-amber-300 drop-shadow">
              Level {game.level}
            </div>
            <div className="mt-1 text-sm text-amber-100/90">
              New roads, shops and fresh deliveries unlocked.
            </div>
          </div>
        </div>
      )}

      {recentDelivery && uiPhase === "playing" && (
        <div className="pointer-events-none fixed top-6 right-6 z-30 rounded-xl bg-white/90 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-lg backdrop-blur">
          Delivery completed!
        </div>
      )}

      <div className="z-10 mb-3 flex w-full max-w-5xl items-start justify-center gap-4">
        <HudBar
          level={game.level}
          distance={game.distance}
          deliveries={game.deliveries}
          coins={game.coinsCollected}
          theme={theme}
          targetColor={activePackage ? activePackage.color : null}
          deliveriesThisLevel={deliveriesThisLevel}
          deliveriesPerLevel={DELIVERIES_PER_LEVEL}
          housesCount={housesCount}
          shopsCount={shopsCount}
          houseDirection={houseDirection}
          shopDirection={shopDirection}
          targetTimer={
            activePackage && activePackage.kind === "perishable"
              ? activePackageTimer
              : null
          }
        />

        <div className="mt-1 rounded-2xl border border-slate-300/70 bg-white/90 px-3 py-3 text-[0.7rem] text-slate-800 shadow-sm backdrop-blur-sm">
          <div className="mb-2 text-center text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Session controls
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              className="rounded-full bg-emerald-500 px-3 py-1 font-semibold text-white shadow-sm transition hover:bg-emerald-600"
              onClick={handleNewMap}
            >
              New map
            </button>
            <button
              className={`rounded-full px-3 py-1 font-semibold shadow-sm transition ${
                showHelp
                  ? "bg-sky-600 text-white hover:bg-sky-700"
                  : "bg-slate-100 text-sky-700 hover:bg-white"
              }`}
              onClick={() => setShowHelp((prev) => !prev)}
            >
              Help (H)
            </button>
            <button
              className="rounded-full bg-slate-200 px-3 py-1 font-semibold text-slate-800 shadow-sm transition hover:bg-slate-300"
              onClick={() => setShowSettings((prev) => !prev)}
            >
              Settings ⚙️
            </button>
          </div>
          <div className="mt-1 text-center text-[0.6rem] text-slate-500">
            Pause with <span className="font-semibold">P</span>
          </div>
        </div>
      </div>

      <div className="z-10 flex items-start">
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
            pickupShopPosition={activeShopPosition}
          />

          <RewardPopupsLayer popups={rewardPopups} />
        </div>
      </div>

      <div className="z-10 mt-2 mb-2 flex w-full justify-center">
        <div style={{ width: mapPixelWidth }}>
          <InventoryPanel inventory={inventory} theme={theme} />
        </div>
      </div>

      <HelpPanel visible={showHelp} />

      <IntroOverlay
        visible={isIntro}
        selectedSkin={selectedSkin}
        onSelectSkin={setSelectedSkin}
        onStartRide={handleStartRide}
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

      <RunSummaryOverlay
        visible={isSummary}
        summary={runSummary}
        onPlayAgain={handleSummaryPlayAgain}
        onBackToTitle={handleSummaryBackToTitle}
      />

      <SettingsPanel
        visible={showSettings}
        sfxEnabled={sfxEnabled}
        musicEnabled={musicEnabled}
        musicVolume={musicVolume}
        onToggleSfx={() => setSfxEnabled((prev) => !prev)}
        onToggleMusic={() => setMusicEnabled((prev) => !prev)}
        onChangeMusicVolume={setMusicVolume}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}

type SettingsPanelProps = {
  visible: boolean;
  sfxEnabled: boolean;
  musicEnabled: boolean;
  musicVolume: number;
  onToggleSfx: () => void;
  onToggleMusic: () => void;
  onChangeMusicVolume: (value: number) => void;
  onClose: () => void;
};

function SettingsPanel({
  visible,
  sfxEnabled,
  musicEnabled,
  musicVolume,
  onToggleSfx,
  onToggleMusic,
  onChangeMusicVolume,
  onClose,
}: SettingsPanelProps) {
  if (!visible) return null;

  return (
    <div className="fixed top-24 right-6 z-40 w-72 rounded-2xl border border-slate-300/80 bg-white/95 px-4 py-4 text-xs text-slate-800 shadow-xl backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Settings
        </h2>
        <button
          className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.7rem] text-slate-500 hover:bg-slate-200"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span>SFX</span>
          <button
            className={`rounded-full px-3 py-1 text-[0.7rem] font-semibold shadow-sm transition ${
              sfxEnabled
                ? "bg-amber-400 text-amber-950 hover:bg-amber-500"
                : "bg-slate-700 text-slate-100 hover:bg-slate-800"
            }`}
            onClick={onToggleSfx}
          >
            {sfxEnabled ? "On" : "Off"}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span>Music</span>
          <button
            className={`rounded-full px-3 py-1 text-[0.7rem] font-semibold shadow-sm transition ${
              musicEnabled
                ? "bg-indigo-400 text-indigo-950 hover:bg-indigo-500"
                : "bg-slate-700 text-slate-100 hover:bg-slate-800"
            }`}
            onClick={onToggleMusic}
          >
            {musicEnabled ? "On" : "Off"}
          </button>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span>Music volume</span>
            <span className="text-[0.65rem] text-slate-500">
              {musicVolume}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={musicVolume}
            onChange={(e) =>
              onChangeMusicVolume(Number(e.target.value))
            }
            className="w-full accent-indigo-500"
          />
        </div>
      </div>
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

function findAllShops(map: TileType[][]): Position[] {
  const shops: Position[] = [];
  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[0].length; x++) {
      if (map[y][x] === "shop") {
        shops.push({ x, y });
      }
    }
  }
  return shops;
}

function pickRandomShop(map: TileType[][]): Position | null {
  const shops = findAllShops(map);
  if (!shops.length) return null;
  const idx = Math.floor(Math.random() * shops.length);
  return shops[idx];
}

function decidePackageKind(level: number): PackageKind {
  const baseChance = 0.25;
  const perLevel = 0.05;
  const chance = Math.min(baseChance + (level - 1) * perLevel, 0.7);

  if (Math.random() < chance) {
    return "perishable";
  }
  return "standard";
}

function initialPerishableTimer(level: number): number {
  const base = 22;
  const penalty = Math.min(level - 1, 8);
  return Math.max(10, base - penalty);
}

function computeDirectionLabel(
  from: Position,
  to: Position | null
): string | null {
  if (!to) return null;

  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (dx === 0 && dy === 0) {
    return "Here";
  }

  const angleRad = Math.atan2(-dy, dx);
  const angleDeg = (angleRad * 180) / Math.PI;

  if (angleDeg > -22.5 && angleDeg <= 22.5) return "E";
  if (angleDeg > 22.5 && angleDeg <= 67.5) return "NE";
  if (angleDeg > 67.5 && angleDeg <= 112.5) return "N";
  if (angleDeg > 112.5 && angleDeg <= 157.5) return "NW";
  if (angleDeg > 157.5 || angleDeg <= -157.5) return "W";
  if (angleDeg > -157.5 && angleDeg <= -112.5) return "SW";
  if (angleDeg > -112.5 && angleDeg <= -67.5) return "S";
  if (angleDeg > -67.5 && angleDeg <= -22.5) return "SE";

  return null;
}
