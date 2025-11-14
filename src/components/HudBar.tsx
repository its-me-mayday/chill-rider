import type { Theme } from "./GameView";
import type { PackageColor } from "../types/Package";

type HudBarProps = {
  level: number;
  distance: number;
  deliveries: number;
  coins: number;
  theme: Theme;
  targetColor: PackageColor | null;
  deliveriesThisLevel: number;
  deliveriesPerLevel: number;
};

export function HudBar({
  level,
  distance,
  deliveries,
  coins,
  theme,
  targetColor,
  deliveriesThisLevel,
  deliveriesPerLevel,
}: HudBarProps) {
  const titleClass =
    theme === "hawkins"
      ? "text-2xl font-extrabold tracking-[0.3em] text-red-400"
      : "text-2xl font-extrabold tracking-[0.3em]";

  const barClass =
    theme === "hawkins"
      ? "z-10 mb-4 flex w-full max-w-3xl items-center justify-between gap-4 rounded-2xl border border-red-500/60 bg-slate-900/90 px-6 py-3 shadow-lg backdrop-blur-sm"
      : "z-10 mb-4 flex w-full max-w-3xl items-center justify-between gap-4 rounded-2xl border border-slate-300/70 bg-white/85 px-6 py-3 shadow-lg backdrop-blur-sm";

  const targetLabel =
    targetColor === null ? "No active delivery" : "Deliver here";

  return (
    <div className={barClass}>
      <div>
        <h1 className={titleClass}>CHILL RIDER</h1>
        <p className="text-xs text-slate-500">
          {theme === "hawkins"
            ? "Night ride through Hawkins streets."
            : "Cruise through pastel mountains and deliver in peace."}
        </p>
      </div>

      <div className="flex items-center gap-6 text-right text-sm">
        <div>
          <div className="text-[0.65rem] uppercase text-slate-500">
            Level
          </div>
          <div
            className={
              theme === "hawkins"
                ? "text-lg font-semibold text-red-400"
                : "text-lg font-semibold text-sky-600"
            }
          >
            {level}
          </div>
        </div>

        <div>
          <div className="text-[0.65rem] uppercase text-slate-500">
            Distance
          </div>
          <div
            className={
              theme === "hawkins"
                ? "text-lg font-semibold text-slate-200"
                : "text-lg font-semibold text-emerald-500"
            }
          >
            {distance}
          </div>
        </div>

        <div>
          <div className="text-[0.65rem] uppercase text-slate-500">
            Deliveries
          </div>
          <div
            className={
              theme === "hawkins"
                ? "text-lg font-semibold text-red-300"
                : "text-lg font-semibold text-sky-500"
            }
          >
            {deliveries}
          </div>
          <div className="text-[0.6rem] text-slate-500">
            {deliveriesThisLevel}/{deliveriesPerLevel} this level
          </div>
        </div>

        <div>
          <div className="text-[0.65rem] uppercase text-slate-500">
            Coins
          </div>
          <div
            className={
              theme === "hawkins"
                ? "text-lg font-semibold text-amber-300"
                : "text-lg font-semibold text-amber-500"
            }
          >
            {coins}
          </div>
        </div>

        {/* mini indicatore target */}
        <div className="text-right">
          <div className="text-[0.65rem] uppercase text-slate-500">
            Target
          </div>
          <div className="flex items-center justify-end gap-2">
            <div
              className="h-3 w-3 rounded-sm shadow-sm"
              style={{
                backgroundColor: targetColor
                  ? colorForPackageTiny(targetColor, theme)
                  : "transparent",
                border: targetColor
                  ? "1px solid rgba(15,23,42,0.6)"
                  : "1px dashed rgba(148,163,184,0.7)",
              }}
            />
            <span className="text-[0.65rem] text-slate-500">
              {targetLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function colorForPackageTiny(
  color: PackageColor,
  theme: Theme
): string {
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
