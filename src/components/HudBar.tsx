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
  targetTimer?: number | null;
  globalTime: number;
  deliveriesGlow?: boolean;
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
  globalTime,
  deliveriesGlow = false,
}: HudBarProps) {
  const isHawkins = theme === "hawkins";

  const titleClass = isHawkins
    ? "text-xl font-extrabold tracking-[0.25em] text-red-400"
    : "text-xl font-extrabold tracking-[0.25em] text-slate-800";

    const barClass =
    "w-full flex items-center justify-between rounded-2xl px-6 py-3 shadow-lg " +
    (isHawkins
      ? "border border-red-500/60 bg-slate-950/95"
      : "border border-slate-300/70 bg-white/95");

  const subtitleClass = isHawkins
    ? "text-[0.7rem] text-slate-400"
    : "text-[0.7rem] text-slate-500";

  const levelColorClass = isHawkins
    ? "text-base font-semibold text-red-400"
    : "text-base font-semibold text-sky-600";

  const distanceColorClass = isHawkins
    ? "text-base font-semibold text-slate-200"
    : "text-base font-semibold text-emerald-500";

  const deliveriesColorClassBase = isHawkins
    ? "text-base font-semibold text-red-300"
    : "text-base font-semibold text-sky-500";

  const deliveriesColorClass = deliveriesGlow
    ? deliveriesColorClassBase +
      " animate-pulse drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]"
    : deliveriesColorClassBase;

  const coinsColorClass = isHawkins
    ? "text-base font-semibold text-amber-300"
    : "text-base font-semibold text-amber-500";

  const timerPillClass = isHawkins
    ? "inline-flex items-center gap-1 rounded-full border border-red-500/70 bg-slate-900/90 px-3 py-1 text-[0.7rem] font-semibold text-red-200 shadow-sm"
    : "inline-flex items-center gap-1 rounded-full border border-slate-300/80 bg-slate-900 text-[0.7rem] font-semibold text-emerald-200 shadow-sm";

  const globalTimeIsLow = globalTime <= 10;
  const globalTimeClassExtra = globalTimeIsLow
    ? " animate-pulse text-red-400"
    : "";

  const targetColorHex: Record<PackageColor, string> = {
    red: "#f97373",
    blue: "#38bdf8",
    green: "#22c55e",
    yellow: "#eab308",
    purple: "#a855f7",
  };

  const hasTarget = Boolean(targetColor);
  const hasPerishableTimer = typeof targetTimer === "number";

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

  const globalTimeDisplay = String(globalTime).padStart(2, "0");
  const perishableTimerDisplay =
    typeof targetTimer === "number"
      ? String(Math.max(0, targetTimer)).padStart(2, "0")
      : null;

  return (
    <div className={barClass}>
      {/* LEFT SIDE: Title, subtitle, map info, target info */}
      <div className="min-w-0 flex-1">
        <h1 className={titleClass}>CHILL RIDER</h1>
        <p className={subtitleClass}>
          {isHawkins
            ? "Night ride through Hawkins streets."
            : "Cruise through pastel hills and deliver in peace."}
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
              {hasPerishableTimer && perishableTimerDisplay && (
                <span className="ml-1 text-[0.65rem] text-slate-600">
                  ({perishableTimerDisplay}s)
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

      {/* RIGHT SIDE: global timer + stats */}
      <div className="flex flex-col items-end gap-1 text-right text-xs">

        {/* Stats row */}
        <div className="mt-1 flex items-center gap-4">
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
    </div>
  );
}
