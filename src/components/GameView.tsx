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
import { InventoryPanel } from "./InventoryPanel";
import { RewardPopupsLayer } from "./RewardPopupsLayer";
import { RunSummaryOverlay } from "./RunSummaryOverlay";
import type { PackageItem, PackageColor } from "../types/Package";
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

export function GameView() {
  const {
    game,
    move,
    newMap,
    addCoins,
    completeDelivery,
    resetGame,
  } = useGame();

  const tilesX = game.options.width;
  const tilesY = game.options.height;

  const viewportWidth =
    typeof window !== "undefined" ? window.innerWidth : 1024;
  const viewportHeight =
    typeof window !== "undefined" ? window.innerHeight : 768;

  const maxMapWidth = viewportWidth - 200;
  const maxMapHeight = viewportHeight - 260;

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
  const [runSummary, setRunSummary] = useState<RunSummary | null>(
    null
  );
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [musicVolume, setMusicVolume] = useState(70);
  const [showSettings, setShowSettings] = useState(false);

  const prevDeliveriesRef = useRef(game.deliveries);
  const prevLevelRef = useRef(game.level);
  const prevCoinsRef = useRef(game.coinsCollected);
  const prevPositionRef = useRef<Position>(game.riderPosition);
  const levelRef = useRef(game.level);

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

  const deliveriesThisLevel = game.deliveries % DELIVERIES_PER_LEVEL;

  const isIntro = uiPhase === "intro";
  const isPaused = uiPhase === "paused";
  const isSummary = uiPhase === "summary";

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

  function pickPackage(currentGame: GameState) {
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
    setInventory((prev) =>
      prev.filter((p) => p.id !== house.packageId)
    );
    setHouses((prev) =>
      prev.filter((h) => h.packageId !== house.packageId)
    );

    addCoins(DELIVERY_COIN_REWARD);
    completeDelivery();

    if (sfxEnabled) {
      sfx.playDelivery(theme);
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
      }, 1100);

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
      if (sfxEnabled) {
        sfx.playShop(theme);
      }
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
  }, [game.riderPosition, game.map, houses, sfxEnabled, theme]);

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

      const nextPos = getNextPosition(game.riderPosition, direction);
      if (!isInsideMap(nextPos, game.map)) return;

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
    setRunSummary(null);
    setUiPhase("playing");
  }

  function handleSummaryBackToTitle() {
    resetGame();
    setInventory([]);
    setHouses([]);
    setPackagesSpawnedThisLevel(0);
    setRunSummary(null);
    setUiPhase("intro");
  }

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
          />

          <RewardPopupsLayer popups={rewardPopups} />
        </div>
      </div>

      <div className="z-10 mt-2 mb-2 flex w-full justify-center">
        <InventoryPanel inventory={inventory} theme={theme} />
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

function isInsideMap(pos: Position, map: TileType[][]): boolean {
  return (
    pos.y >= 0 &&
    pos.y < map.length &&
    pos.x >= 0 &&
    pos.x < map[0].length
  );
}
