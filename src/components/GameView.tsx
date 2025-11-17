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
import { GameOverOverlay } from "./GameOverOverlay";
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
import { MalusPanel } from "./MalusPanel";
import { TimePanel } from "./TimePanel";

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
const PERISHABLE_TIMEOUT_SECONDS_PENALTY = 20;

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

  const maxMapWidth = Math.max(320, viewportWidth - sidePanelWidth - 80);
  const maxMapHeight = viewportHeight - 260;

  const rawTileSize = Math.min(maxMapWidth / tilesX, maxMapHeight / tilesY);
  const tileSize = Math.max(24, Math.floor(rawTileSize));
  const mapPixelWidth = tilesX * tileSize;
  const mapPixelHeight = tilesY * tileSize;

  const inventoryWidth = Math.min(mapPixelWidth, viewportWidth - 80);

  const [recentLevelUp, setRecentLevelUp] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [uiPhase, setUiPhase] = useState<UiPhase>("intro");
  const [selectedSkin, setSelectedSkin] = useState<Skin>("rider");

  const [riderShake, setRiderShake] = useState(false);
  const [deliveriesGlow, setDeliveriesGlow] = useState(false);

  const [globalTime, setGlobalTime] = useState(60);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isLevelFrozen, setIsLevelFrozen] = useState(false);

  const [activePackageTimer, setActivePackageTimer] =
    useState<number | null>(null);

  const [inventory, setInventory] = useState<PackageItem[]>([]);
  const [inventoryHighlight, setInventoryHighlight] = useState(false);
  const [houses, setHouses] = useState<HouseMarker[]>([]);
  const [rewardPopups, setRewardPopups] = useState<RewardPopup[]>([]);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [deliveryBurst, setDeliveryBurst] = useState<Position | null>(null);

  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [musicVolume, setMusicVolume] = useState(70);
  const [showSettings, setShowSettings] = useState(false);

  const [activeShopPosition, setActiveShopPosition] =
    useState<Position | null>(null);

  const [warningFlash, setWarningFlash] = useState(false);

  // Mud / malus
  const [mudStepsRemaining, setMudStepsRemaining] = useState(0);

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
  
  function deliverPackage(house: HouseMarker) {
    const deliveredPackage = inventory.find(
      (p) => p.id === house.packageId
    );

    const timeBonus =
      deliveredPackage && deliveredPackage.kind === "perishable"
        ? 20
        : 15;

    setGlobalTime((prev) => prev + timeBonus);

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

    setRiderShake(true);
    setDeliveriesGlow(true);
    setTimeout(() => setRiderShake(false), 220);
    setTimeout(() => setDeliveriesGlow(false), 280);

// quante consegne avremo dopo questa
const deliveriesAfter = game.deliveries + 1;
const deliveriesThisLevelAfter =
  deliveriesAfter % DELIVERIES_PER_LEVEL;

// se NON abbiamo ancora finito il livello, prepara un nuovo shop
if (deliveriesThisLevelAfter !== 0) {
  const nextShop = pickRandomShop(game.map);
  if (nextShop) {
    setActiveShopPosition(nextShop);
  } else {
    setActiveShopPosition(null);
  }
} else {
  // quinta consegna del livello -> stop shop, il level-up penserà al resto
  setActiveShopPosition(null);
}

    setTimeout(() => {
      setDeliveryBurst(null);
    }, 350);
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
// quante consegne ho fatto in questo livello
const deliveriesThisLevel =
currentGame.deliveries % DELIVERIES_PER_LEVEL;

// se ho già fatto tutte le consegne del livello, non spawnare altri pacchi
if (deliveriesThisLevel >= DELIVERIES_PER_LEVEL) return;

// se ho già un pacco o una casa attiva, non ne creo altri
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

// timer per i deperibili con bonus zaino
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

  // Global timer tick (real time)
  useEffect(() => {
    if (uiPhase !== "playing") return;
    if (isGameOver) return;
    if (isLevelFrozen) return;
    if (globalTime <= 0) return;

    const id = window.setInterval(() => {
      setGlobalTime((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(id);
  }, [uiPhase, isGameOver, isLevelFrozen, globalTime]);

  // When timer reaches 0 -> Game Over
  useEffect(() => {
    if (globalTime === 0 && !isGameOver) {
      setIsGameOver(true);
      setRunSummary({
        level: game.level,
        distance: game.distance,
        deliveries: game.deliveries,
        coins: game.coinsCollected,
      });
      setUiPhase("summary");
    }
  }, [
    globalTime,
    isGameOver,
    game.level,
    game.distance,
    game.deliveries,
    game.coinsCollected,
  ]);

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

  // level up + equipment choice
  useEffect(() => {
    if (game.level > prevLevelRef.current) {
      setRecentLevelUp(true);
      spawnRewardPopup(`Level ${game.level}!`, "level");
      openEquipmentChoiceOverlay();

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
      setHouses([]);
      setInventory([]);
      setActiveShopPosition(null);
      setActivePackageTimer(null);
      setIsLevelFrozen(true);
    }
  }, [game.level]);

  // on rider movement (tile effects)
  useEffect(() => {
    const prev = prevPositionRef.current;
    const current = game.riderPosition;

    if (prev.x === current.x && prev.y === current.y) {
      return;
    }

    const tile = game.map[current.y][current.x];

    // Coffee tiles removed – no more bonuses here

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
    const deliveriesThisLevel =
      game.deliveries % DELIVERIES_PER_LEVEL;
  
    if (
      inventory.length === 0 &&
      houses.length === 0 &&
      deliveriesThisLevel < DELIVERIES_PER_LEVEL &&
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
    activeShopPosition,
    game.map,
    game.deliveries,
  ]);
  

  // package perishable decay on distance
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

  // perishable warning flash
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

  // perishable expired -> time penalty
  useEffect(() => {
    if (!activePackage) return;
    if (activePackage.kind !== "perishable") return;
    if (activePackageTimer === null || activePackageTimer > 0) return;

    const expiredId = activePackage.id;

    setInventory((prev) => prev.filter((p) => p.id !== expiredId));
    setHouses((prev) => prev.filter((h) => h.packageId !== expiredId));
    setActivePackageTimer(null);

    setGlobalTime((prev) =>
      Math.max(0, prev - PERISHABLE_TIMEOUT_SECONDS_PENALTY)
    );
    spawnRewardPopup(`-${PERISHABLE_TIMEOUT_SECONDS_PENALTY}s (expired)`, "coins");
  }, [activePackage, activePackageTimer]);

  // Keyboard handling (movement, pause, help, mud)
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

      let direction = keyToDirection(e.key);
      if (!direction) return;
      if (uiPhase !== "playing") return;

      // Mud inversion
      if (mudStepsRemaining > 0) {
        direction = invertDirection(direction);
        setMudStepsRemaining((prev) => Math.max(0, prev - 1));
      }

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

      // Mud penalty on entering slow tile
      if (tile === "slow") {
        const addedSteps = 1 + Math.floor(Math.random() * 10); // 1..10 steps
        setMudStepsRemaining((prev) => prev + addedSteps);

        const lostSeconds = 1 + Math.floor(Math.random() * 5); // 1..5 seconds
        setGlobalTime((prev) => Math.max(0, prev - lostSeconds));
        spawnRewardPopup(`-${lostSeconds}s (mud)`, "coins");
      }

      // first move after level-up -> unfreeze global timer
      setIsLevelFrozen(false);

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
    mudStepsRemaining,
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
    setGlobalTime(60);
    setIsGameOver(false);
    setIsLevelFrozen(false);
    setMudStepsRemaining(0);
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
    setActiveShopPosition(null);
    setActivePackageTimer(null);
    setMudStepsRemaining(0);
  }

  function handleEndRun() {
    setRunSummary({
      level: game.level,
      distance: game.distance,
      deliveries: game.deliveries,
      coins: game.coinsCollected,
    });
    setIsGameOver(false);
    setUiPhase("summary");
  }

  function handleSummaryPlayAgain() {
    resetGame();
    setInventory([]);
    setHouses([]);
    setActiveShopPosition(null);
    setRunSummary(null);
    setActivePackageTimer(null);
    setGlobalTime(60);
    setIsGameOver(false);
    setIsLevelFrozen(false);
    setMudStepsRemaining(0);
    setUiPhase("playing");
  }

  function handleSummaryBackToTitle() {
    resetGame();
    setInventory([]);
    setHouses([]);
    setActiveShopPosition(null);
    setRunSummary(null);
    setActivePackageTimer(null);
    setGlobalTime(60);
    setIsGameOver(false);
    setIsLevelFrozen(false);
    setMudStepsRemaining(0);
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

      {uiPhase === "playing" && (
        <div className="pointer-events-none fixed top-6 right-6 z-30 rounded-xl bg-white/90 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-lg backdrop-blur">
          Delivery completed!
        </div>
      )}

      {/* TOP BAR */}
      <div className="z-10 mb-3 flex w-full max-w-6xl items-start justify-center">
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
          globalTime={globalTime}
          deliveriesGlow={deliveriesGlow}
        />
      </div>

      {/* MAP + EQUIPMENT + MALUS + TIME + INVENTORY */}
      <div className="z-10 mt-1 grid w-full max-w-6xl justify-center gap-4 md:grid-cols-[auto_auto]">
        {/* MAP */}
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
            shakeRider={riderShake}
          />

          {activeShopPosition && (
            <TileMarker
              kind="shop"
              position={activeShopPosition}
              tileSize={tileSize}
              theme={theme}
            />
          )}

          {targetHousePosition && targetHouse && (
            <TileMarker
              kind="house"
              position={targetHousePosition}
              tileSize={tileSize}
              theme={theme}
            />
          )}

          {deliveryBurst && (
            <DeliveryBurstEffect
              position={deliveryBurst}
              tileSize={tileSize}
            />
          )}

          <RewardPopupsLayer popups={rewardPopups} />
        </div>

        {/* RIGHT COLUMN: equipment + malus (row 1) */}
        <div
          className="md:col-start-2 md:row-start-1 flex flex-col gap-3"
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

          <MalusPanel
            theme={theme}
            mudStepsRemaining={mudStepsRemaining}
          />
        </div>

        {/* BOTTOM ROW: inventory (left) + time panel (right) */}
        <div className="md:col-start-1 md:row-start-2 mb-2 flex justify-center">
          <div style={{ width: inventoryWidth }}>
            <InventoryPanel
              inventory={inventory}
              theme={theme}
              highlight={inventoryHighlight}
            />
          </div>
        </div>

        <div className="md:col-start-2 md:row-start-2 mb-2 flex justify-end">
          <div style={{ width: sidePanelWidth }}>
            <TimePanel theme={theme} globalTime={globalTime} />
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
        onNewMap={handleNewMap}
        onToggleHelp={() => setShowHelp((prev) => !prev)}
        onOpenSettings={() => setShowSettings(true)}
        theme={theme}
      />

      <RunSummaryOverlay
        visible={isSummary && !isGameOver}
        summary={runSummary}
        onPlayAgain={handleSummaryPlayAgain}
        onBackToTitle={handleSummaryBackToTitle}
      />

      <GameOverOverlay
        visible={isSummary && isGameOver}
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

/* === SettingsPanel, helpers & visual effects ========================= */

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

function invertDirection(direction: Direction): Direction {
  switch (direction) {
    case "up":
      return "down";
    case "down":
      return "up";
    case "left":
      return "right";
    case "right":
      return "left";
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

type TileMarkerProps = {
  kind: "shop" | "house";
  position: Position;
  tileSize: number;
  theme: Theme;
};

function TileMarker({
  kind,
  position,
  tileSize,
  theme,
}: TileMarkerProps) {
  const cx = position.x * tileSize + tileSize / 2;
  const cy = position.y * tileSize + tileSize / 2;

  const isHawkins = theme === "hawkins";

  const ringColorClass =
    kind === "shop"
      ? isHawkins
        ? "border-cyan-300/80"
        : "border-sky-400/80"
      : isHawkins
      ? "border-emerald-300/80"
      : "border-emerald-500/80";

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: cx,
        top: cy,
        width: tileSize * 1.3,
        height: tileSize * 1.3,
        transform: "translate(-50%, -50%)",
      }}
    >
      <div
        className={
          "absolute inset-0 rounded-full border-2 bg-transparent " +
          ringColorClass +
          " animate-ping"
        }
      />
    </div>
  );
}

type DeliveryBurstEffectProps = {
  position: Position;
  tileSize: number;
};

function DeliveryBurstEffect({
  position,
  tileSize,
}: DeliveryBurstEffectProps) {
  const cx = position.x * tileSize + tileSize / 2;
  const cy = position.y * tileSize + tileSize / 2;

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: cx,
        top: cy,
        width: tileSize * 1.6,
        height: tileSize * 1.6,
        transform: "translate(-50%, -50%)",
      }}
    >
      <div className="absolute inset-0 rounded-full bg-emerald-400/25 animate-ping" />
      <div className="absolute inset-[20%] flex items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-400/80 text-[0.75rem] font-bold text-emerald-950 shadow-lg">
        ✓
      </div>
    </div>
  );
}
