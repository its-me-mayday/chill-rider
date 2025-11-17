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
import { EquipmentPanel, type EquipmentKey } from "./EquipmentPanel";
import {
  EquipmentChoiceOverlay,
  type EquipmentChoice,
} from "./EquipmentChoiceOverlay";

type UiPhase = "intro" | "playing" | "paused" | "summary" | "equipment";
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

  const sidePanelWidth =
    typeof window !== "undefined"
      ? Math.max(180, Math.min(260, window.innerWidth * 0.22))
      : 220;

  const maxMapWidth = Math.max(
    320,
    viewportWidth - sidePanelWidth - 80
  );
  const maxMapHeight = viewportHeight - 260;

  const rawTileSize = Math.min(
    maxMapWidth / tilesX,
    maxMapHeight / tilesY
  );
  const tileSize = Math.max(24, Math.floor(rawTileSize));
  const mapPixelWidth = tilesX * tileSize;
  const mapPixelHeight = tilesY * tileSize;

  const inventoryWidth = Math.min(mapPixelWidth, viewportWidth - 80);

  const [recentDelivery, setRecentDelivery] = useState(false);
  const [recentLevelUp, setRecentLevelUp] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [uiPhase, setUiPhase] = useState<UiPhase>("intro");
  const [selectedSkin, setSelectedSkin] = useState<Skin>("rider");

  const [activePackageTimer, setActivePackageTimer] =
    useState<number | null>(null);

  const [inventory, setInventory] = useState<PackageItem[]>([]);
  const [inventoryHighlight, setInventoryHighlight] = useState(false);
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
  const [showSessionMenu, setShowSessionMenu] = useState(false);

  const [activeShopPosition, setActiveShopPosition] =
    useState<Position | null>(null);

  const [warningFlash, setWarningFlash] = useState(false);

  const [equipmentLevels, setEquipmentLevels] = useState<
    Record<EquipmentKey, number>
  >({
    helmet: 0,
    bell: 0,
    bikeFrame: 0,
    coffeeThermos: 0,
    backpack: 0,
  });

  const [recentUpgradedKey, setRecentUpgradedKey] =
    useState<EquipmentKey | null>(null);

  const [equipmentChoices, setEquipmentChoices] = useState<
    EquipmentChoice[] | null
  >(null);

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
  const isEquipmentPhase = uiPhase === "equipment";

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
      const backpackLevel = equipmentLevels.backpack ?? 0;
      const baseTimer = initialPerishableTimer(currentGame.level);
      const bonus = backpackLevel;
      setActivePackageTimer(baseTimer + bonus);
    } else {
      setActivePackageTimer(null);
    }

    // micro-flash inventory
    setInventoryHighlight(true);
    setTimeout(() => setInventoryHighlight(false), 350);
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

    const bellLevel = equipmentLevels.bell ?? 0;
    const extraFromBell =
      bellLevel > 0 ? Math.floor((bellLevel + 1) / 2) : 0;
    const totalReward = DELIVERY_COIN_REWARD + extraFromBell;

    addCoins(totalReward);
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

  function openEquipmentChoiceOverlay() {
    const allKeys: EquipmentKey[] = [
      "helmet",
      "bell",
      "bikeFrame",
      "coffeeThermos",
      "backpack",
    ];
    const available = [...allKeys];

    const count = Math.random() < 0.5 ? 2 : 3;
    const choices: EquipmentChoice[] = [];

    while (choices.length < count && available.length > 0) {
      const idx = Math.floor(Math.random() * available.length);
      const key = available[idx];
      available.splice(idx, 1);

      const currentLevel = equipmentLevels[key] ?? 0;
      const nextLevel = currentLevel + 1;

      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;

      choices.push({ id, key, nextLevel });
    }

    if (choices.length > 0) {
      setEquipmentChoices(choices);
      setUiPhase("equipment");
      setShowSessionMenu(false);
    }
  }

  function handleEquipmentPick(choice: EquipmentChoice) {
    setEquipmentLevels((prev) => ({
      ...prev,
      [choice.key]: (prev[choice.key] ?? 0) + 1,
    }));
    setEquipmentChoices(null);
    setUiPhase("playing");

    setRecentUpgradedKey(choice.key);
    setTimeout(() => setRecentUpgradedKey(null), 600);
  }

  function handleEquipmentSkip() {
    setEquipmentChoices(null);
    setUiPhase("playing");
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

      if (game.level > 1) {
        openEquipmentChoiceOverlay();
      }
    }
  }, [game.level]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const prev = prevPositionRef.current;
    const current = game.riderPosition;

    if (prev.x === current.x && prev.y === current.y) {
      return;
    }

    const tile = game.map[current.y][current.x];

    if (tile === "coffee") {
      spawnRewardPopup("Coffee break!", "coffee");

      const coffeeLevel = equipmentLevels.coffeeThermos ?? 0;
      if (coffeeLevel > 0) {
        const bonusCoins = coffeeLevel;
        addCoins(bonusCoins);
      }
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
    equipmentLevels,
    addCoins,
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

    const bikeLevel = equipmentLevels.bikeFrame ?? 0;
    const decayModifier = Math.max(0.5, 1 - bikeLevel * 0.05);
    const effectiveSteps = Math.max(
      1,
      Math.round(movedSteps * decayModifier)
    );

    setActivePackageTimer((currentTimer) => {
      if (currentTimer === null) return currentTimer;
      const next = currentTimer - effectiveSteps;
      return next > 0 ? next : 0;
    });
  }, [
    game.distance,
    activePackage,
    activePackageTimer,
    equipmentLevels,
  ]);

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

  useEffect(() => {
    if (!activePackage) return;
    if (activePackage.kind !== "perishable") return;
    if (activePackageTimer === null || activePackageTimer > 0) return;

    const expiredId = activePackage.id;

    setInventory((prev) => prev.filter((p) => p.id !== expiredId));
    setHouses((prev) => prev.filter((h) => h.packageId !== expiredId));
    setActivePackageTimer(null);

    const helmetLevel = equipmentLevels.helmet ?? 0;
    const basePenalty = PERISHABLE_TIMEOUT_PENALTY;
    const reducedPenalty = Math.max(1, basePenalty - helmetLevel);

    addCoins(-reducedPenalty);
    spawnRewardPopup(`-${reducedPenalty} (expired)`, "coins");
  }, [activePackage, activePackageTimer, addCoins, equipmentLevels]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (uiPhase === "summary" || uiPhase === "equipment") {
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
    setShowSessionMenu(false);
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

      {/* TOP BAR + mobile hamburger */}
      <div className="z-10 mb-3 flex w-full max-w-6xl items-start justify-center gap-4">
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

        {/* mobile-only hamburger */}
        <div className="mt-1 flex flex-col items-end md:hidden">
          <button
            className={
              "flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold shadow-sm transition " +
              (theme === "hawkins"
                ? "border-red-500/60 bg-slate-900/90 text-red-200 hover:bg-slate-800"
                : "border-slate-300/70 bg-white/90 text-slate-700 hover:bg-slate-50")
            }
            onClick={() =>
              setShowSessionMenu((prev) => !prev)
            }
            aria-label="Session menu"
          >
            ☰
          </button>

          {showSessionMenu && (
            <div className="mt-2 w-48 rounded-2xl border border-slate-300/70 bg-white/95 px-3 py-3 text-[0.7rem] text-slate-800 shadow-lg backdrop-blur-sm">
              <div className="mb-1 text-center text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Session controls
              </div>
              <div className="flex flex-col gap-2">
                <button
                  className="rounded-full bg-emerald-500 px-3 py-1 font-semibold text-white shadow-sm transition hover:bg-emerald-600"
                  onClick={handleNewMap}
                >
                  New map
                </button>
                <button
                  className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-sky-700 shadow-sm transition hover:bg-white"
                  onClick={() => {
                    setShowHelp((prev) => !prev);
                    setShowSessionMenu(false);
                  }}
                >
                  Help (H)
                </button>
                <button
                  className="rounded-full bg-slate-200 px-3 py-1 font-semibold text-slate-800 shadow-sm transition hover:bg-slate-300"
                  onClick={() => {
                    setShowSettings(true);
                    setShowSessionMenu(false);
                  }}
                >
                  Settings ⚙️
                </button>
              </div>
              <div className="mt-2 text-center text-[0.6rem] text-slate-500">
                Pause with <span className="font-semibold">P</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MAP + EQUIPMENT + INVENTORY */}
      <div className="z-10 mt-1 grid w-full max-w-6xl justify-center gap-4 md:grid-cols-[auto_auto]">
        <div
          className="relative md:col-start-1 md:row-start-1"
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

        <div
          className="md:col-start-2 md:row-start-1 md:row-span-2 flex flex-col gap-3"
          style={{ width: sidePanelWidth, maxHeight: mapPixelHeight }}
        >
          <div className="h-full min-h-0 overflow-hidden">
            <div className="h-full overflow-y-auto">
              <EquipmentPanel
                theme={theme}
                equipmentLevels={equipmentLevels}
                highlightedKey={recentUpgradedKey}
              />
            </div>
          </div>

          <div className="hidden md:block">
            <SessionControlsPanel
              theme={theme}
              onNewMap={handleNewMap}
              onToggleHelp={() => setShowHelp((prev) => !prev)}
              onOpenSettings={() => setShowSettings(true)}
            />
          </div>
        </div>

        <div className="md:col-start-1 md:row-start-2 mb-2 flex justify-center">
          <div style={{ width: inventoryWidth }}>
            <InventoryPanel
              inventory={inventory}
              theme={theme}
              highlight={inventoryHighlight}
            />
          </div>
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

      <EquipmentChoiceOverlay
        visible={isEquipmentPhase && !!equipmentChoices}
        theme={theme}
        choices={equipmentChoices ?? []}
        onPick={handleEquipmentPick}
        onSkip={handleEquipmentSkip}
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

type SessionControlsPanelProps = {
  theme: Theme;
  onNewMap: () => void;
  onToggleHelp: () => void;
  onOpenSettings: () => void;
};

function SessionControlsPanel({
  theme,
  onNewMap,
  onToggleHelp,
  onOpenSettings,
}: SessionControlsPanelProps) {
  const panelClass =
    theme === "hawkins"
      ? "w-full rounded-2xl border border-red-500/50 bg-slate-900/90 px-3 py-3 text-[0.7rem] text-slate-100 shadow-lg backdrop-blur-sm"
      : "w-full rounded-2xl border border-slate-300/70 bg-white/95 px-3 py-3 text-[0.7rem] text-slate-800 shadow-lg backdrop-blur-sm";

  const titleClass =
    "mb-2 text-center text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-500";

  return (
    <div className={panelClass}>
      <div className={titleClass}>Session controls</div>
      <div className="flex flex-col gap-2">
        <button
          className="w-full rounded-full bg-emerald-500 px-3 py-1 font-semibold text-white shadow-sm transition hover:bg-emerald-600"
          onClick={onNewMap}
        >
          New map
        </button>
        <button
          className="w-full rounded-full bg-slate-100 px-3 py-1 font-semibold text-sky-700 shadow-sm transition hover:bg-white"
          onClick={onToggleHelp}
        >
          Help (H)
        </button>
        <button
          className="w-full rounded-full bg-slate-200 px-3 py-1 font-semibold text-slate-800 shadow-sm transition hover:bg-slate-300"
          onClick={onOpenSettings}
        >
          Settings ⚙️
        </button>
      </div>
      <div className="mt-2 text-center text-[0.6rem] text-slate-500">
        Pause with <span className="font-semibold">P</span>
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
