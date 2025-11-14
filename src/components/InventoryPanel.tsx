import type { PackageItem } from "../types/Package";
import type { Theme } from "./GameView";
import { colorForPackage } from "./colorForPackage";

type InventoryPanelProps = {
  visible: boolean;
  inventory: PackageItem[];
  theme: Theme;
};

export function InventoryPanel({
  visible,
  inventory,
  theme,
}: InventoryPanelProps) {
  if (!visible) return null;

  return (
    <div className="pointer-events-auto fixed right-6 top-1/2 z-20 w-40 -translate-y-1/2 rounded-2xl border border-slate-700 bg-slate-900/70 p-3 text-xs text-slate-100 shadow-lg backdrop-blur">
      <div className="mb-2 text-center text-sm font-semibold tracking-[0.18em] uppercase text-slate-300">
        Inventory <span className="text-[0.6rem]">(I)</span>
      </div>
      <div className="grid gap-2">
        {Array.from({ length: 5 }).map((_, i) => {
          const item = inventory[i];
          return (
            <div
              key={i}
              className="flex h-10 items-center justify-center rounded-lg bg-slate-800/70"
              style={{
                border: item
                  ? "2px solid rgba(248, 250, 252, 0.95)"
                  : "1px dashed rgba(148, 163, 184, 0.8)",
              }}
            >
              {item ? (
                <div
                  className="h-5 w-5 rounded-sm shadow"
                  style={{
                    backgroundColor: colorForPackage(
                      item.color,
                      theme
                    ),
                  }}
                />
              ) : (
                <span className="text-[0.65rem] text-slate-400">
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
