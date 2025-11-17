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
  housesCount: number;
  shopsCount: number;
  houseDirection: string | null;
  shopDirection: string | null;
  targetTimer: number | null;
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
  housesCount,
  shopsCount,
  houseDirection,
  shopDirection,
  targetTimer,
}: HudBarProps) {
  const titleClass =
    theme === "hawkins"
      ? "text-xl font-extrabold tracking-[0.25em] text-red-400"
      : "text-xl font-extrabold tracking-[0.25em]";

  const barClass =
    theme === "hawkins"
      ? "z-10 mb-2 flex w-full max-w-3xl items-center justify-between gap-4 rounded-2xl border border-red-500/60 bg-slate-900/90 px-5 py-2 shadow-lg backdrop-blur-sm"
      : "z-10 mb-2 flex w-full max-w-3xl items-center justify-between gap-4 rounded-2xl border border-slate-300/70 bg-white/85 px-5 py-2 shadow-lg backdrop-blur-sm";

  const subtitleClass =
    theme === "hawkins"
      ? "text-[0.7rem] text-slate-400"
      : "text-[0.7rem] text-slate-500";

  const levelColorClass =
    theme === "hawkins"
      ? "text-base font-semibold text-red-400"
      : "text-base font-semibold text-sky-600";

  const distanceColorClass =
    theme === "hawkins"
      ? "text-base font-semibold text-slate-200"
      : "text-base font-semibold text-emerald-500";

  const deliveriesColorClass =
    theme === "hawkins"
      ? "text-base font-semibold text-red-300"
      : "text-base font-semibold text-sky-500";

  const coinsColorClass =
    theme === "hawkins"
      ? "text-base font-semibold text-amber-300"
      : "text-base font-semibold text-amber-500";

  const targetColorHex: Record<PackageColor, string> = {
    red: "#f97373",
    blue: "#38bdf8",
    green: "#22c55e",
    yellow: "#eab308",
    purple: "#a855f7",
  };

  const hasTarget = Boolean(targetColor);

  let directionText = "";
  const parts: string[] = [];
  if (shopDirection) {
    parts.push(`Shop: ${shopDirection}`);
  }
  if (houseDirection) {
    parts.push(`House: ${houseDirection}`);
  }
  if (parts.length > 0) {
    directionText = " • " + parts.join(" • ");
  }

  return (
    <div className={barClass}>
      <div className="min-w-0">
        <h1 className={titleClass}>CHILL RIDER</h1>
        <p className={subtitleClass}>
          {theme === "hawkins"
            ? "Night ride through Hawkins streets."
            : "Cruise through pastel mountains and deliver in peace."}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.65rem] text-slate-500">
          <span>
            Level progress:{" "}
            <span className="font-semibold text-slate-700">
              {deliveriesThisLevel}/{deliveriesPerLevel}
            </span>
          </span>

          {hasTarget && targetColor && (
            <span className="flex items-center gap-1">
              Target:
              <span
                className="inline-block h-3 w-3 rounded-sm border border-slate-700"
                style={{ backgroundColor: targetColorHex[targetColor] }}
              />
              {typeof targetTimer === "number" && (
                <span
                  className={
                    "ml-1 inline-flex items-center gap-1 rounded-full border px-3 py-[2px] text-[0.7rem] font-semibold leading-none " +
                    (targetTimer > 5
                      ? theme === "hawkins"
                        ? "border-emerald-500/50 bg-emerald-900/60 text-emerald-100"
                        : "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : targetTimer > 0
                      ? theme === "hawkins"
                        ? "border-amber-500/60 bg-amber-900/60 text-amber-100"
                        : "border-amber-300 bg-amber-50 text-amber-700"
                      : theme === "hawkins"
                      ? "border-rose-500/70 bg-rose-900/70 text-rose-100"
                      : "border-rose-300 bg-rose-50 text-rose-700")
                  }
                >
                  ⏱ {targetTimer > 0 ? targetTimer : 0}
                </span>
              )}
            </span>
          )}

          <span className="text-[0.65rem] text-slate-500">
            Map:{" "}
            <span className="font-semibold text-slate-700">
              {housesCount}
            </span>{" "}
            houses ·{" "}
            <span className="font-semibold text-slate-700">
              {shopsCount}
            </span>{" "}
            shops
            {directionText}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-right text-xs">
        <div>
          <div className="text-[0.6rem] uppercase text-slate-500">
            Level
          </div>
          <div className={levelColorClass}>{level}</div>
        </div>
        <div>
          <div className="text-[0.6rem] uppercase text-slate-500">
            Distance
          </div>
          <div className={distanceColorClass}>{distance}</div>
        </div>
        <div>
          <div className="text-[0.6rem] uppercase text-slate-500">
            Deliveries
          </div>
          <div className={deliveriesColorClass}>{deliveries}</div>
        </div>
        <div>
          <div className="text-[0.6rem] uppercase text-slate-500">
            Coins
          </div>
          <div className={coinsColorClass}>{coins}</div>
        </div>
      </div>
    </div>
  );
}
