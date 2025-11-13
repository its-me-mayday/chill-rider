import { useEffect } from "react";
import {
  type Direction,
  type TileType,
} from "../engine/localEngine";
import { useGame } from "../hooks/useGame";
import { RiderSprite } from "./RiderSprite";
import { GoalSprite } from "./GoalSprite";

export function GameView() {
  const { game, move, newMap } = useGame();

  const tileSize = 40;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const direction = keyToDirection(e.key);
      if (!direction) return;
      move(direction);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [move]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-4 text-slate-100">
      <div className="mb-4 flex w-full max-w-md items-center justify-between gap-4 rounded-lg bg-slate-800/80 px-4 py-2 shadow-lg">
        <div>
          <h1 className="text-xl font-bold tracking-[0.25em]">
            RIDER ROGUE
          </h1>
          <p className="text-xs text-slate-400">
            Use arrows or WASD to move.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[0.65rem] uppercase text-slate-400">
            Distance
          </div>
          <div className="text-lg font-semibold text-emerald-400">
            {game.distance}
          </div>
        </div>
      </div>

      <div
        className="inline-block border border-slate-700 bg-slate-800 shadow-xl"
        style={{
          width: game.options.width * tileSize,
          height: game.options.height * tileSize,
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
                    <div className="absolute inset-2 flex items-center justify-center">
                      <GoalSprite />
                    </div>
                  )}
                  {isRider && (
                    <div className="absolute inset-1 flex items-center justify-center">
                      <RiderSprite />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-3">
        <button
          className="rounded bg-emerald-500 px-4 py-2 text-sm font-semibold hover:bg-emerald-600"
          onClick={newMap}
        >
          New map
        </button>
      </div>

      <p className="mt-2 text-[0.7rem] text-slate-500">
        Ride to the goal marker on the road.
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
      return `${base} bg-slate-700`;
    case "grass":
      return `${base} bg-green-700`;
    case "tree":
      return `${base} bg-green-900`;
    case "building":
      return `${base} bg-slate-500`;
    default:
      return `${base} bg-black`;
  }
}
