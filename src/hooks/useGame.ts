import { useState, useCallback } from "react";
import {
  createGame,
  applyCommand,
  type GameState,
  type Direction,
  type GameOptions,
} from "../engine/localEngine";

const DEFAULT_OPTIONS: GameOptions = {
  width: 16,
  height: 10,
};

export function useGame(initialOptions: GameOptions = DEFAULT_OPTIONS) {
  const [game, setGame] = useState<GameState>(() =>
    createGame(initialOptions)
  );

  const move = useCallback((direction: Direction) => {
    setGame((prev) =>
      applyCommand(prev, { type: "MOVE", direction })
    );
  }, []);

  const newMap = useCallback(() => {
    setGame((prev) =>
      applyCommand(prev, { type: "REGENERATE_MAP" })
    );
  }, []);

  return {
    game,
    move,
    newMap,
  };
}
