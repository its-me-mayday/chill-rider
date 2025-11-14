import type { PackageItem } from "../types/Package";
import type { Theme } from "./GameView";

type InventoryPanelProps = {
  inventory: PackageItem[];
  theme: Theme;
};

const INVENTORY_SLOTS = 3;
const EQUIPMENT_SLOTS = 5;
const MODIFIER_SLOTS = 2;

export function InventoryPanel({ inventory, theme }: InventoryPanelProps) {
  const basePanelClass =
    theme === "hawkins"
      ? "flex-1 rounded-2xl border border-red-500/40 bg-slate-900/85 shadow-lg backdrop-blur-sm"
      : "flex-1 rounded-2xl border border-slate-300/70 bg-white/90 shadow-lg backdrop-blur-sm";

  const titleClass =
    theme === "hawkins"
      ? "text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-red-300"
      : "text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-slate-500";

  const labelClass =
    theme === "hawkins"
      ? "text-[0.7rem] text-slate-300"
      : "text-[0.7rem] text-slate-600";

  const emptyTextClass =
    theme === "hawkins"
      ? "text-[0.6rem] text-slate-500"
      : "text-[0.6rem] text-slate-400";

  const slotBorderBase =
    theme === "hawkins"
      ? "border border-red-500/40 bg-slate-900/90"
      : "border border-slate-300/70 bg-slate-900/5";

  return (
    <div className="flex w-full max-w-5xl gap-3 px-4">
      <div className={basePanelClass}>
        <div className="flex h-full flex-col gap-2 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className={titleClass}>Inventory</span>
            <span className={labelClass}>
              {inventory.length}/{INVENTORY_SLOTS}
            </span>
          </div>
          <div className="flex gap-2">
            {Array.from({ length: INVENTORY_SLOTS }).map((_, i) => {
              const item = inventory[i];
              return (
                <div
                  key={i}
                  className={`flex h-10 flex-1 items-center justify-center rounded-xl ${slotBorderBase}`}
                >
                  {item ? (
                    <div
                      className="h-6 w-6 rounded-md shadow-md"
                      style={{
                        backgroundColor: item.color,
                      }}
                    />
                  ) : (
                    <span className={emptyTextClass}>Empty</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={basePanelClass}>
        <div className="flex h-full flex-col gap-2 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className={titleClass}>Equipment</span>
            <span className={labelClass}>0/{EQUIPMENT_SLOTS}</span>
          </div>
          <div className="flex gap-2">
            {Array.from({ length: EQUIPMENT_SLOTS }).map((_, i) => (
              <div
                key={i}
                className={`flex h-10 flex-1 items-center justify-center rounded-xl ${slotBorderBase}`}
              >
                <span className={emptyTextClass}>Empty</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={basePanelClass}>
        <div className="flex h-full flex-col gap-2 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className={titleClass}>Modifiers</span>
            <span className={labelClass}>0/{MODIFIER_SLOTS}</span>
          </div>
          <div className="flex gap-2">
            {Array.from({ length: MODIFIER_SLOTS }).map((_, i) => (
              <div
                key={i}
                className={`flex h-10 flex-1 items-center justify-center rounded-xl ${slotBorderBase}`}
              >
                <span className={emptyTextClass}>Empty</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
