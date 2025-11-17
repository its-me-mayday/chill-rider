import type { Theme } from "./GameView";
import type { PackageItem } from "../types/Package";

type InventoryPanelProps = {
  inventory: PackageItem[];
  theme: Theme;
};

export function InventoryPanel({ inventory, theme }: InventoryPanelProps) {
  const panelClass =
    theme === "hawkins"
      ? "w-full rounded-2xl border border-red-500/60 bg-slate-900/90 px-4 py-3 shadow-lg backdrop-blur-sm"
      : "w-full rounded-2xl border border-slate-300/80 bg-white/90 px-4 py-3 shadow-lg backdrop-blur-sm";

  const titleClass =
    theme === "hawkins"
      ? "text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-400"
      : "text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500";

  return (
    <div className={panelClass}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className={titleClass}>Inventory</h2>
        <span className="text-[0.65rem] text-slate-500">
          {inventory.length}/5 slots
        </span>
      </div>

      {inventory.length === 0 ? (
        <p className="text-[0.7rem] italic text-slate-500">
          No packages yet… ride to a shop to pick one!
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {inventory.map((pkg, idx) => {
            const isActive = idx === 0;
            const isPerishable = pkg.kind === "perishable";

            const baseCard =
              "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-[0.7rem] transition-transform duration-150";
            const activeRing = isActive
              ? theme === "hawkins"
                ? "ring-1 ring-red-400/70 scale-[1.02]"
                : "ring-1 ring-sky-400/70 scale-[1.02]"
              : "";

            const perishableClasses = isPerishable
              ? theme === "hawkins"
                ? "bg-amber-900/50 border-amber-500/70 text-amber-50"
                : "bg-amber-50 border-amber-300 text-amber-900"
              : theme === "hawkins"
              ? "bg-slate-900/80 border-slate-600 text-slate-100"
              : "bg-slate-50 border-slate-300 text-slate-800";

            return (
              <div
                key={pkg.id}
                className={`${baseCard} ${perishableClasses} ${activeRing}`}
              >
                {/* color square */}
                <span
                  className="inline-block h-4 w-4 rounded-sm border border-black/40 shadow-sm"
                  style={{ backgroundColor: pkg.color }}
                />

                <div className="flex flex-col leading-tight">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold truncate max-w-[7rem]">
                      {isPerishable ? "Fresh delivery" : "Standard box"}
                    </span>
                    {isActive && (
                      <span className="rounded-full bg-black/15 px-2 py-[1px] text-[0.6rem] uppercase tracking-wide">
                        Active
                      </span>
                    )}
                    {isPerishable && (
                      <span className="rounded-full bg-black/20 px-2 py-[1px] text-[0.6rem] uppercase tracking-wide">
                        Perishable
                      </span>
                    )}
                  </div>
                  <span className="text-[0.6rem] text-slate-400">
                    {isPerishable
                      ? "Fast delivery, keep an eye on the timer."
                      : "Relaxed ride, no expiration at all."}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
