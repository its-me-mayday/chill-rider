import type { PackageItem } from "../types/Package";
import type { Theme } from "./GameView";
import { colorForPackage } from "./colorForPackage";

type InventoryPanelProps = {
  inventory: PackageItem[];
  theme: Theme;
};

export function InventoryPanel({ inventory, theme }: InventoryPanelProps) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/85 px-4 py-2 text-xs text-slate-100 shadow-lg backdrop-blur">
      <div className="mb-1 text-center text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-300">
        Inventory
      </div>
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => {
          const item = inventory[i];
          return (
            <div
              key={i}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800/80"
              style={{
                border: item
                  ? "2px solid rgba(248, 250, 252, 0.95)"
                  : "1px dashed rgba(148, 163, 184, 0.8)",
              }}
            >
              {item ? (
                <div
                  className="h-4 w-4 rounded-sm shadow"
                  style={{
                    backgroundColor: colorForPackage(item.color, theme),
                  }}
                />
              ) : (
                <span className="text-[0.55rem] text-slate-400">
                  Empty
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
