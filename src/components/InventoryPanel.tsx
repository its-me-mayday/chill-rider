import type { Theme } from "./GameView";
import type { PackageItem, PackageColor } from "../types/Package";

type InventoryPanelProps = {
  inventory: PackageItem[];
  theme: Theme;
  highlight?: boolean;
};

const PACKAGE_COLORS: Record<PackageColor, string> = {
  red: "#f97373",
  blue: "#38bdf8",
  green: "#22c55e",
  yellow: "#eab308",
  purple: "#a855f7",
};

export function InventoryPanel({
  inventory,
  theme,
  highlight = false,
}: InventoryPanelProps) {
  const active = inventory[0] ?? null;
  const isPerishable = active?.kind === "perishable";

  const basePanelClass =
    theme === "hawkins"
      ? "w-full rounded-2xl border border-red-500/60 bg-slate-900/90 px-4 py-2 shadow-lg backdrop-blur-sm"
      : "w-full rounded-2xl border border-slate-300/80 bg-white/90 px-4 py-2 shadow-lg backdrop-blur-sm";

  const panelHighlightClass = highlight
    ? " ring-2 ring-emerald-300/70 animate-pulse"
    : "";

  const titleClass =
    theme === "hawkins"
      ? "text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-400"
      : "text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-slate-500";

  // slot più sottile
  const slotBaseClass =
    "mt-1 flex min-h-[44px] w-full items-center justify-between rounded-xl border px-3 py-2 text-[0.7rem] transition-colors";

  const slotThemeClass = (() => {
    if (isPerishable) {
      return theme === "hawkins"
        ? "border-amber-400/80 bg-amber-900/30 text-amber-100"
        : "border-amber-400 bg-amber-50 text-amber-900";
    }
    return theme === "hawkins"
      ? "border-slate-700/80 bg-slate-900/80 text-slate-100"
      : "border-slate-300/80 bg-slate-50 text-slate-900";
  })();

  return (
    <div className={basePanelClass + panelHighlightClass}>
      <div className="flex items-center justify-between">
        <h2 className={titleClass}>Inventory</h2>
      </div>

      <div className={`${slotBaseClass} ${slotThemeClass}`}>
        {active ? (
          <>
            <div className="flex items-center gap-3">
              {/* ICON BOX */}
              <div className="relative flex h-7 w-7 items-center justify-center rounded-md border border-slate-800/30 bg-black/5 shadow-sm">
                <div
                  className="absolute inset-0 rounded-md opacity-70"
                  style={{
                    backgroundColor: PACKAGE_COLORS[active.color],
                    mixBlendMode: "multiply",
                  }}
                />
                <span className="relative text-[0.7rem]">📦</span>

                {/* Radar ping only if perishable */}
                {isPerishable && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/70" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
                  </span>
                )}
              </div>

              {/* TEXT */}
              <div className="flex flex-col">
                <span className="text-[0.7rem] font-semibold">
                  Package
                </span>
                <span className="text-[0.6rem] opacity-80 capitalize">
                  {active.kind === "perishable"
                    ? "Perishable delivery"
                    : "Standard delivery"}
                </span>
              </div>
            </div>

            {isPerishable && (
              <span className="flex items-center gap-1 rounded-full bg-black/10 px-2 py-[1px] text-[0.55rem] uppercase tracking-wide animate-pulse">
                <span>⏱</span>
                <span>Time sensitive</span>
              </span>
            )}
          </>
        ) : (
          <div className="flex w-full items-center justify-center text-[0.65rem] opacity-70">
            No package picked up.
          </div>
        )}
      </div>
    </div>
  );
}
