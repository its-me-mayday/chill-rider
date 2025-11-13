import { useEffect, useRef, useState } from "react";
import {
  type Direction,
  type TileType,
} from "../engine/localEngine";
import { useGame } from "../hooks/useGame";
import { RiderSprite } from "./RiderSprite";
import { GoalSprite } from "./GoalSprite";

export function GameView() {
  const { game, move, newMap } = useGame();

  const tilesX = game.options.width;
  const tilesY = game.options.height;

  const viewportWidth =
    typeof window !== "undefined" ? window.innerWidth : 1024;
  const viewportHeight =
    typeof window !== "undefined" ? window.innerHeight : 768;

  const maxMapWidth = viewportWidth - 80;
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

  const prevDeliveriesRef = useRef(game.deliveries);
  const prevLevelRef = useRef(game.level);

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
      const timeout = setTimeout(() => {
        setRecentLevelUp(false);
      }, 1100);
      prevLevelRef.current = game.level;
      return () => clearTimeout(timeout);
    }
    prevLevelRef.current = game.level;
  }, [game.level]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "h" || e.key === "H") {
        setShowHelp((prev) => !prev);
        return;
      }
      const direction = keyToDirection(e.key);
      if (!direction) return;
      move(direction);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [move]);

  return (
    <div className="relative flex h-screen w-screen flex-col items-center justify-center bg-gradient-to-b from-sky-100 via-sky-200 to-emerald-200 text-slate-900">
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-emerald-300/90 via-emerald-200/0 to-transparent" />

      {recentDelivery && (
        <div className="pointer-events-none fixed top-6 right-6 z-30 rounded-xl bg-white/90 px-4 py-2 text-sm font-semibold text-emerald-700 shadow-lg backdrop-blur">
          Delivery completed!
        </div>
      )}

      {recentLevelUp && (
        <div className="pointer-events-none fixed top-16 right-6 z-30 rounded-xl bg-sky-500/95 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur">
          Level up!
        </div>
      )}

      <div className="z-10 mb-4 flex w-full max-w-3xl items-center justify-between gap-4 rounded-2xl border border-slate-300/70 bg-white/85 px-6 py-3 shadow-lg backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-extrabold tracking-[0.3em]">
            CHILL RIDER
          </h1>
          <p className="text-xs text-slate-500">
            Cruise through pastel mountains and deliver in peace.
          </p>
        </div>
        <div className="flex items-center gap-6 text-right text-sm">
          <div>
            <div className="text-[0.65rem] uppercase text-slate-500">
              Level
            </div>
            <div className="text-lg font-semibold text-sky-600">
              {game.level}
            </div>
          </div>
          <div>
            <div className="text-[0.65rem] uppercase text-slate-500">
              Distance
            </div>
            <div className="text-lg font-semibold text-emerald-500">
              {game.distance}
            </div>
          </div>
          <div>
            <div className="text-[0.65rem] uppercase text-slate-500">
              Deliveries
            </div>
            <div className="text-lg font-semibold text-sky-500">
              {game.deliveries}
            </div>
          </div>
        </div>
      </div>

      <div
        className="map-glow z-10 inline-block overflow-hidden rounded-2xl border border-slate-400/40 bg-slate-900"
        style={{
          width: mapPixelWidth,
          height: mapPixelHeight,
        }}
      >
        {game.map.map((row, y) => (
          <div key={y} className="flex">
            {row.map((tile, x) => {
              const isRider =
                game.riderPosition.x === x &&
                game.riderPosition.y === y;

              const isGoal =
                game.goalPosition.x === x &&
                game.goalPosition.y === y;

              return (
                <div
                  key={x}
                  className="relative"
                  style={{ width: tileSize, height: tileSize }}
                >
                  <div className={tileToClass(tile)} />
                  {isGoal && (
                    <div className="absolute inset-[18%] flex items-center justify-center">
                      <GoalSprite size={tileSize * 0.6} />
                    </div>
                  )}
                  {isRider && (
                    <div className="absolute inset-[12%] flex items-center justify-center">
                      <RiderSprite
                        size={tileSize * 0.7}
                        direction={game.facing}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="z-10 mt-4 flex gap-3">
        <button
          className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-600 hover:shadow-lg"
          onClick={newMap}
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
      </div>

      {showHelp && (
        <div className="z-20 mt-3 w-full max-w-xl rounded-2xl border border-slate-300/70 bg-white/90 px-4 py-3 text-xs text-slate-700 shadow-lg backdrop-blur">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold tracking-[0.18em] uppercase text-slate-500">
              Controls
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem]">
              Press H to hide
            </span>
          </div>
          <div className="mb-2 flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
                  ↑
                </span>
                <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
                  ↓
                </span>
                <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
                  ←
                </span>
                <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
                  →
                </span>
              </div>
              <span>Move around the city</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
                  W
                </span>
                <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
                  A
                </span>
                <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
                  S
                </span>
                <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
                  D
                </span>
              </div>
              <span>Alternative movement keys</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-slate-900 px-2 py-1 text-[0.7rem] font-semibold text-slate-50">
                H
              </span>
              <span>Toggle this help panel</span>
            </div>
          </div>
          <div className="mt-1 grid gap-1 text-[0.7rem] text-slate-600">
            <span>
              Goal: ride to the glowing delivery marker on the road.
            </span>
            <span>
              Every 5 deliveries you level up and the city becomes denser,
              but still chill.
            </span>
          </div>
        </div>
      )}

      <p className="z-10 mt-2 text-[0.7rem] text-slate-700">
        Ride to the goal marker, stack deliveries, and climb the chill levels.
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

function tileToClass(tile: TileType): string {
  const base = "h-full w-full";
  switch (tile) {
    case "road":
      return `${base} bg-gradient-to-b from-slate-100 to-slate-300`;
    case "grass":
      return `${base} bg-gradient-to-b from-emerald-200 to-emerald-300`;
    case "tree":
      return `${base} bg-emerald-600`;
    case "building":
      return `${base} bg-slate-500/90`;
    default:
      return `${base} bg-slate-900`;
  }
}
