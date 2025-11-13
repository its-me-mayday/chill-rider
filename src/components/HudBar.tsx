import type { Theme } from "./GameView";

type HudBarProps = {
  level: number;
  distance: number;
  deliveries: number;
  coins: number;
  theme: Theme;
};

export function HudBar({
  level,
  distance,
  deliveries,
  coins,
  theme,
}: HudBarProps) {
  const titleClass =
    theme === "hawkins"
      ? "text-2xl font-extrabold tracking-[0.3em] text-red-400"
      : "text-2xl font-extrabold tracking-[0.3em]";

  const barClass =
    theme === "hawkins"
      ? "z-10 mb-4 flex w-full max-w-3xl items-center justify-between gap-4 rounded-2xl border border-red-500/60 bg-slate-900/90 px-6 py-3 shadow-lg backdrop-blur-sm"
      : "z-10 mb-4 flex w-full max-w-3xl items-center justify-between gap-4 rounded-2xl border border-slate-300/70 bg-white/85 px-6 py-3 shadow-lg backdrop-blur-sm";

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
      </div>
    </div>
  );
}
